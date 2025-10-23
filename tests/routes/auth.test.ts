import request from 'supertest';
import app from '../../src/app';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'] || `postgresql://${process.env['USER'] || 'postgres'}@localhost:5432/fitness_app_test`,
});

describe('Auth Routes', () => {
  beforeAll(async () => {
    // Clean up and seed test users
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);

    const hashedPassword = await bcrypt.hash('password123', 10);
    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, daily_calorie_goal)
       VALUES ($1, $2, $3, $4, $5)`,
      ['550e8400-e29b-41d4-a716-446655440099', 'testuser', 'test@example.com', hashedPassword, 2000]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test%@example.com']);
    await pool.end();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('username', 'testuser');
      expect(response.body.data).toHaveProperty('daily_calorie_goal', 2000);
    });

    it('should fail with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should fail with user not found', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should fail with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should fail with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });
  });
});
