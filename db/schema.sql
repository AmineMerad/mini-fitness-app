-- Calorie Tracking Fitness App Database Schema

\c fitness_app;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS calorie_challenge_leaderboard CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS meal_items CASCADE;
DROP TABLE IF EXISTS meals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    daily_calorie_goal INTEGER DEFAULT 2000 CHECK (daily_calorie_goal > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_name VARCHAR(255) NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    meal_date DATE NOT NULL,
    photo_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE meal_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(8,2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL CHECK (unit IN ('grams', 'ml', 'pieces', 'cups', 'tbsp', 'tsp')),
    calories DECIMAL(8,2) NOT NULL CHECK (calories >= 0),
    protein DECIMAL(8,2) DEFAULT 0 CHECK (protein >= 0),
    carbs DECIMAL(8,2) DEFAULT 0 CHECK (carbs >= 0),
    fat DECIMAL(8,2) DEFAULT 0 CHECK (fat >= 0),
    source VARCHAR(20) NOT NULL DEFAULT 'manual_entry' CHECK (source IN ('ocr_detected', 'manual_entry')),
    confidence DECIMAL(4,3) CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stats_date DATE NOT NULL,
    total_calories DECIMAL(8,2) DEFAULT 0 CHECK (total_calories >= 0),
    meals_logged INTEGER DEFAULT 0 CHECK (meals_logged >= 0),
    goal_achieved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stats_date)
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name VARCHAR(255) NOT NULL,
    event_start_date DATE NOT NULL,
    event_end_date DATE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    daily_target INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calorie_challenge_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL,
    total_calories DECIMAL(8,2) DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, challenge_date)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_meals_user_id ON meals(user_id);
CREATE INDEX idx_meals_meal_date ON meals(meal_date);
CREATE INDEX idx_meals_user_date ON meals(user_id, meal_date DESC);
CREATE INDEX idx_meal_items_meal_id ON meal_items(meal_id);
CREATE INDEX idx_daily_stats_user_id ON daily_stats(user_id);
CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, stats_date DESC);
CREATE INDEX idx_events_event_start_date ON events(event_start_date);
CREATE INDEX idx_calorie_challenge_user_date ON calorie_challenge_leaderboard(user_id, challenge_date DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON meals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_stats_updated_at BEFORE UPDATE ON daily_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_daily_stats_for_meal()
RETURNS TRIGGER AS $$
DECLARE
    v_meal_date DATE;
    v_meal_user_id UUID;
    v_total_cals DECIMAL(8,2);
    v_meal_count INTEGER;
    v_user_goal INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT m.meal_date, m.user_id INTO v_meal_date, v_meal_user_id FROM meals m WHERE m.id = OLD.meal_id;
    ELSE
        SELECT m.meal_date, m.user_id INTO v_meal_date, v_meal_user_id FROM meals m WHERE m.id = NEW.meal_id;
    END IF;

    -- Skip if user_id is null (happens during CASCADE DELETE)
    IF v_meal_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(mi.calories), 0) INTO v_total_cals
    FROM meal_items mi JOIN meals m ON mi.meal_id = m.id
    WHERE m.user_id = v_meal_user_id AND m.meal_date = v_meal_date;

    SELECT COUNT(DISTINCT m.id) INTO v_meal_count FROM meals m
    WHERE m.user_id = v_meal_user_id AND m.meal_date = v_meal_date;

    SELECT daily_calorie_goal INTO v_user_goal FROM users WHERE id = v_meal_user_id;

    -- Skip if user no longer exists (CASCADE DELETE scenario)
    IF v_user_goal IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO daily_stats (user_id, stats_date, total_calories, meals_logged, goal_achieved)
    VALUES (v_meal_user_id, v_meal_date, v_total_cals, v_meal_count, v_total_cals <= v_user_goal)
    ON CONFLICT (user_id, stats_date)
    DO UPDATE SET total_calories = EXCLUDED.total_calories, meals_logged = EXCLUDED.meals_logged,
                  goal_achieved = EXCLUDED.goal_achieved, updated_at = CURRENT_TIMESTAMP;

    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_stats_on_meal_item_change
    AFTER INSERT OR UPDATE OR DELETE ON meal_items
    FOR EACH ROW EXECUTE FUNCTION update_daily_stats_for_meal();
