import { Router, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

interface FoodItem {
  food_name: string;
  calories: number;
}

interface MealSummary {
  meal_type: string;
  photo_url: string | null;
  foods: FoodItem[];
  calories: number;
}

/**
 * GET /api/dashboard
 * Get user's daily dashboard with meals and calorie progress
 * Query params: ?date=YYYY-MM-DD (optional, defaults to today)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Get date from query params or use today
    const dateParam = req.query['date'] as string | undefined;
    const targetDate = (dateParam || new Date().toISOString().split('T')[0]) as string; // YYYY-MM-DD

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 1. Get user's daily calorie goal
    const userQuery = await pool.query(
      'SELECT daily_calorie_goal FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const dailyGoal = userQuery.rows[0].daily_calorie_goal;

    // 2. Get all meals for the user on that date
    const mealsQuery = await pool.query(
      `SELECT id, meal_type, photo_url, created_at
       FROM meals
       WHERE user_id = $1 AND meal_date = $2
       ORDER BY created_at ASC`,
      [userId, targetDate]
    );

    const meals: MealSummary[] = [];
    let totalCalories = 0;

    // 3. For each meal, get food items and sum calories
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

      const mealCalories = foods.reduce((sum, food) => sum + food.calories, 0);
      totalCalories += mealCalories;

      meals.push({
        meal_type: meal.meal_type,
        photo_url: meal.photo_url,
        foods: foods,
        calories: mealCalories
      });
    }

    // 4. Calculate progress metrics
    const remainingCalories = dailyGoal - totalCalories;
    const progressPercent = dailyGoal > 0
      ? Math.round((totalCalories / dailyGoal) * 100 * 100) / 100 // Round to 2 decimals
      : 0;
    const goalAchieved = totalCalories <= dailyGoal;

    // 5. Return dashboard data
    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        daily_goal: dailyGoal,
        total_calories: totalCalories,
        remaining_calories: remainingCalories,
        progress_percent: progressPercent,
        goal_achieved: goalAchieved,
        meals: meals
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
