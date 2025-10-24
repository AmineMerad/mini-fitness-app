# Mini Fitness App - Calorie Tracking

A TypeScript Express.js calorie tracking fitness application with PostgreSQL database, meal photo analysis, and leaderboard competitions.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL (v12+)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database and API credentials
   ```

3. **Initialize the database:**
   ```bash
   npm run db:init
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`

## 🗄️ Database Setup

### Manual Setup

If you prefer to set up the database manually:

```bash
# Create database
createdb fitness_app

# Run schema
npm run db:schema

# Seed with test data
npm run db:seed
```

### Available Database Commands

```bash
npm run db:init          # Complete database setup (recommended)
npm run db:migrate migrate # Run migrations only
npm run db:migrate seed    # Run seeds only
npm run db:migrate reset   # Run migrations + seeds
npm run db:schema        # Run schema.sql directly
npm run db:seed          # Run seed.sql directly
```

## 🏗️ Project Structure

```
mini-fitness-app/
├── src/
│   ├── routes/          # API routes (auth, meals, leaderboard)
│   ├── services/        # Business logic services
│   │   ├── database.ts      # Main database service
│   │   └── testDatabase.ts  # Test database utilities
│   ├── models/          # Data models
│   ├── middleware/      # Express middleware
│   └── app.ts          # Main application
├── db/
│   ├── schema.sql      # Database schema
│   └── seed.sql        # Test data
├── tests/
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── scripts/
│   ├── migrate.ts      # Migration runner
│   └── init-db.sh      # Database initialization
└── .github/workflows/  # CI/CD pipelines
```

## 📊 Database Schema

### Core Tables

1. **users** - User accounts with calorie goals
   - `id` (UUID, PK)
   - `username` (VARCHAR, UNIQUE)
   - `email` (VARCHAR, UNIQUE)
   - `password_hash` (VARCHAR)
   - `daily_calorie_goal` (INTEGER, default 2000)
   - `created_at`, `updated_at` (TIMESTAMP)

2. **meals** - Daily meal entries
   - `id` (UUID, PK)
   - `user_id` (UUID, FK to users)
   - `meal_name` (VARCHAR)
   - `meal_type` (VARCHAR: breakfast/lunch/dinner/snack)
   - `meal_date` (DATE)
   - `photo_url` (VARCHAR, from Cloudflare CDN)
   - `created_at`, `updated_at` (TIMESTAMP)

3. **meal_items** - Individual food items in meals
   - `id` (UUID, PK)
   - `meal_id` (UUID, FK to meals)
   - `food_name` (VARCHAR)
   - `quantity` (DECIMAL)
   - `unit` (VARCHAR: grams/ml/pieces/cups/tbsp/tsp)
   - `calories` (DECIMAL)
   - `protein`, `carbs`, `fat` (DECIMAL)
   - `source` (VARCHAR: ocr_detected/manual_entry)
   - `confidence` (DECIMAL, 0-1 for OCR confidence)
   - `created_at` (TIMESTAMP)

4. **daily_stats** - Aggregated daily statistics
   - `id` (UUID, PK)
   - `user_id` (UUID, FK to users)
   - `stats_date` (DATE, UNIQUE per user)
   - `total_calories` (DECIMAL)
   - `meals_logged` (INTEGER)
   - `goal_achieved` (BOOLEAN)
   - `created_at`, `updated_at` (TIMESTAMP)

5. **events** - Fitness challenges/competitions
   - `id` (UUID, PK)
   - `event_name` (VARCHAR)
   - `event_start_date`, `event_end_date` (DATE)
   - `event_type` (VARCHAR: calorie_challenge/step_goal)
   - `daily_target` (INTEGER)
   - `created_at`, `updated_at` (TIMESTAMP)

6. **event_participants** - Users participating in events
   - `id` (UUID, PK)
   - `event_id` (UUID, FK to events)
   - `user_id` (UUID, FK to users)
   - `joined_date` (DATE)
   - `created_at` (TIMESTAMP)

### Key Features

- **Automatic Statistics**: Daily stats are automatically calculated via database triggers when meal items are added/updated/deleted
- **Optimized Indexes**: Strategic indexes on user_id, meal_date, stats_date for fast queries
- **Data Integrity**: Comprehensive check constraints and foreign keys
- **UUID Primary Keys**: For better scalability and security
- **Audit Trails**: Created/updated timestamps on all core tables

### Views

- **user_daily_summary** - User daily calorie summary with goal status
- **calorie_challenge_leaderboard** - 30-day success rate leaderboard
- **meal_nutrition_summary** - Aggregated nutrition data per meal

### Automatic Features

- **Daily Stats Updates**: Triggers automatically recalculate daily totals when meal items change
- **Goal Achievement**: Automatically tracks if users stay under their daily calorie goal
- **Updated Timestamps**: Auto-updating timestamps on record modifications

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Database

The application uses a separate test database (`fitness_app_test`) that is automatically created and managed by the test utilities.

## 🛠️ Development Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run typecheck        # Run TypeScript type checking
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
```

## 🌐 API Endpoints

- `GET /health` - Health check endpoint




## 🍽️ Application Features

### Calorie Tracking
- **Photo-based Food Logging**: Users upload meal photos for automatic calorie detection
- **Manual Food Entry**: Manual nutrition data entry with auto-complete from previous entries
- **Daily Goal Tracking**: Customizable daily calorie goals with achievement tracking
- **Meal Categorization**: Breakfast, lunch, dinner, and snack categorization

### Nutrition Analysis
- **OCR Food Detection**: AI-powered food recognition from photos
- **Detailed Macros**: Track calories, protein, carbs, and fat
- **Confidence Scoring**: OCR confidence levels for detected foods
- **Food Database**: Built-in food database from user entries

### Leaderboard & Competitions
- **Success Rate Rankings**: Users ranked by % of days achieving calorie goals
- **Challenge Events**: Time-limited calorie challenges
- **Progress Streaks**: Track consecutive days of goal achievement
- **Social Features**: See how you compare to other users

### Analytics & Insights
- **Daily Statistics**: Automated daily calorie and meal tracking
- **Progress Trends**: Historical data analysis
- **Goal Achievement**: Track success rates over time
- **Nutrition Breakdowns**: Detailed macro nutrient analysis

## 🚀 Deployment

### Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set production environment variables

3. Run database migrations:
   ```bash
   NODE_ENV=production npm run db:migrate migrate
   ```

4. Start the server:
   ```bash
   npm start
   ```

## 📈 Database Performance

- **Efficient Indexing**: Optimized for common query patterns
- **Automatic Statistics**: Real-time daily stats updates via triggers
- **Pagination Support**: Built-in pagination for large datasets
- **Connection Pooling**: Optimized database connection management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📝 License

MIT License
