-- Seed data for calorie tracking fitness app
-- Run with: psql -U postgres -d fitness_app -f db/seed.sql

\c fitness_app;

-- Clear existing data
TRUNCATE TABLE event_participants, daily_stats, meal_items, meals, events, users RESTART IDENTITY CASCADE;

-- Insert test users
INSERT INTO users (id, username, email, password_hash, daily_calorie_goal, created_at, updated_at) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'user1',
    'user1@example.com',
    '$2b$10$L9BaJV8DCF.3faVW0Yc.HO6Xm5aO1m7twu/WXCKfk/gjXyvOBuGn2', -- hashed 'password123'
    2000,
    '2024-01-15 10:30:00+00',
    '2024-01-15 10:30:00+00'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'user2',
    'user2@example.com',
    '$2b$10$hVfSVmES5/XT6LHCxvYiwOWXs26qhBh9EauhlyKXnK911.r.SYrY2', -- hashed 'password123'
    1800,
    '2024-01-16 14:45:00+00',
    '2024-01-16 14:45:00+00'
);

-- Insert test events
INSERT INTO events (id, event_name, event_start_date, event_end_date, event_type, daily_target, created_at, updated_at) VALUES
(
    '660e8400-e29b-41d4-a716-446655440001',
    'January Calorie Challenge',
    '2024-01-01',
    '2024-01-31',
    'calorie_challenge',
    2000,
    '2023-12-25 12:00:00+00',
    '2023-12-25 12:00:00+00'
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    'Healthy February',
    '2024-02-01',
    '2024-02-29',
    'calorie_challenge',
    1900,
    '2024-01-25 12:00:00+00',
    '2024-01-25 12:00:00+00'
);

-- Insert event participants
INSERT INTO event_participants (id, event_id, user_id, joined_date, created_at) VALUES
(
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001', -- January Challenge
    '550e8400-e29b-41d4-a716-446655440001', -- john_fitness
    '2024-01-01',
    '2024-01-01 09:00:00+00'
),
(
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440001', -- January Challenge
    '550e8400-e29b-41d4-a716-446655440002', -- jane_tracker
    '2024-01-02',
    '2024-01-02 10:00:00+00'
),
(
    '770e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440002', -- February Challenge
    '550e8400-e29b-41d4-a716-446655440002', -- jane_tracker
    '2024-02-01',
    '2024-02-01 08:00:00+00'
);

-- Insert test meals
INSERT INTO meals (id, user_id, meal_name, meal_type, meal_date, photo_url, created_at, updated_at) VALUES
(
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001', -- john_fitness
    'Healthy Breakfast Bowl',
    'breakfast',
    '2024-01-15',
    'https://cdn.example.com/photos/john_breakfast_1.jpg',
    '2024-01-15 08:00:00+00',
    '2024-01-15 08:00:00+00'
),
(
    '880e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001', -- john_fitness
    'Grilled Chicken Lunch',
    'lunch',
    '2024-01-15',
    'https://cdn.example.com/photos/john_lunch_1.jpg',
    '2024-01-15 12:30:00+00',
    '2024-01-15 12:30:00+00'
),
(
    '880e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440002', -- jane_tracker
    'Greek Yogurt Parfait',
    'breakfast',
    '2024-01-16',
    'https://cdn.example.com/photos/jane_breakfast_1.jpg',
    '2024-01-16 07:45:00+00',
    '2024-01-16 07:45:00+00'
),
(
    '880e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440001', -- john_fitness
    'Protein Smoothie',
    'snack',
    '2024-01-16',
    NULL,
    '2024-01-16 15:00:00+00',
    '2024-01-16 15:00:00+00'
);

-- Insert meal items for John's breakfast
INSERT INTO meal_items (id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at) VALUES
(
    '990e8400-e29b-41d4-a716-446655440001',
    '880e8400-e29b-41d4-a716-446655440001', -- Healthy Breakfast Bowl
    'Oatmeal',
    80,
    'grams',
    300,
    10.5,
    54.0,
    6.2,
    'ocr_detected',
    0.92,
    '2024-01-15 08:00:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440002',
    '880e8400-e29b-41d4-a716-446655440001', -- Healthy Breakfast Bowl
    'Blueberries',
    50,
    'grams',
    28,
    0.4,
    7.4,
    0.2,
    'ocr_detected',
    0.88,
    '2024-01-15 08:00:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440003',
    '880e8400-e29b-41d4-a716-446655440001', -- Healthy Breakfast Bowl
    'Almonds',
    15,
    'grams',
    87,
    3.2,
    3.2,
    7.5,
    'manual_entry',
    NULL,
    '2024-01-15 08:00:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440004',
    '880e8400-e29b-41d4-a716-446655440001', -- Healthy Breakfast Bowl
    'Honey',
    1,
    'tbsp',
    64,
    0.1,
    17.3,
    0.0,
    'manual_entry',
    NULL,
    '2024-01-15 08:00:00+00'
);

-- Insert meal items for John's lunch
INSERT INTO meal_items (id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at) VALUES
(
    '990e8400-e29b-41d4-a716-446655440005',
    '880e8400-e29b-41d4-a716-446655440002', -- Grilled Chicken Lunch
    'Grilled Chicken Breast',
    150,
    'grams',
    248,
    46.2,
    0.0,
    5.4,
    'ocr_detected',
    0.95,
    '2024-01-15 12:30:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440006',
    '880e8400-e29b-41d4-a716-446655440002', -- Grilled Chicken Lunch
    'Brown Rice',
    100,
    'grams',
    112,
    2.6,
    22.0,
    0.9,
    'manual_entry',
    NULL,
    '2024-01-15 12:30:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440007',
    '880e8400-e29b-41d4-a716-446655440002', -- Grilled Chicken Lunch
    'Steamed Broccoli',
    100,
    'grams',
    34,
    2.8,
    7.0,
    0.4,
    'manual_entry',
    NULL,
    '2024-01-15 12:30:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440008',
    '880e8400-e29b-41d4-a716-446655440002', -- Grilled Chicken Lunch
    'Olive Oil',
    1,
    'tbsp',
    119,
    0.0,
    0.0,
    13.5,
    'manual_entry',
    NULL,
    '2024-01-15 12:30:00+00'
);

-- Insert meal items for Jane's breakfast
INSERT INTO meal_items (id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at) VALUES
(
    '990e8400-e29b-41d4-a716-446655440009',
    '880e8400-e29b-41d4-a716-446655440003', -- Greek Yogurt Parfait
    'Greek Yogurt',
    150,
    'grams',
    100,
    17.0,
    6.0,
    0.4,
    'ocr_detected',
    0.93,
    '2024-01-16 07:45:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440010',
    '880e8400-e29b-41d4-a716-446655440003', -- Greek Yogurt Parfait
    'Granola',
    30,
    'grams',
    140,
    4.1,
    18.0,
    6.0,
    'ocr_detected',
    0.85,
    '2024-01-16 07:45:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440011',
    '880e8400-e29b-41d4-a716-446655440003', -- Greek Yogurt Parfait
    'Mixed Berries',
    75,
    'grams',
    43,
    0.5,
    10.2,
    0.3,
    'manual_entry',
    NULL,
    '2024-01-16 07:45:00+00'
);

-- Insert meal items for John's snack
INSERT INTO meal_items (id, meal_id, food_name, quantity, unit, calories, protein, carbs, fat, source, confidence, created_at) VALUES
(
    '990e8400-e29b-41d4-a716-446655440012',
    '880e8400-e29b-41d4-a716-446655440004', -- Protein Smoothie
    'Protein Powder',
    1,
    'pieces',
    120,
    25.0,
    3.0,
    1.5,
    'manual_entry',
    NULL,
    '2024-01-16 15:00:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440013',
    '880e8400-e29b-41d4-a716-446655440004', -- Protein Smoothie
    'Banana',
    1,
    'pieces',
    105,
    1.3,
    27.0,
    0.4,
    'manual_entry',
    NULL,
    '2024-01-16 15:00:00+00'
),
(
    '990e8400-e29b-41d4-a716-446655440014',
    '880e8400-e29b-41d4-a716-446655440004', -- Protein Smoothie
    'Almond Milk',
    250,
    'ml',
    20,
    0.8,
    3.2,
    1.1,
    'manual_entry',
    NULL,
    '2024-01-16 15:00:00+00'
);

-- Verify the seed data
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Events' as table_name, COUNT(*) as count FROM events
UNION ALL
SELECT 'Event Participants' as table_name, COUNT(*) as count FROM event_participants
UNION ALL
SELECT 'Meals' as table_name, COUNT(*) as count FROM meals
UNION ALL
SELECT 'Meal Items' as table_name, COUNT(*) as count FROM meal_items
UNION ALL
SELECT 'Daily Stats' as table_name, COUNT(*) as count FROM daily_stats;

-- Display sample data with nutrition totals
SELECT
    u.username,
    m.meal_name,
    m.meal_type,
    m.meal_date,
    SUM(mi.calories) as total_calories,
    SUM(mi.protein) as total_protein,
    SUM(mi.carbs) as total_carbs,
    SUM(mi.fat) as total_fat
FROM users u
JOIN meals m ON u.id = m.user_id
JOIN meal_items mi ON m.id = mi.meal_id
GROUP BY u.username, m.meal_name, m.meal_type, m.meal_date, m.created_at
ORDER BY m.meal_date, m.created_at;

-- Display daily statistics
SELECT
    u.username,
    ds.stats_date,
    ds.total_calories,
    u.daily_calorie_goal,
    ds.goal_achieved,
    ds.meals_logged
FROM users u
LEFT JOIN daily_stats ds ON u.id = ds.user_id
ORDER BY ds.stats_date DESC;

-- Display leaderboard
SELECT * FROM calorie_challenge_leaderboard;