import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { Pool } from 'pg';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { uploadMealPhoto } from '../services/cloudflare';
import { analyzeMealPhoto } from '../services/ocr';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

// Configure multer for memory storage (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed'));
    }
  }
});

// Valid meal types
const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Validates that the date is today or in the past
 */
function isValidMealDate(dateString: string): boolean {
  const mealDate = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  return !isNaN(mealDate.getTime()) && mealDate <= today;
}

/**
 * POST /api/meals/upload
 * Upload a meal photo with automatic calorie detection
 */
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // 1. Validate authentication
      if (!req.user?.userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const userId = req.user.userId;

      // 2. Validate file upload
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 3. Validate meal_type
      const { meal_type, meal_date } = req.body;

      if (!meal_type || !VALID_MEAL_TYPES.includes(meal_type)) {
        res.status(400).json({
          success: false,
          error: `Invalid meal_type. Must be one of: ${VALID_MEAL_TYPES.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 4. Validate meal_date
      if (!meal_date) {
        res.status(400).json({
          success: false,
          error: 'meal_date is required (YYYY-MM-DD format)',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!isValidMealDate(meal_date)) {
        res.status(400).json({
          success: false,
          error: 'meal_date must be today or in the past',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 5. Compress image before uploading
      console.log(`Original image size: ${(req.file.buffer.length / 1024 / 1024).toFixed(2)}MB`);

      let compressedBuffer: Buffer;
      try {
        compressedBuffer = await sharp(req.file.buffer)
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 85,
            progressive: true
          })
          .toBuffer();

        console.log(`Compressed image size: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      } catch (compressionError) {
        console.error('Image compression failed:', compressionError);
        res.status(500).json({
          success: false,
          error: 'Failed to process image',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 6. Upload to Cloudflare R2
      const uploadResult = await uploadMealPhoto(compressedBuffer, userId);

      if (!uploadResult.success || !uploadResult.url) {
        res.status(500).json({
          success: false,
          error: uploadResult.error || 'Failed to upload photo',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const photoUrl = uploadResult.url;

      // 7. Send to OpenRouter OCR for food detection
      const ocrResult = await analyzeMealPhoto(photoUrl);

      let mealName = 'Unknown Meal';
      let totalCalories = 0;
      let foodItems: Array<{
        food_name: string;
        portion: string;
        calories: number;
        confidence?: number;
      }> = [];

      if (ocrResult.success && ocrResult.items && ocrResult.items.length > 0) {
        foodItems = ocrResult.items;
        totalCalories = ocrResult.totalCalories || 0;

        // Generate meal name from first 2-3 food items
        const topFoods = ocrResult.items.slice(0, 3).map(item => item.food_name);
        mealName = topFoods.join(', ');

        // Truncate if too long
        if (mealName.length > 100) {
          mealName = mealName.substring(0, 97) + '...';
        }
      }

      // 8. Save to meals table
      const mealInsertQuery = `
        INSERT INTO meals (user_id, meal_name, meal_type, meal_date, photo_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, meal_name, meal_type, meal_date, photo_url, created_at
      `;

      const mealResult = await pool.query(mealInsertQuery, [
        userId,
        mealName,
        meal_type,
        meal_date,
        photoUrl
      ]);

      const meal = mealResult.rows[0];
      const mealId = meal.id;

      // 9. Save food items to meal_items table
      if (foodItems.length > 0) {
        const itemInsertQuery = `
          INSERT INTO meal_items (
            meal_id, food_name, quantity, unit, calories,
            protein, carbs, fat, source, confidence
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, food_name, calories, confidence
        `;

        const insertedItems = [];

        for (const item of foodItems) {
          // Parse portion to extract quantity and unit (simplified)
          // For MVP, we'll use a default quantity of 1 and unit of 'pieces'
          const quantity = 1;
          const unit = 'pieces';

          const itemResult = await pool.query(itemInsertQuery, [
            mealId,
            item.food_name,
            quantity,
            unit,
            item.calories,
            0, // protein - not provided by OCR for MVP
            0, // carbs - not provided by OCR for MVP
            0, // fat - not provided by OCR for MVP
            'ocr_detected',
            item.confidence || 0.85
          ]);

          insertedItems.push(itemResult.rows[0]);
        }
      }

      // 10. Return success response
      if (ocrResult.success && foodItems.length > 0) {
        res.status(201).json({
          success: true,
          data: {
            mealId: mealId,
            photoUrl: photoUrl,
            foods: foodItems,
            totalCalories: totalCalories
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // OCR failed but meal was saved
        res.status(201).json({
          success: true,
          data: {
            mealId: mealId,
            photoUrl: photoUrl,
            note: 'Calories could not be detected, please review'
          },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Meal upload error:', error);

      // Handle multer errors
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            error: 'File size exceeds 5MB limit',
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';

      res.status(500).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }
);

interface FoodItem {
  food_name: string;
  calories: number;
}

interface MealHistoryEntry {
  date: string;
  meal_type: string;
  photo_url: string | null;
  meal_name: string;
  foods: FoodItem[];
  totalCalories: number;
}

/**
 * GET /api/meals/history
 * Get user's meal history within a date range
 * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (optional, default last 7 days)
 */
router.get(
  '/history',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get date range from query params or default to last 7 days
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const endDate = ((req.query['endDate'] as string) || today.toISOString().split('T')[0]) as string;
      const startDate = ((req.query['startDate'] as string) || sevenDaysAgo.toISOString().split('T')[0]) as string;

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Query meals within date range
      const mealsQuery = await pool.query(
        `SELECT id, meal_date, meal_type, photo_url, meal_name, created_at
         FROM meals
         WHERE user_id = $1 AND meal_date >= $2 AND meal_date <= $3
         ORDER BY meal_date DESC, created_at DESC`,
        [userId, startDate, endDate]
      );

      const meals: MealHistoryEntry[] = [];

      // For each meal, get food items
      for (const meal of mealsQuery.rows) {
        const itemsQuery = await pool.query(
          `SELECT food_name, calories
           FROM meal_items
           WHERE meal_id = $1
           ORDER BY created_at ASC`,
          [meal.id]
        );

        const foods: FoodItem[] = itemsQuery.rows.map(item => ({
          food_name: item.food_name,
          calories: Math.round(parseFloat(item.calories))
        }));

        const totalCalories = foods.reduce((sum, food) => sum + food.calories, 0);

        meals.push({
          date: meal.meal_date,
          meal_type: meal.meal_type,
          photo_url: meal.photo_url,
          meal_name: meal.meal_name,
          foods: foods,
          totalCalories: totalCalories
        });
      }

      res.status(200).json({
        success: true,
        data: {
          meals: meals,
          totalMealsLogged: meals.length,
          dateRange: {
            start: startDate,
            end: endDate
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Meal history error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
