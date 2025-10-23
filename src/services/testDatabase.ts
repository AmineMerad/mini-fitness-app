import { Pool } from 'pg';
import DatabaseService, { initializeDatabase } from './database';

interface TestDbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

class TestDatabaseService {
  private static instance: DatabaseService | null = null;
  private static testDbName = 'fitness_app_test';

  static async createTestDatabase(config?: TestDbConfig): Promise<DatabaseService> {
    const baseConfig = {
      host: config?.host || process.env['TEST_DB_HOST'] || 'localhost',
      port: config?.port || parseInt(process.env['TEST_DB_PORT'] || '5432'),
      user: config?.user || process.env['TEST_DB_USER'] || process.env['USER'] || 'postgres',
      password: config?.password || process.env['TEST_DB_PASSWORD'] || '',
    };

    // First, connect to default postgres database to create test database
    const adminPool = new Pool({
      host: baseConfig.host,
      port: baseConfig.port,
      user: baseConfig.user,
      password: baseConfig.password,
      database: 'postgres',
    });

    try {
      // Drop test database if it exists and create a new one
      await adminPool.query(`DROP DATABASE IF EXISTS ${this.testDbName}`);
      await adminPool.query(`CREATE DATABASE ${this.testDbName}`);
      console.log(`Test database '${this.testDbName}' created successfully`);
    } catch (error) {
      console.error('Failed to create test database:', error);
      throw error;
    } finally {
      await adminPool.end();
    }

    // Now connect to the test database
    const testConnectionString = config?.connectionString ||
      `postgresql://${baseConfig.user}:${baseConfig.password}@${baseConfig.host}:${baseConfig.port}/${this.testDbName}`;

    this.instance = initializeDatabase({
      connectionString: testConnectionString,
      max: 5, // Smaller pool for tests
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
    });

    await this.instance.connect();
    return this.instance;
  }

  static async setupTestDatabase(): Promise<DatabaseService> {
    if (!this.instance) {
      this.instance = await this.createTestDatabase();
    }

    // Run migrations
    await this.instance.runMigrations();
    console.log('Test database migrations completed');

    return this.instance;
  }

  static async seedTestDatabase(): Promise<void> {
    if (!this.instance) {
      throw new Error('Test database not initialized. Call setupTestDatabase() first.');
    }

    await this.instance.runSeeds();
    console.log('Test database seeded successfully');
  }

  static async clearTestDatabase(): Promise<void> {
    if (!this.instance) {
      return;
    }

    // Clear all data but keep schema - using correct tables from current schema
    await this.instance.query('TRUNCATE TABLE calorie_challenge_leaderboard, events, daily_stats, meal_items, meals, users RESTART IDENTITY CASCADE');
    console.log('Test database cleared');
  }

  static async cleanupTestDatabase(): Promise<void> {
    if (this.instance) {
      await this.instance.disconnect();
      this.instance = null;
    }

    // Connect to postgres database to drop test database
    const adminPool = new Pool({
      host: process.env['TEST_DB_HOST'] || 'localhost',
      port: parseInt(process.env['TEST_DB_PORT'] || '5432'),
      user: process.env['TEST_DB_USER'] || process.env['USER'] || 'postgres',
      password: process.env['TEST_DB_PASSWORD'] || '',
      database: 'postgres',
    });

    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${this.testDbName}`);
      console.log(`Test database '${this.testDbName}' dropped successfully`);
    } catch (error) {
      console.error('Failed to drop test database:', error);
    } finally {
      await adminPool.end();
    }
  }

  static getInstance(): DatabaseService {
    if (!this.instance) {
      throw new Error('Test database not initialized. Call setupTestDatabase() first.');
    }
    return this.instance;
  }
}

// Helper functions for testing
export const setupTestDb = async (): Promise<DatabaseService> => {
  return await TestDatabaseService.setupTestDatabase();
};

export const seedTestDb = async (): Promise<void> => {
  await TestDatabaseService.seedTestDatabase();
};

export const clearTestDb = async (): Promise<void> => {
  await TestDatabaseService.clearTestDatabase();
};

export const cleanupTestDb = async (): Promise<void> => {
  await TestDatabaseService.cleanupTestDatabase();
};

export const getTestDb = (): DatabaseService => {
  return TestDatabaseService.getInstance();
};

export default TestDatabaseService;