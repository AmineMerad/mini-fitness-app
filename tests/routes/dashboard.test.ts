import request from 'supertest';
import app from '../../src/app';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] || `postgresql://${process.env['USER'] || 'postgres'}@localhost:5432/fitness_app_test`,
});

describe('Dashboard Routes', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up
    await pool.query('DELETE FROM users WHERE email = $1', ['dashboard@example.com']);

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, daily_calorie_goal)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['dashuser', 'dashboard@example.com', hashedPassword, 2000]
    );
    userId = userResult.rows[0].id;

    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dashboard@example.com',
        password: 'password123'
      });
    authToken = loginResponse.body.data.token;

    // Seed test meals for a specific date
    const mealResult1 = await pool.query(
      `INSERT INTO meals (user_id, meal_name, meal_type, meal_date, photo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, 'Breakfast Bowl', 'breakfast', '2024-01-15', 'https://example.com/breakfast.jpg']
    );

    const mealResult2 = await pool.query(
      `INSERT INTO meals (user_id, meal_name, meal_type, meal_date, photo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, 'Lunch Plate', 'lunch', '2024-01-15', 'https://example.com/lunch.jpg']
    );

    // Add meal items
    await pool.query(
      `INSERT INTO meal_items (meal_id, food_name, quantity, unit, calories)
       VALUES ($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9)`,
      [mealResult1.rows[0].id, 'Oatmeal', 1, 'pieces', 300, 'Banana', 1, 'pieces', 105]
    );

    await pool.query(
      `INSERT INTO meal_items (meal_id, food_name, quantity, unit, calories)
       VALUES ($1, $2, $3, $4, $5), ($1, $6, $7, $8, $9)`,
      [mealResult2.rows[0].id, 'Chicken', 1, 'pieces', 248, 'Rice', 1, 'pieces', 112]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', ['dashboard@example.com']);
    await pool.end();
  });

  describe('GET /api/dashboard', () => {
    it('should get dashboard for specific date', async () => {
      const response = await request(app)
        .get('/api/dashboard?date=2024-01-15')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('date', '2024-01-15');
      expect(response.body.data).toHaveProperty('daily_goal', 2000);
      expect(response.body.data).toHaveProperty('total_calories');
      expect(response.body.data).toHaveProperty('remaining_calories');
      expect(response.body.data).toHaveProperty('progress_percent');
      expect(response.body.data).toHaveProperty('goal_achieved');
      expect(response.body.data).toHaveProperty('meals');
      expect(Array.isArray(response.body.data.meals)).toBe(true);
      expect(response.body.data.meals.length).toBe(2);

      // Check meal structure
      const firstMeal = response.body.data.meals[0];
      expect(firstMeal).toHaveProperty('meal_type');
      expect(firstMeal).toHaveProperty('photo_url');
      expect(firstMeal).toHaveProperty('foods');
      expect(firstMeal).toHaveProperty('calories');
      expect(Array.isArray(firstMeal.foods)).toBe(true);

      // Check total calories calculation
      const expectedTotal = 300 + 105 + 248 + 112; // 765
      expect(response.body.data.total_calories).toBe(expectedTotal);
      expect(response.body.data.remaining_calories).toBe(2000 - expectedTotal);
      expect(response.body.data.goal_achieved).toBe(true);
    });

    it('should get dashboard for today by default', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('date');
      expect(response.body.data).toHaveProperty('daily_goal');
      expect(response.body.data).toHaveProperty('meals');
    });

    it('should return empty meals for date with no meals', async () => {
      const response = await request(app)
        .get('/api/dashboard?date=2024-12-25')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.meals).toEqual([]);
      expect(response.body.data.total_calories).toBe(0);
      expect(response.body.data.remaining_calories).toBe(2000);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid date format', async () => {
      const response = await request(app)
        .get('/api/dashboard?date=invalid-date')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });
  });
});
