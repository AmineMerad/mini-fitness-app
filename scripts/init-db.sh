#!/bin/bash

# Database initialization script for fitness app
# Make sure PostgreSQL is running before executing

set -e

DB_NAME="fitness_app"
DB_USER=${DB_USER:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

echo "🚀 Initializing fitness app database..."

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo "Please start PostgreSQL and try again"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database if it doesn't exist
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "📦 Creating database '$DB_NAME'..."
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo "✅ Database '$DB_NAME' created"
else
    echo "ℹ️  Database '$DB_NAME' already exists"
fi

# Run migrations
echo "🔧 Running database migrations..."
export DATABASE_URL="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
npm run db:migrate migrate

echo "🌱 Running database seeds..."
npm run db:migrate seed

echo "✅ Database initialization completed!"
echo ""
echo "Database connection string: postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "You can now start the application with: npm run dev"