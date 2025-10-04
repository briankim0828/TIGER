// Simple data access layer without complex schema dependencies
import * as SQLite from 'expo-sqlite';
import { newUuid } from '../../utils/ids';
// Legacy default exercise catalog removed; provide a minimal internal seed set.
const INTERNAL_SEED_EXERCISES: Array<{ name: string; bodyPart: string; modality?: string }> = [
  { name: 'Flat Bench Press', bodyPart: 'chest', modality: 'barbell' },
  { name: 'Barbell Row', bodyPart: 'back', modality: 'barbell' },
  { name: 'Squats', bodyPart: 'leg', modality: 'barbell' },
  { name: 'Bicep Curls', bodyPart: 'biceps', modality: 'dumbbell' },
  { name: 'Dumbbell Shoulder Press', bodyPart: 'shoulder', modality: 'dumbbell' },
  { name: 'Crunches', bodyPart: 'core', modality: 'bodyweight' },
  { name: 'Treadmill', bodyPart: 'cardio', modality: 'bodyweight' },
];

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
  async initializeTables(options?: { reset?: boolean }) {
    try {
      // Ensure SQLite enforces FK constraints on this connection
      try {
        await this.db.execAsync(`PRAGMA foreign_keys = ON;`);
      } catch {}

      if (options?.reset) {
        // Destructive reset for development: drop all tables before recreation
        await this.db.execAsync(`
          PRAGMA foreign_keys=OFF;
          DROP TABLE IF EXISTS workout_sets;
          DROP TABLE IF EXISTS workout_exercises;
          DROP TABLE IF EXISTS workout_sessions;
          DROP TABLE IF EXISTS split_day_assignments;
          DROP TABLE IF EXISTS split_exercises;
          DROP TABLE IF EXISTS splits;
          DROP TABLE IF EXISTS exercise_catalog;
          DROP TABLE IF EXISTS outbox;
          DROP TABLE IF EXISTS sync_state;
          PRAGMA foreign_keys=ON;
        `);
      }
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

  // Legacy harmonization logic removed: we now always recreate from CP6 shape.

      // Create harmonized exercise_catalog table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS exercise_catalog (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE,
          modality TEXT,
          body_part TEXT,
          default_rest_sec INTEGER,
          media_thumb_url TEXT,
          media_video_url TEXT,
          is_public INTEGER DEFAULT 1,
          owner_user_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS exercise_catalog_slug_uq ON exercise_catalog(slug);
        CREATE INDEX IF NOT EXISTS idx_exercise_catalog_owner ON exercise_catalog(owner_user_id);
      `);

  // (Removed body_part backfill migration; new table includes column.)

      // Create split_exercises referencing splits (CASCADE) and exercise_catalog (NO ACTION)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS split_exercises (
          id TEXT PRIMARY KEY,
          split_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          order_pos INTEGER NOT NULL,
          rest_sec_default INTEGER,
          notes TEXT,
          FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercise_catalog (id) ON DELETE NO ACTION
        );
      `);

      // Create workout_sessions (CP6 shape) — keep sessions if split is deleted
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          split_id TEXT,
          state TEXT DEFAULT 'active',
          started_at TEXT,
          finished_at TEXT,
          note TEXT,
          energy_kcal INTEGER,
          total_volume_kg INTEGER,
          total_sets INTEGER,
          duration_sec INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE SET NULL
        );
      `);

      // Create workout_exercises (CP6 shape) — cascade on session delete; keep exercise_catalog referential (no action);
      // origin link from_split_exercise_id becomes NULL if origin split_exercise is removed
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_exercises (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          exercise_id TEXT NOT NULL,
          order_pos INTEGER NOT NULL,
          rest_sec_default INTEGER,
          from_split_exercise_id TEXT,
          note TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercise_catalog (id) ON DELETE NO ACTION,
          FOREIGN KEY (from_split_exercise_id) REFERENCES split_exercises (id) ON DELETE SET NULL
        );
      `);

      // Create workout_sets (CP6 shape) — cascade on workout_exercise delete
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sets (
          id TEXT PRIMARY KEY,
          workout_exercise_id TEXT NOT NULL,
          set_order INTEGER NOT NULL,
          is_warmup INTEGER NOT NULL DEFAULT 0,
          weight_kg INTEGER,
          reps INTEGER,
          duration_sec INTEGER,
          distance_m INTEGER,
          rest_sec INTEGER,
          is_completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_order_uq ON workout_sets (workout_exercise_id, set_order);
        CREATE INDEX IF NOT EXISTS idx_workout_sets_ex ON workout_sets (workout_exercise_id);
      `);

      // Create split_day_assignments table for program days — cascade when split is removed
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS split_day_assignments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          weekday INTEGER NOT NULL, -- 0=Mon .. 6=Sun
          split_id TEXT NOT NULL,
          UNIQUE(user_id, weekday),
          FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE CASCADE
        );
      `);

  // No legacy migrations retained: tables always rebuilt fresh per CP6.

      // Sync state table: single row per user (or global for MVP) tracking pull/flush
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          last_pull_at TEXT,
          last_flush_at TEXT,
          is_online INTEGER DEFAULT 1,
          last_error TEXT
        );
        INSERT OR IGNORE INTO sync_state (id, is_online) VALUES (1, 1);
      `);

      // Outbox for background flush to Supabase
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY,
          table_name TEXT NOT NULL,
          op TEXT NOT NULL CHECK (op IN ('insert','update','delete')),
          row_id TEXT NOT NULL,
          payload TEXT, -- JSON string
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          retry_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed'))
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox (status, created_at);
      `);

      // Ensure existing installations have the correct FK cascade behaviors.
      // If missing/incorrect, rebuild affected tables with proper FKs.
      try {
        const fkList = async (table: string) => (await this.db.getAllAsync(`PRAGMA foreign_key_list(${table})`)) as any[];

        const ensureTable = async (
          table: string,
          expected: Array<{ from: string; table: string; onDelete?: string }>,
          createSql: string,
          copyColumns: string
        ) => {
          let needsRebuild = false;
          try {
            const fks = await fkList(table);
            for (const e of expected) {
              const match = fks.find(
                (r) => r.table === e.table && r.from === e.from && (!e.onDelete || (r.on_delete ?? r.onDelete) === e.onDelete)
              );
              if (!match) { needsRebuild = true; break; }
            }
          } catch { needsRebuild = true; }

          if (needsRebuild) {
            await this.db.withTransactionAsync(async () => {
              await this.db.execAsync(`PRAGMA foreign_keys=OFF;`);
              await this.db.execAsync(`ALTER TABLE ${table} RENAME TO ${table}_old;`);
              await this.db.execAsync(createSql);
              // Best-effort copy of all known columns
              try {
                await this.db.execAsync(`INSERT INTO ${table} (${copyColumns}) SELECT ${copyColumns} FROM ${table}_old;`);
              } catch {}
              await this.db.execAsync(`DROP TABLE ${table}_old;`);
              await this.db.execAsync(`PRAGMA foreign_keys=ON;`);
            });
          }
        };

        // Define canonical CREATE statements mirroring above with correct FKs
        const createSplitExercises = `
          CREATE TABLE IF NOT EXISTS split_exercises (
            id TEXT PRIMARY KEY,
            split_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            order_pos INTEGER NOT NULL,
            rest_sec_default INTEGER,
            notes TEXT,
            FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE CASCADE,
            FOREIGN KEY (exercise_id) REFERENCES exercise_catalog (id) ON DELETE NO ACTION
          );`;

        const createSplitDayAssignments = `
          CREATE TABLE IF NOT EXISTS split_day_assignments (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            weekday INTEGER NOT NULL,
            split_id TEXT NOT NULL,
            UNIQUE(user_id, weekday),
            FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE CASCADE
          );`;

        const createWorkoutSessions = `
          CREATE TABLE IF NOT EXISTS workout_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            split_id TEXT,
            state TEXT DEFAULT 'active',
            started_at TEXT,
            finished_at TEXT,
            note TEXT,
            energy_kcal INTEGER,
            total_volume_kg INTEGER,
            total_sets INTEGER,
            duration_sec INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (split_id) REFERENCES splits (id) ON DELETE SET NULL
          );`;

        const createWorkoutExercises = `
          CREATE TABLE IF NOT EXISTS workout_exercises (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            order_pos INTEGER NOT NULL,
            rest_sec_default INTEGER,
            from_split_exercise_id TEXT,
            note TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE,
            FOREIGN KEY (exercise_id) REFERENCES exercise_catalog (id) ON DELETE NO ACTION,
            FOREIGN KEY (from_split_exercise_id) REFERENCES split_exercises (id) ON DELETE SET NULL
          );`;

        const createWorkoutSets = `
          CREATE TABLE IF NOT EXISTS workout_sets (
            id TEXT PRIMARY KEY,
            workout_exercise_id TEXT NOT NULL,
            set_order INTEGER NOT NULL,
            is_warmup INTEGER NOT NULL DEFAULT 0,
            weight_kg INTEGER,
            reps INTEGER,
            duration_sec INTEGER,
            distance_m INTEGER,
            rest_sec INTEGER,
            is_completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
          );
          CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_order_uq ON workout_sets (workout_exercise_id, set_order);
          CREATE INDEX IF NOT EXISTS idx_workout_sets_ex ON workout_sets (workout_exercise_id);`;

        // Apply fixes per rules
        await ensureTable(
          'split_exercises',
          [ { from: 'split_id', table: 'splits', onDelete: 'CASCADE' } ],
          createSplitExercises,
          'id, split_id, exercise_id, order_pos, rest_sec_default, notes'
        );

        await ensureTable(
          'split_day_assignments',
          [ { from: 'split_id', table: 'splits', onDelete: 'CASCADE' } ],
          createSplitDayAssignments,
          'id, user_id, weekday, split_id'
        );

        await ensureTable(
          'workout_sessions',
          [ { from: 'split_id', table: 'splits', onDelete: 'SET NULL' } ],
          createWorkoutSessions,
          'id, user_id, split_id, state, started_at, finished_at, note, energy_kcal, total_volume_kg, total_sets, duration_sec, created_at, updated_at'
        );

        await ensureTable(
          'workout_exercises',
          [ { from: 'session_id', table: 'workout_sessions', onDelete: 'CASCADE' } ],
          createWorkoutExercises,
          'id, session_id, exercise_id, order_pos, rest_sec_default, from_split_exercise_id, note, created_at'
        );

        await ensureTable(
          'workout_sets',
          [ { from: 'workout_exercise_id', table: 'workout_exercises', onDelete: 'CASCADE' } ],
          createWorkoutSets,
          'id, workout_exercise_id, set_order, is_warmup, weight_kg, reps, duration_sec, distance_m, rest_sec, is_completed, created_at'
        );
      } catch (e) {
        console.warn('FK enforcement check skipped or failed:', e);
      }

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

  async updateSplit(data: { id: string; name?: string; color?: string; isActive?: boolean; orderPos?: number }) {
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
      if (typeof data.orderPos === 'number') {
        fields.push('order_pos = ?');
        values.push(data.orderPos);
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
  'SELECT id, name, modality, default_rest_sec, body_part FROM exercise_catalog ORDER BY name'
      );
      return (rows as any[]).map((r) => ({
        id: r.id as string,
        name: r.name as string,
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
  'SELECT id, name, modality, default_rest_sec, body_part FROM exercise_catalog WHERE id = ?',
        [exerciseId]
      );
      if (!r) return undefined;
      const row: ExerciseRow = {
        id: (r as any).id,
        name: (r as any).name,
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

  async createExercise(data: { name: string; modality?: string; bodyPart?: string }) {
    try {
      const id = newUuid();
      const { normalizeExerciseInput } = await import('../catalog/validation');
      const { ensureSlug } = await import('../../utils/slug');
      const normalized = normalizeExerciseInput({ name: data.name, modality: data.modality, bodyPart: data.bodyPart });
      const slug = ensureSlug({ name: normalized.name, isPublic: true });
      await this.db.runAsync(
        'INSERT INTO exercise_catalog (id, name, slug, modality, body_part) VALUES (?, ?, ?, ?, ?)',
        [id, normalized.name, slug, normalized.modality, normalized.bodyPart || null]
      );
      return { id, name: normalized.name, modality: normalized.modality, bodyPart: normalized.bodyPart };
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
  e.id as exercise_id, e.name, e.modality, e.default_rest_sec, e.body_part
     FROM split_exercises se
     JOIN exercise_catalog e ON e.id = se.exercise_id
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
      for (const item of INTERNAL_SEED_EXERCISES) {
  const existing = await this.db.getFirstAsync('SELECT id FROM exercise_catalog WHERE name = ?', [item.name]);
        if (!existing) {
          await this.createExercise({ name: item.name, modality: item.modality || undefined, bodyPart: item.bodyPart });
        }
      }

      console.log('Sample data seeded successfully');
    } catch (error) {
      console.error('Error seeding sample data:', error);
      throw error;
    }
  }
}
