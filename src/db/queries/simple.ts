// Simple data access layer without complex schema dependencies
import * as SQLite from 'expo-sqlite';
import { newUuid } from '../../utils/ids';

export class SimpleDataAccess {
  private db: SQLite.SQLiteDatabase;

  constructor(database: SQLite.SQLiteDatabase) {
    this.db = database;
  }

  /**
   * Initialize basic tables for local storage
   */
  async initializeTables() {
    try {
      // Create a simple splits table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS splits (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#4F46E5',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create a simple exercises table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS exercises (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT DEFAULT 'strength',
          modality TEXT DEFAULT 'other',
          default_rest_sec INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create split_exercises junction table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS split_exercises (
          id TEXT PRIMARY KEY,
          split_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          order_pos INTEGER NOT NULL,
          rest_sec_default INTEGER,
          notes TEXT,
          FOREIGN KEY (split_id) REFERENCES splits (id),
          FOREIGN KEY (exercise_id) REFERENCES exercises (id)
        );
      `);

      // Create workout_sessions table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          split_id TEXT,
          state TEXT DEFAULT 'active',
          started_at TEXT DEFAULT CURRENT_TIMESTAMP,
          finished_at TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create workout_exercises table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_exercises (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          order_pos INTEGER NOT NULL,
          rest_sec_default INTEGER,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES workout_sessions (id),
          FOREIGN KEY (exercise_id) REFERENCES exercises (id)
        );
      `);

      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Error initializing database tables:', error);
      throw error;
    }
  }

  // SPLITS METHODS
  async getUserSplits(userId: string) {
    try {
      const result = await this.db.getAllAsync(
        'SELECT * FROM splits WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error fetching user splits:', error);
      throw error;
    }
  }

  async getSplitById(splitId: string) {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM splits WHERE id = ?',
        [splitId]
      );
      return result;
    } catch (error) {
      console.error('Error fetching split by ID:', error);
      throw error;
    }
  }

  async createSplit(data: { name: string; userId: string; color?: string }) {
    try {
      const id = newUuid();
      await this.db.runAsync(
        'INSERT INTO splits (id, user_id, name, color) VALUES (?, ?, ?, ?)',
        [id, data.userId, data.name, data.color || '#4F46E5']
      );
      return { id, ...data };
    } catch (error) {
      console.error('Error creating split:', error);
      throw error;
    }
  }

  // EXERCISES METHODS
  async getAllExercises() {
    try {
      const result = await this.db.getAllAsync(
        'SELECT * FROM exercises ORDER BY name'
      );
      return result;
    } catch (error) {
      console.error('Error fetching all exercises:', error);
      throw error;
    }
  }

  async getExerciseById(exerciseId: string) {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM exercises WHERE id = ?',
        [exerciseId]
      );
      return result;
    } catch (error) {
      console.error('Error fetching exercise by ID:', error);
      throw error;
    }
  }

  async createExercise(data: { name: string; kind?: string; modality?: string }) {
    try {
      const id = newUuid();
      await this.db.runAsync(
        'INSERT INTO exercises (id, name, kind, modality) VALUES (?, ?, ?, ?)',
        [id, data.name, data.kind || 'strength', data.modality || 'other']
      );
      return { id, ...data };
    } catch (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
  }

  // WORKOUT SESSIONS METHODS
  async getUserWorkoutSessions(userId: string) {
    try {
      const result = await this.db.getAllAsync(
        'SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return result;
    } catch (error) {
      console.error('Error fetching user workout sessions:', error);
      throw error;
    }
  }

  async createWorkoutSession(data: { userId: string; splitId?: string }) {
    try {
      const id = newUuid();
      await this.db.runAsync(
        'INSERT INTO workout_sessions (id, user_id, split_id, state) VALUES (?, ?, ?, ?)',
        [id, data.userId, data.splitId || null, 'active']
      );
      return { id, ...data };
    } catch (error) {
      console.error('Error creating workout session:', error);
      throw error;
    }
  }

  async completeWorkoutSession(sessionId: string, notes?: string) {
    try {
      await this.db.runAsync(
        'UPDATE workout_sessions SET state = ?, finished_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['completed', new Date().toISOString(), notes || null, sessionId]
      );
      return true;
    } catch (error) {
      console.error('Error completing workout session:', error);
      throw error;
    }
  }

  // UTILITY METHODS
  async seedSampleData() {
    try {
      // Add some sample exercises
      const exercises = [
        { name: 'Bench Press', kind: 'strength', modality: 'barbell' },
        { name: 'Squat', kind: 'strength', modality: 'barbell' },
        { name: 'Deadlift', kind: 'strength', modality: 'barbell' },
        { name: 'Push-ups', kind: 'strength', modality: 'bodyweight' },
        { name: 'Pull-ups', kind: 'strength', modality: 'bodyweight' },
      ];

      for (const exercise of exercises) {
        const existing = await this.db.getFirstAsync(
          'SELECT id FROM exercises WHERE name = ?',
          [exercise.name]
        );
        
        if (!existing) {
          await this.createExercise(exercise);
        }
      }

      console.log('Sample data seeded successfully');
    } catch (error) {
      console.error('Error seeding sample data:', error);
      throw error;
    }
  }
}
