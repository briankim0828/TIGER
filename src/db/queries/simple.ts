// Simple data access layer without complex schema dependencies
import * as SQLite from 'expo-sqlite';
import { newUuid } from '../../utils/ids';
import { DEFAULT_EXERCISES_BY_BODY_PART } from '../../types';

// Typed result shapes for this lightweight SQLite layer
export type SplitRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  order_pos?: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type SplitWithCountRow = SplitRow & {
  exercise_count: number;
  exerciseCount: number;
};

export type ExerciseRow = {
  id: string;
  name: string;
  kind: string | null;
  modality: string | null;
  default_rest_sec: number | null;
  bodyPart: string | null;
};

export type SplitExerciseJoin = {
  splitExerciseId: string;
  orderPos: number;
  restSecDefault: number | null;
  notes: string | null;
  exercise: ExerciseRow;
};

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
          order_pos INTEGER,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Lightweight migration: ensure order_pos exists and is backfilled sequentially per user
      try {
        const cols = await this.db.getAllAsync(`PRAGMA table_info(splits)`);
        const hasOrderPos = Array.isArray(cols) && (cols as any[]).some((c) => c.name === 'order_pos');
        if (!hasOrderPos) {
          await this.db.runAsync(`ALTER TABLE splits ADD COLUMN order_pos INTEGER`);
        }
        // Backfill any NULL order_pos by assigning sequential positions per (user_id, created_at)
        await this.db.execAsync(`
          UPDATE splits
          SET order_pos = (
            SELECT COUNT(1) FROM splits s2
            WHERE s2.user_id = splits.user_id
              AND (
                s2.created_at < splits.created_at OR
                (s2.created_at = splits.created_at AND s2.id <= splits.id)
              )
          )
          WHERE order_pos IS NULL;
        `);
      } catch (e) {
        console.warn('SQLite migration (order_pos) may have failed or is unnecessary:', e);
      }

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

      // Lightweight migration: add body_part column if missing and backfill
      try {
        const cols = await this.db.getAllAsync(`PRAGMA table_info(exercises)`);
        const hasBodyPart = Array.isArray(cols) && (cols as any[]).some((c) => c.name === 'body_part');
        if (!hasBodyPart) {
          await this.db.runAsync(`ALTER TABLE exercises ADD COLUMN body_part TEXT`);
          // Backfill existing rows using modality as a reasonable default for grouping
          await this.db.runAsync(`UPDATE exercises SET body_part = modality WHERE body_part IS NULL OR body_part = ''`);
        }
      } catch (e) {
        console.warn('SQLite migration (add body_part) may have failed or is unnecessary:', e);
      }

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

      // Create workout_sets table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sets (
          id TEXT PRIMARY KEY,
          session_exercise_id TEXT NOT NULL,
          set_index INTEGER NOT NULL,
          weight REAL,
          reps INTEGER,
          rpe REAL,
          completed INTEGER DEFAULT 0,
          started_at TEXT,
          completed_at TEXT,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_exercise_id) REFERENCES workout_exercises (id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_session_exercise_setidx_uq
          ON workout_sets (session_exercise_id, set_index);
        CREATE INDEX IF NOT EXISTS idx_workout_sets_session_exercise
          ON workout_sets (session_exercise_id);
      `);

      // Create split_day_assignments table for program days
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS split_day_assignments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          weekday TEXT NOT NULL, -- e.g., 'Mon','Tue', ...
          split_id TEXT NOT NULL,
          UNIQUE(user_id, weekday)
        );
      `);

      console.log('Database tables initialized successfully');
    } catch (error) {
      console.error('Error initializing database tables:', error);
      throw error;
    }
  }

  // SPLITS METHODS
  async getUserSplits(userId: string): Promise<SplitRow[]> {
    try {
  const result = await this.db.getAllAsync(
  'SELECT * FROM splits WHERE user_id = ? ORDER BY COALESCE(order_pos, 0) ASC, created_at ASC',
        [userId]
      );
  return result as unknown as SplitRow[];
    } catch (error) {
      console.error('Error fetching user splits:', error);
      throw error;
    }
  }

  /**
   * Fetch user splits with exercise counts for each split
   */
  async getUserSplitsWithExerciseCounts(userId: string): Promise<SplitWithCountRow[]> {
    try {
      const result = await this.db.getAllAsync(
        `SELECT s.*, (
            SELECT COUNT(1) FROM split_exercises se WHERE se.split_id = s.id
         ) AS exercise_count
         FROM splits s
         WHERE s.user_id = ?
         ORDER BY COALESCE(s.order_pos, 0) ASC, s.created_at ASC`,
        [userId]
      );

      // Normalize exercise_count to number and expose as camelCase as well
      return (result as any[]).map((row) => ({
        ...(row as SplitRow),
        exercise_count: typeof (row as any).exercise_count === 'string' ? parseInt((row as any).exercise_count, 10) : (row as any).exercise_count ?? 0,
        exerciseCount: typeof (row as any).exercise_count === 'string' ? parseInt((row as any).exercise_count, 10) : (row as any).exercise_count ?? 0,
      }));
    } catch (error) {
      console.error('Error fetching user splits with counts:', error);
      throw error;
    }
  }

  async getSplitById(splitId: string): Promise<SplitRow | undefined> {
    try {
  const result = await this.db.getFirstAsync(
        'SELECT * FROM splits WHERE id = ?',
        [splitId]
      );
  return result as unknown as SplitRow | undefined;
    } catch (error) {
      console.error('Error fetching split by ID:', error);
      throw error;
    }
  }

  async createSplit(data: { name: string; userId: string; color?: string }) {
    try {
      const id = newUuid();
      // Determine next order position (append to bottom)
      const row: any = await this.db.getFirstAsync(
        'SELECT COALESCE(MAX(order_pos), 0) AS max_order FROM splits WHERE user_id = ?',
        [data.userId]
      );
      const nextOrder = (typeof row?.max_order === 'string' ? parseInt(row.max_order, 10) : (row?.max_order ?? 0)) + 1;
      await this.db.runAsync(
        'INSERT INTO splits (id, user_id, name, color, order_pos) VALUES (?, ?, ?, ?, ?)',
        [id, data.userId, data.name, data.color || '#4F46E5', nextOrder]
      );
      return { id, ...data };
    } catch (error) {
      console.error('Error creating split:', error);
      throw error;
    }
  }

  async updateSplit(data: { id: string; name?: string; color?: string; isActive?: boolean }) {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (typeof data.name === 'string') {
        fields.push('name = ?');
        values.push(data.name);
      }
      if (typeof data.color === 'string') {
        fields.push('color = ?');
        values.push(data.color);
      }
      if (typeof data.isActive === 'boolean') {
        fields.push('is_active = ?');
        values.push(data.isActive ? 1 : 0);
      }

      // Always update timestamp
      fields.push('updated_at = CURRENT_TIMESTAMP');

      if (fields.length === 1) {
        // Only updated_at changed, still OK
      }

      const sql = `UPDATE splits SET ${fields.join(', ')} WHERE id = ?`;
      values.push(data.id);
      await this.db.runAsync(sql, values);
      return true;
    } catch (error) {
      console.error('Error updating split:', error);
      throw error;
    }
  }

  async deleteSplit(splitId: string) {
    try {
      // Manually cascade delete split_exercises (SQLite FK cascade may not be enabled)
      await this.db.runAsync('DELETE FROM split_exercises WHERE split_id = ?', [splitId]);
      await this.db.runAsync('DELETE FROM splits WHERE id = ?', [splitId]);
      return true;
    } catch (error) {
      console.error('Error deleting split:', error);
      throw error;
    }
  }

  // EXERCISES METHODS
  async getAllExercises(): Promise<ExerciseRow[]> {
    try {
      const rows = await this.db.getAllAsync(
        'SELECT id, name, kind, modality, default_rest_sec, body_part FROM exercises ORDER BY name'
      );
      return (rows as any[]).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        kind: (r.kind ?? null) as string | null,
        modality: (r.modality ?? null) as string | null,
        default_rest_sec: (r.default_rest_sec ?? null) as number | null,
        bodyPart: (r.body_part ?? null) as string | null,
      }));
    } catch (error) {
      console.error('Error fetching all exercises:', error);
      throw error;
    }
  }

  async getExerciseById(exerciseId: string): Promise<ExerciseRow | undefined> {
    try {
      const r = await this.db.getFirstAsync(
        'SELECT id, name, kind, modality, default_rest_sec, body_part FROM exercises WHERE id = ?',
        [exerciseId]
      );
      if (!r) return undefined;
      const row: ExerciseRow = {
        id: (r as any).id,
        name: (r as any).name,
        kind: ((r as any).kind ?? null),
        modality: ((r as any).modality ?? null),
        default_rest_sec: ((r as any).default_rest_sec ?? null),
        bodyPart: ((r as any).body_part ?? null),
      };
      return row;
    } catch (error) {
      console.error('Error fetching exercise by ID:', error);
      throw error;
    }
  }

  async createExercise(data: { name: string; kind?: string; modality?: string; bodyPart?: string }) {
    try {
      const id = newUuid();
      // Ensure body_part column exists before insert
      await this.db.runAsync(
        'INSERT INTO exercises (id, name, kind, modality, body_part) VALUES (?, ?, ?, ?, ?)',
        [id, data.name, data.kind || 'strength', data.modality || 'other', data.bodyPart || null]
      );
      return { id, ...data };
    } catch (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
  }

  // SPLIT EXERCISES METHODS
  /**
   * Get exercises assigned to a split ordered by order_pos.
   * Returns merged exercise + mapping metadata.
   */
  async getSplitExercises(splitId: string): Promise<SplitExerciseJoin[]> {
    try {
  const rows = await this.db.getAllAsync(
        `SELECT se.id as split_exercise_id, se.order_pos, se.rest_sec_default, se.notes,
        e.id as exercise_id, e.name, e.kind, e.modality, e.default_rest_sec, e.body_part
           FROM split_exercises se
           JOIN exercises e ON e.id = se.exercise_id
          WHERE se.split_id = ?
          ORDER BY se.order_pos ASC`,
        [splitId]
      );
      return (rows as any[]).map((r) => ({
        splitExerciseId: r.split_exercise_id as string,
        orderPos: (typeof r.order_pos === 'string' ? parseInt(r.order_pos, 10) : r.order_pos) as number,
        restSecDefault: (r.rest_sec_default ?? null) as number | null,
        notes: (r.notes ?? null) as string | null,
        exercise: {
          id: r.exercise_id as string,
          name: r.name as string,
          kind: (r.kind ?? null) as string | null,
          modality: (r.modality ?? null) as string | null,
          default_rest_sec: (r.default_rest_sec ?? null) as number | null,
      bodyPart: (r.body_part ?? null) as string | null,
        },
      }));
    } catch (error) {
      console.error('Error fetching split exercises:', error);
      throw error;
    }
  }

  // PROGRAM DAY ASSIGNMENTS METHODS
  async getDayAssignments(userId: string): Promise<Array<{ weekday: string; split_id: string }>> {
    try {
      const rows = await this.db.getAllAsync(
        'SELECT weekday, split_id FROM split_day_assignments WHERE user_id = ?',
        [userId]
      );
  return rows as Array<{ weekday: string; split_id: string }>;
    } catch (error) {
      console.error('Error fetching day assignments:', error);
      throw error;
    }
  }

  async setDayAssignment(userId: string, weekday: string, splitId: string | null) {
    try {
      if (!splitId) {
        await this.db.runAsync(
          'DELETE FROM split_day_assignments WHERE user_id = ? AND weekday = ?',
          [userId, weekday]
        );
        return true;
      }
      // Upsert the assignment for (user, weekday)
      const id = newUuid();
      await this.db.runAsync(
        'INSERT INTO split_day_assignments (id, user_id, weekday, split_id) VALUES (?, ?, ?, ?)\n         ON CONFLICT(user_id, weekday) DO UPDATE SET split_id = excluded.split_id',
        [id, userId, weekday, splitId]
      );
      return true;
    } catch (error) {
      console.error('Error setting day assignment:', error);
      throw error;
    }
  }

  /**
   * Append exercises to split with contiguous order positions.
   */
  async addExercisesToSplit(splitId: string, exerciseIds: string[], options?: { avoidDuplicates?: boolean }) {
    try {
      // Determine starting order position
      const maxRow: any = await this.db.getFirstAsync(
        'SELECT COALESCE(MAX(order_pos), 0) AS max_order FROM split_exercises WHERE split_id = ?',
        [splitId]
      );
      let nextOrder = (typeof maxRow?.max_order === 'string' ? parseInt(maxRow.max_order, 10) : maxRow?.max_order || 0) + 1;

      // Optionally skip duplicates (same exercise in same split)
      let existingIds: Set<string> | null = null;
      if (options?.avoidDuplicates) {
        const existing = await this.db.getAllAsync(
          'SELECT exercise_id FROM split_exercises WHERE split_id = ?',
          [splitId]
        );
        existingIds = new Set((existing as any[]).map(r => r.exercise_id));
      }

      for (const exId of exerciseIds) {
        if (existingIds && existingIds.has(exId)) continue;
        const id = newUuid();
        await this.db.runAsync(
          'INSERT INTO split_exercises (id, split_id, exercise_id, order_pos) VALUES (?, ?, ?, ?)',
          [id, splitId, exId, nextOrder]
        );
        nextOrder += 1;
      }
      return true;
    } catch (error) {
      console.error('Error adding exercises to split:', error);
      throw error;
    }
  }

  /**
   * Remove an exercise from a split and renormalize order positions.
   */
  async removeExerciseFromSplit(splitId: string, exerciseId: string) {
    try {
      await this.db.runAsync(
        'DELETE FROM split_exercises WHERE split_id = ? AND exercise_id = ?',
        [splitId, exerciseId]
      );

      // Renormalize order positions
      const rows: any[] = await this.db.getAllAsync(
        'SELECT id FROM split_exercises WHERE split_id = ? ORDER BY order_pos ASC',
        [splitId]
      );
      let pos = 1;
      for (const row of rows) {
        await this.db.runAsync(
          'UPDATE split_exercises SET order_pos = ? WHERE id = ?',
          [pos, row.id]
        );
        pos += 1;
      }
      return true;
    } catch (error) {
      console.error('Error removing exercise from split:', error);
      throw error;
    }
  }

  /**
   * Reorder split exercises according to provided exercise IDs order.
   */
  async reorderSplitExercises(splitId: string, orderedExerciseIds: string[]) {
    try {
      // Map exercise_id -> split_exercises.id to update by row id
      const rows: any[] = await this.db.getAllAsync(
        'SELECT id, exercise_id FROM split_exercises WHERE split_id = ?',
        [splitId]
      );
      const map = new Map<string, string>();
      for (const r of rows) map.set(r.exercise_id, r.id);

      let pos = 1;
      for (const exId of orderedExerciseIds) {
        const rowId = map.get(exId);
        if (!rowId) continue; // ignore unknown ids
        await this.db.runAsync(
          'UPDATE split_exercises SET order_pos = ? WHERE id = ?',
          [pos, rowId]
        );
        pos += 1;
      }
      return true;
    } catch (error) {
      console.error('Error reordering split exercises:', error);
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
      // Seed a comprehensive default catalog grouped by body part.
      // Map legacy body parts into this local model by placing them in the `modality` column
      // so ExerciseSelectionView groups them under BODY_PARTS.
      for (const [bodyPart, list] of Object.entries(DEFAULT_EXERCISES_BY_BODY_PART)) {
        for (const item of list) {
          const name = item.name;
          const kind = bodyPart === 'Cardio' ? 'cardio' : 'strength';
          const modality = 'other'; // keep modality generic; body_part will drive grouping

          const existing = await this.db.getFirstAsync(
            'SELECT id FROM exercises WHERE name = ?',
            [name]
          );

          if (!existing) {
            await this.createExercise({ name, kind, modality, bodyPart });
          }
        }
      }

      console.log('Sample data seeded successfully');
    } catch (error) {
      console.error('Error seeding sample data:', error);
      throw error;
    }
  }
}
