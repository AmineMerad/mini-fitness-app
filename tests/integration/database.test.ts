import { setupTestDb, clearTestDb, cleanupTestDb } from '../../src/services/testDatabase';
import DatabaseService from '../../src/services/database';

describe('Database Integration Tests', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'hashedpassword');

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.id).toBeDefined();
      expect(user.created_at).toBeDefined();
    });

    it('should retrieve user by username', async () => {
      await db.createUser('testuser', 'test@example.com', 'hashedpassword');
      const user = await db.getUserByUsername('testuser');

      expect(user).toBeDefined();
      expect(user?.username).toBe('testuser');
      expect(user?.email).toBe('test@example.com');
    });

    it('should retrieve user by email', async () => {
      await db.createUser('testuser', 'test@example.com', 'hashedpassword');
      const user = await db.getUserByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user?.username).toBe('testuser');
      expect(user?.email).toBe('test@example.com');
    });

    it('should update user information', async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'hashedpassword');
      const updatedUser = await db.updateUser(user.id, {
        username: 'newtestuser',
        email: 'newemail@example.com'
      });

      expect(updatedUser?.username).toBe('newtestuser');
      expect(updatedUser?.email).toBe('newemail@example.com');
    });

    it('should delete user', async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'hashedpassword');
      const deleted = await db.deleteUser(user.id);

      expect(deleted).toBe(true);

      const retrievedUser = await db.getUserById(user.id);
      expect(retrievedUser).toBeNull();
    });
  });

  describe('Meal CRUD Operations', () => {
    let userId: string;

    beforeEach(async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'hashedpassword');
      userId = user.id;
    });

    it('should create a meal entry', async () => {
      const mealDate = new Date('2024-01-15');
      const meal = await db.createMeal(
        userId,
        'Breakfast Bowl',
        'breakfast',
        mealDate,
        'https://example.com/photo.jpg'
      );

      expect(meal).toBeDefined();
      expect(meal.user_id).toBe(userId);
      expect(meal.meal_name).toBe('Breakfast Bowl');
      expect(meal.meal_type).toBe('breakfast');
      expect(meal.photo_url).toBe('https://example.com/photo.jpg');
    });

    it('should retrieve meals by user ID', async () => {
      const mealDate1 = new Date('2024-01-15');
      const mealDate2 = new Date('2024-01-16');

      await db.createMeal(userId, 'Breakfast', 'breakfast', mealDate1);
      await db.createMeal(userId, 'Lunch', 'lunch', mealDate2);

      const meals = await db.getMealsByUserId(userId);

      expect(meals).toHaveLength(2);
      expect(meals.length).toBeGreaterThanOrEqual(2);
    });

    it('should update meal entry', async () => {
      const mealDate = new Date('2024-01-15');
      const meal = await db.createMeal(userId, 'Old Name', 'breakfast', mealDate);
      const updatedMeal = await db.updateMeal(meal.id, {
        mealName: 'New Name',
        mealType: 'lunch'
      });

      expect(updatedMeal?.meal_name).toBe('New Name');
      expect(updatedMeal?.meal_type).toBe('lunch');
    });

    it('should delete meal entry', async () => {
      const mealDate = new Date('2024-01-15');
      const meal = await db.createMeal(userId, 'Test Meal', 'breakfast', mealDate);
      const deleted = await db.deleteMeal(meal.id);

      expect(deleted).toBe(true);

      const retrievedMeal = await db.getMealById(meal.id);
      expect(retrievedMeal).toBeNull();
    });
  });

  describe('Event CRUD Operations', () => {
    it('should create an event', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const event = await db.createEvent(
        'New Year Challenge',
        startDate,
        endDate,
        'calorie_challenge',
        2000
      );

      expect(event).toBeDefined();
      expect(event.event_name).toBe('New Year Challenge');
      expect(event.event_type).toBe('calorie_challenge');
      expect(event.daily_target).toBe(2000);
    });

    it('should retrieve all events', async () => {
      const startDate1 = new Date('2024-01-01');
      const endDate1 = new Date('2024-01-31');
      const startDate2 = new Date('2024-02-01');
      const endDate2 = new Date('2024-02-28');

      await db.createEvent('Event 1', startDate1, endDate1, 'calorie_challenge', 2000);
      await db.createEvent('Event 2', startDate2, endDate2, 'step_goal', 10000);

      const events = await db.getAllEvents();

      expect(events).toHaveLength(2);
    });

    it('should update event', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const event = await db.createEvent('Old Name', startDate, endDate, 'calorie_challenge', 2000);

      const updatedEvent = await db.updateEvent(event.id, {
        eventName: 'New Name',
        dailyTarget: 2500
      });

      expect(updatedEvent?.event_name).toBe('New Name');
      expect(updatedEvent?.daily_target).toBe(2500);
    });

    it('should delete event', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const event = await db.createEvent('Test Event', startDate, endDate, 'calorie_challenge', 2000);

      const deleted = await db.deleteEvent(event.id);

      expect(deleted).toBe(true);

      const retrievedEvent = await db.getEventById(event.id);
      expect(retrievedEvent).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    it('should get calorie challenge leaderboard', async () => {
      const user1 = await db.createUser('user1', 'user1@example.com', 'password');
      const user2 = await db.createUser('user2', 'user2@example.com', 'password');

      // Create meals for users to populate daily stats
      const today = new Date();
      const meal1 = await db.createMeal(user1.id, 'Breakfast', 'breakfast', today);
      const meal2 = await db.createMeal(user2.id, 'Breakfast', 'breakfast', today);

      await db.createMealItem(meal1.id, 'Oatmeal', 100, 'grams', 350, 10, 60, 5);
      await db.createMealItem(meal2.id, 'Eggs', 2, 'pieces', 150, 12, 2, 10);

      const leaderboard = await db.getCalorieChallengeLeaderboard(10);

      expect(leaderboard).toBeDefined();
      expect(Array.isArray(leaderboard)).toBe(true);
    });

    it('should search for food items', async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'password');
      const meal = await db.createMeal(user.id, 'Test Meal', 'breakfast', new Date());

      await db.createMealItem(meal.id, 'Chicken Breast', 200, 'grams', 330, 62, 0, 7);
      await db.createMealItem(meal.id, 'Chicken Thigh', 150, 'grams', 280, 25, 0, 15);

      const results = await db.searchFoodItems('chicken');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].food_name.toLowerCase()).toContain('chicken');
    });

    it('should get user streak data', async () => {
      const user = await db.createUser('testuser', 'test@example.com', 'password');

      const streakData = await db.getUserStreakData(user.id);

      expect(streakData).toBeDefined();
      expect(Array.isArray(streakData)).toBe(true);
    });
  });
});
