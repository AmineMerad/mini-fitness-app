import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';

interface DbConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;

  constructor(config: DbConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  static getInstance(config?: DbConfig): DatabaseService {
    if (!DatabaseService.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('Database connection pool closed');
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Query error:', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async runMigrations(): Promise<void> {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      // Split SQL by semicolons, but preserve dollar-quoted strings ($$)
      const statements: string[] = [];
      let currentStatement = '';
      let inDollarQuote = false;

      for (let i = 0; i < schemaSQL.length; i++) {
        const char = schemaSQL[i];
        const nextChar = schemaSQL[i + 1];

        if (char === '$' && nextChar === '$') {
          inDollarQuote = !inDollarQuote;
          currentStatement += '$$';
          i++; // Skip next $
        } else if (char === ';' && !inDollarQuote) {
          const stmt = currentStatement.trim();
          if (stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('\\')) {
            statements.push(stmt);
          }
          currentStatement = '';
        } else {
          currentStatement += char;
        }
      }

      // Add last statement if any
      const lastStmt = currentStatement.trim();
      if (lastStmt.length > 0 && !lastStmt.startsWith('--') && !lastStmt.startsWith('\\')) {
        statements.push(lastStmt);
      }

      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }

      await client.query('COMMIT');
      console.log('Database migrations completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async runSeeds(): Promise<void> {
    const seedPath = path.join(process.cwd(), 'db', 'seed.sql');

    if (!fs.existsSync(seedPath)) {
      console.log('No seed file found, skipping seeds');
      return;
    }

    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      const statements = seedSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('\\'));

      for (const statement of statements) {
        if (statement.trim()) {
          await client.query(statement);
        }
      }

      await client.query('COMMIT');
      console.log('Database seeds completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Seeding failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // User CRUD operations
  async createUser(username: string, email: string, passwordHash: string, dailyCalorieGoal = 2000) {
    const query = `
      INSERT INTO users (username, email, password_hash, daily_calorie_goal)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, daily_calorie_goal, created_at, updated_at
    `;
    const result = await this.query(query, [username, email, passwordHash, dailyCalorieGoal]);
    return result.rows[0];
  }

  async getUserById(id: string) {
    const query = `
      SELECT id, username, email, daily_calorie_goal, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string) {
    const query = `
      SELECT id, username, email, password_hash, daily_calorie_goal, created_at, updated_at
      FROM users
      WHERE username = $1
    `;
    const result = await this.query(query, [username]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string) {
    const query = `
      SELECT id, username, email, password_hash, daily_calorie_goal, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    const result = await this.query(query, [email]);
    return result.rows[0] || null;
  }

  async updateUser(id: string, updates: { username?: string; email?: string; passwordHash?: string; dailyCalorieGoal?: number }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.username) {
      fields.push(`username = $${paramCount++}`);
      values.push(updates.username);
    }
    if (updates.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }
    if (updates.passwordHash) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(updates.passwordHash);
    }
    if (updates.dailyCalorieGoal !== undefined) {
      fields.push(`daily_calorie_goal = $${paramCount++}`);
      values.push(updates.dailyCalorieGoal);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, daily_calorie_goal, created_at, updated_at
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async deleteUser(id: string) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await this.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Meal CRUD operations
  async createMeal(userId: string, mealName: string, mealType: string, mealDate: Date, photoUrl?: string) {
    const query = `
      INSERT INTO meals (user_id, meal_name, meal_type, meal_date, photo_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, meal_name, meal_type, meal_date, photo_url, created_at, updated_at
    `;
    const result = await this.query(query, [userId, mealName, mealType, mealDate, photoUrl || null]);
    return result.rows[0];
  }

  async getMealById(id: string) {
    const query = `
      SELECT m.*, u.username
      FROM meals m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getMealsByUserId(userId: string, limit = 50, offset = 0) {
    const query = `
      SELECT id, user_id, meal_name, meal_type, meal_date, photo_url, created_at, updated_at
      FROM meals
      WHERE user_id = $1
      ORDER BY meal_date DESC, created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getMealsByUserAndDate(userId: string, mealDate: Date) {
    const query = `
      SELECT id, user_id, meal_name, meal_type, meal_date, photo_url, created_at, updated_at
      FROM meals
      WHERE user_id = $1 AND meal_date = $2
      ORDER BY
        CASE meal_type
          WHEN 'breakfast' THEN 1
          WHEN 'lunch' THEN 2
          WHEN 'dinner' THEN 3
          WHEN 'snack' THEN 4
        END,
        created_at
    `;
    const result = await this.query(query, [userId, mealDate]);
    return result.rows;
  }

  async updateMeal(id: string, updates: { mealName?: string; mealType?: string; mealDate?: Date; photoUrl?: string }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.mealName) {
      fields.push(`meal_name = $${paramCount++}`);
      values.push(updates.mealName);
    }
    if (updates.mealType) {
      fields.push(`meal_type = $${paramCount++}`);
      values.push(updates.mealType);
    }
    if (updates.mealDate) {
      fields.push(`meal_date = $${paramCount++}`);
      values.push(updates.mealDate);
    }
    if (updates.photoUrl !== undefined) {
      fields.push(`photo_url = $${paramCount++}`);
      values.push(updates.photoUrl);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE meals
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, user_id, meal_name, meal_type, meal_date, photo_url, created_at, updated_at
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async deleteMeal(id: string) {
    const query = 'DELETE FROM meals WHERE id = $1 RETURNING id';
    const result = await this.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Meal Item CRUD operations
  async createMealItem(
    mealId: string,
    foodName: string,
    quantity: number,
    unit: string,
    calories: number,
    protein = 0,
    carbs = 0,
    fat = 0,
    source = 'manual_entry',
    confidence?: number
  ) {
    const query = `
      INSERT INTO meal_items (meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at
    `;
    const result = await this.query(query, [
      mealId, foodName, quantity, unit, calories, protein, carbs, fat, source, confidence || null
    ]);
    return result.rows[0];
  }

  async getMealItemById(id: string) {
    const query = `
      SELECT mi.*, m.meal_name, m.meal_type, m.meal_date, u.username
      FROM meal_items mi
      JOIN meals m ON mi.meal_id = m.id
      JOIN users u ON m.user_id = u.id
      WHERE mi.id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getMealItemsByMealId(mealId: string) {
    const query = `
      SELECT id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at
      FROM meal_items
      WHERE meal_id = $1
      ORDER BY created_at
    `;
    const result = await this.query(query, [mealId]);
    return result.rows;
  }

  async updateMealItem(
    id: string,
    updates: {
      foodName?: string;
      quantity?: number;
      unit?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      source?: string;
      confidence?: number;
    }
  ) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.foodName) {
      fields.push(`food_name = $${paramCount++}`);
      values.push(updates.foodName);
    }
    if (updates.quantity !== undefined) {
      fields.push(`quantity = $${paramCount++}`);
      values.push(updates.quantity);
    }
    if (updates.unit) {
      fields.push(`unit = $${paramCount++}`);
      values.push(updates.unit);
    }
    if (updates.calories !== undefined) {
      fields.push(`calories = $${paramCount++}`);
      values.push(updates.calories);
    }
    if (updates.protein !== undefined) {
      fields.push(`protein = $${paramCount++}`);
      values.push(updates.protein);
    }
    if (updates.carbs !== undefined) {
      fields.push(`carbs = $${paramCount++}`);
      values.push(updates.carbs);
    }
    if (updates.fat !== undefined) {
      fields.push(`fat = $${paramCount++}`);
      values.push(updates.fat);
    }
    if (updates.source) {
      fields.push(`source = $${paramCount++}`);
      values.push(updates.source);
    }
    if (updates.confidence !== undefined) {
      fields.push(`confidence = $${paramCount++}`);
      values.push(updates.confidence);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE meal_items
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async deleteMealItem(id: string) {
    const query = 'DELETE FROM meal_items WHERE id = $1 RETURNING id';
    const result = await this.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Daily Stats operations
  async getDailyStats(userId: string, statsDate: Date) {
    const query = `
      SELECT id, user_id, stats_date, total_calories, meals_logged, goal_achieved, created_at, updated_at
      FROM daily_stats
      WHERE user_id = $1 AND stats_date = $2
    `;
    const result = await this.query(query, [userId, statsDate]);
    return result.rows[0] || null;
  }

  async getDailyStatsRange(userId: string, startDate: Date, endDate: Date) {
    const query = `
      SELECT id, user_id, stats_date, total_calories, meals_logged, goal_achieved, created_at, updated_at
      FROM daily_stats
      WHERE user_id = $1 AND stats_date BETWEEN $2 AND $3
      ORDER BY stats_date DESC
    `;
    const result = await this.query(query, [userId, startDate, endDate]);
    return result.rows;
  }

  async getUserDailySummary(userId: string, limit = 30) {
    const query = `
      SELECT * FROM user_daily_summary
      WHERE id = $1
      ORDER BY stats_date DESC
      LIMIT $2
    `;
    const result = await this.query(query, [userId, limit]);
    return result.rows;
  }

  // Event CRUD operations
  async createEvent(eventName: string, eventStartDate: Date, eventEndDate: Date, eventType: string, dailyTarget: number) {
    const query = `
      INSERT INTO events (event_name, event_start_date, event_end_date, event_type, daily_target)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at
    `;
    const result = await this.query(query, [eventName, eventStartDate, eventEndDate, eventType, dailyTarget]);
    return result.rows[0];
  }

  async getEventById(id: string) {
    const query = `
      SELECT id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at
      FROM events
      WHERE id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  async getAllEvents(limit = 50, offset = 0) {
    const query = `
      SELECT id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at
      FROM events
      ORDER BY event_start_date DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await this.query(query, [limit, offset]);
    return result.rows;
  }

  async getActiveEvents() {
    const query = `
      SELECT id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at
      FROM events
      WHERE event_start_date <= CURRENT_DATE AND event_end_date >= CURRENT_DATE
      ORDER BY event_start_date
    `;
    const result = await this.query(query);
    return result.rows;
  }

  async updateEvent(id: string, updates: { eventName?: string; eventStartDate?: Date; eventEndDate?: Date; eventType?: string; dailyTarget?: number }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.eventName) {
      fields.push(`event_name = $${paramCount++}`);
      values.push(updates.eventName);
    }
    if (updates.eventStartDate) {
      fields.push(`event_start_date = $${paramCount++}`);
      values.push(updates.eventStartDate);
    }
    if (updates.eventEndDate) {
      fields.push(`event_end_date = $${paramCount++}`);
      values.push(updates.eventEndDate);
    }
    if (updates.eventType) {
      fields.push(`event_type = $${paramCount++}`);
      values.push(updates.eventType);
    }
    if (updates.dailyTarget !== undefined) {
      fields.push(`daily_target = $${paramCount++}`);
      values.push(updates.dailyTarget);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE events
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  async deleteEvent(id: string) {
    const query = 'DELETE FROM events WHERE id = $1 RETURNING id';
    const result = await this.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Event Participants operations
  async joinEvent(eventId: string, userId: string) {
    const query = `
      INSERT INTO event_participants (event_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (event_id, user_id) DO NOTHING
      RETURNING id, event_id, user_id, joined_date, created_at
    `;
    const result = await this.query(query, [eventId, userId]);
    return result.rows[0] || null;
  }

  async leaveEvent(eventId: string, userId: string) {
    const query = 'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2 RETURNING id';
    const result = await this.query(query, [eventId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getEventParticipants(eventId: string) {
    const query = `
      SELECT ep.id, ep.joined_date, u.id as user_id, u.username, u.email
      FROM event_participants ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = $1
      ORDER BY ep.joined_date
    `;
    const result = await this.query(query, [eventId]);
    return result.rows;
  }

  async getUserEvents(userId: string) {
    const query = `
      SELECT e.*, ep.joined_date
      FROM events e
      JOIN event_participants ep ON e.id = ep.event_id
      WHERE ep.user_id = $1
      ORDER BY e.event_start_date DESC
    `;
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  // Utility methods
  async getCalorieChallengeLeaderboard(limit = 10) {
    const query = `
      SELECT * FROM calorie_challenge_leaderboard
      LIMIT $1
    `;
    const result = await this.query(query, [limit]);
    return result.rows;
  }

  async getMealNutritionSummary(userId?: string, limit = 20) {
    let query = `
      SELECT * FROM meal_nutrition_summary
    `;
    const params = [];

    if (userId) {
      query += ` WHERE meal_id IN (SELECT id FROM meals WHERE user_id = $1)`;
      params.push(userId);
    }

    query += ` ORDER BY meal_date DESC, total_calories DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  async searchFoodItems(searchTerm: string, limit = 10) {
    const query = `
      SELECT
        food_name,
        AVG(calories) as avg_calories,
        AVG(protein) as avg_protein,
        AVG(carbs) as avg_carbs,
        AVG(fat) as avg_fat,
        COUNT(*) as usage_count,
        ARRAY_AGG(DISTINCT unit) as common_units
      FROM meal_items
      WHERE food_name ILIKE $1
      GROUP BY food_name
      ORDER BY usage_count DESC, food_name
      LIMIT $2
    `;
    const result = await this.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }

  async getUserStreakData(userId: string) {
    const query = `
      WITH daily_goals AS (
        SELECT
          stats_date,
          goal_achieved,
          LAG(goal_achieved) OVER (ORDER BY stats_date) as prev_goal_achieved
        FROM daily_stats
        WHERE user_id = $1 AND stats_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY stats_date
      ),
      streak_groups AS (
        SELECT
          stats_date,
          goal_achieved,
          SUM(CASE WHEN goal_achieved != prev_goal_achieved OR prev_goal_achieved IS NULL THEN 1 ELSE 0 END)
            OVER (ORDER BY stats_date) as streak_group
        FROM daily_goals
      )
      SELECT
        MIN(stats_date) as streak_start,
        MAX(stats_date) as streak_end,
        COUNT(*) as streak_length,
        goal_achieved
      FROM streak_groups
      GROUP BY streak_group, goal_achieved
      ORDER BY streak_start DESC
    `;
    const result = await this.query(query, [userId]);
    return result.rows;
  }
}

// Initialize database service
export const initializeDatabase = (config?: DbConfig) => {
  const dbConfig = config || {
    connectionString: process.env['DATABASE_URL'] || 'postgresql://postgres:password@localhost:5432/fitness_app'
  };

  return DatabaseService.getInstance(dbConfig);
};

export default DatabaseService;