import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';

const router = Router();

// Database connection
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limiter: 10 attempts per 15 minutes per email
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use email from request body as key (no IP-based limiting to avoid IPv6 issues)
  keyGenerator: (req: Request): string => {
    return req.body.email || 'unknown';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts, please try again after 15 minutes',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Fetch user from database
    const userQuery = await pool.query(
      'SELECT id, username, email, password_hash, daily_calorie_goal FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userQuery.rows.length === 0) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const user = userQuery.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check JWT_SECRET is configured
    const jwtSecret = process.env["JWT_SECRET"];
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      res.status(500).json({
        success: false,
        error: 'Server configuration error',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Generate JWT token with 7-day expiry
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Return success response
    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        token,
        daily_calorie_goal: user.daily_calorie_goal
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
