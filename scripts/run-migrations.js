const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Simple migration script that runs database schema
// This creates all tables automatically on first deploy

async function runMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('==========================================');
  console.log('DATABASE MIGRATION STARTING');
  console.log('==========================================');
  console.log(`Connecting to database...`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✓ Database connection successful');

    // Read schema file
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    console.log(`Reading schema from: ${schemaPath}`);
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove psql-specific commands (like \c, \connect, etc.)
    schema = schema
      .split('\n')
      .filter(line => !line.trim().startsWith('\\'))
      .join('\n');

    // Execute schema
    console.log('Creating database tables...');
    await client.query(schema);
    console.log('✓ Database schema created successfully');

    // Run seeds (use simple seed for production)
    const seedPath = path.join(__dirname, '../db/seed-simple.sql');
    if (fs.existsSync(seedPath)) {
      console.log('Seeding database with test users...');
      let seedData = fs.readFileSync(seedPath, 'utf8');

      // Remove psql-specific commands
      seedData = seedData
        .split('\n')
        .filter(line => !line.trim().startsWith('\\'))
        .join('\n');

      try {
        await client.query(seedData);
        console.log('✓ Database seeded successfully');
        console.log('');
        console.log('Test users available:');
        console.log('  📧 user1@example.com / password123');
        console.log('  📧 user2@example.com / password123');
      } catch (seedError) {
        console.log('⚠ Seed failed (users may already exist):', seedError.message);
      }
    } else {
      console.log('⚠ No seed file found, skipping seeds');
    }

    console.log('==========================================');
    console.log('MIGRATION COMPLETED');
    console.log('==========================================');

    client.release();
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('==========================================');
    console.error('MIGRATION FAILED');
    console.error('==========================================');
    console.error('Error details:', error.message);

    // Don't fail the build if tables already exist
    if (error.message && error.message.includes('already exists')) {
      console.log('Tables already exist - skipping migration');
      await pool.end();
      process.exit(0);
    }

    await pool.end();
    process.exit(1);
  }
}

runMigrations();
