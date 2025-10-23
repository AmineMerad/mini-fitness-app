import request from 'supertest';
import app from '../../src/app';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as cloudflareService from '../../src/services/cloudflare';
import * as ocrService from '../../src/services/ocr';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] || `postgresql://${process.env['USER'] || 'postgres'}@localhost:5432/fitness_app_test`,
});

// Mock external services
jest.mock('../../src/services/cloudflare');
jest.mock('../../src/services/ocr');

describe('Meals Routes', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up and seed test user
    await pool.query('DELETE FROM users WHERE email = $1', ['mealtest@example.com']);

    const hashedPassword = await bcrypt.hash('password123', 10);
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, daily_calorie_goal)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['mealtestuser', 'mealtest@example.com', hashedPassword, 2000]
    );

    userId = userResult.rows[0].id;

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'mealtest@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', ['mealtest@example.com']);
    await pool.end();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/meals/upload', () => {
    it('should upload meal successfully with OCR detection', async () => {
      // Mock successful upload and OCR
      (cloudflareService.uploadMealPhoto as jest.Mock).mockResolvedValue({
        success: true,
        url: 'https://cdn.example.com/meals/test/123.jpg'
      });

      (ocrService.analyzeMealPhoto as jest.Mock).mockResolvedValue({
        success: true,
        items: [
          { food_name: 'Chicken', portion: '150g', calories: 248, confidence: 0.9 },
          { food_name: 'Rice', portion: '100g', calories: 112, confidence: 0.85 }
        ],
        totalCalories: 360
      });

      const response = await request(app)
        .post('/api/meals/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meal_type', 'lunch')
        .field('meal_date', '2024-01-15')
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mealId');
      expect(response.body.data).toHaveProperty('photoUrl', 'https://cdn.example.com/meals/test/123.jpg');
      expect(response.body.data.foods).toHaveLength(2);
      expect(response.body.data.totalCalories).toBe(360);
    });

    it('should handle OCR failure gracefully', async () => {
      (cloudflareService.uploadMealPhoto as jest.Mock).mockResolvedValue({
        success: true,
        url: 'https://cdn.example.com/meals/test/456.jpg'
      });

      (ocrService.analyzeMealPhoto as jest.Mock).mockResolvedValue({
        success: false,
        error: 'OCR failed'
      });

      const response = await request(app)
        .post('/api/meals/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meal_type', 'dinner')
        .field('meal_date', '2024-01-15')
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mealId');
      expect(response.body.data).toHaveProperty('note', 'Calories could not be detected, please review');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/meals/upload')
        .field('meal_type', 'lunch')
        .field('meal_date', '2024-01-15')
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail without file', async () => {
      const response = await request(app)
        .post('/api/meals/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meal_type', 'lunch')
        .field('meal_date', '2024-01-15');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should fail with invalid meal_type', async () => {
      const response = await request(app)
        .post('/api/meals/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meal_type', 'invalid')
        .field('meal_date', '2024-01-15')
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid meal_type');
    });

    it('should fail with missing meal_date', async () => {
      const response = await request(app)
        .post('/api/meals/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('meal_type', 'lunch')
        .attach('file', Buffer.from('fake-image-data'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('meal_date is required');
    });
  });

  describe('GET /api/meals/history', () => {
    beforeAll(async () => {
      // Seed some test meals
      const mealResult = await pool.query(
        `INSERT INTO meals (user_id, meal_name, meal_type, meal_date, photo_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, 'Test Meal', 'lunch', '2024-01-15', 'https://example.com/test.jpg']
      );

      const mealId = mealResult.rows[0].id;

      await pool.query(
        `INSERT INTO meal_items (meal_id, food_name, quantity, unit, calories)
         VALUES ($1, $2, $3, $4, $5)`,
        [mealId, 'Chicken', 1, 'pieces', 248]
      );
    });

    it('should get meal history successfully', async () => {
      const response = await request(app)
        .get('/api/meals/history?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('meals');
      expect(response.body.data).toHaveProperty('totalMealsLogged');
      expect(response.body.data).toHaveProperty('dateRange');
      expect(Array.isArray(response.body.data.meals)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/meals/history');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
