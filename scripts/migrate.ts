#!/usr/bin/env ts-node

import { initializeDatabase } from '../src/services/database';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  console.log('🚀 Starting database migrations...');

  try {
    const db = initializeDatabase();
    await db.connect();

    console.log('✅ Connected to database');

    await db.runMigrations();
    console.log('✅ Migrations completed successfully');

    await db.disconnect();
    console.log('✅ Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function runSeeds() {
  console.log('🌱 Starting database seeding...');

  try {
    const db = initializeDatabase();
    await db.connect();

    console.log('✅ Connected to database');

    await db.runSeeds();
    console.log('✅ Seeding completed successfully');

    await db.disconnect();
    console.log('✅ Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

async function resetDatabase() {
  console.log('🔄 Resetting database (migrations + seeds)...');

  try {
    const db = initializeDatabase();
    await db.connect();

    console.log('✅ Connected to database');

    await db.runMigrations();
    console.log('✅ Migrations completed');

    await db.runSeeds();
    console.log('✅ Seeding completed');

    await db.disconnect();
    console.log('✅ Database connection closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
  case 'migrate':
    runMigrations();
    break;
  case 'seed':
    runSeeds();
    break;
  case 'reset':
    resetDatabase();
    break;
  default:
    console.log(`
Usage: npm run db:migrate [command]

Commands:
  migrate  Run database migrations
  seed     Run database seeds
  reset    Run migrations and seeds

Examples:
  npm run db:migrate migrate
  npm run db:migrate seed
  npm run db:migrate reset
`);
    process.exit(1);
}