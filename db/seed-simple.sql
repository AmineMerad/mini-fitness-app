-- Simple seed data for demo - just test users
-- Password for both users: password123

-- Insert test users
INSERT INTO users (id, username, email, password_hash, daily_calorie_goal, created_at, updated_at) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'user1',
    'user1@example.com',
    '$2b$10$L9BaJV8DCF.3faVW0Yc.HO6Xm5aO1m7twu/WXCKfk/gjXyvOBuGn2',
    2000,
    NOW(),
    NOW()
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'user2',
    'user2@example.com',
    '$2b$10$hVfSVmES5/XT6LHCxvYiwOWXs26qhBh9EauhlyKXnK911.r.SYrY2',
    1800,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
