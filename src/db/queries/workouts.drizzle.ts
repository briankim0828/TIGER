import * as SQLite from 'expo-sqlite';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import {
  workoutSessions,
  workoutExercises,
  workoutSets,
  exercises as exerciseTable,
  splitExercises as splitExercisesTable,
  splits as splitsTable,
} from '../sqlite/schema';
import { newUuid } from '../../utils/ids';
import { useElectric } from '../../electric';

export type WorkoutSessionRow = typeof workoutSessions.$inferSelect;
export type WorkoutExerciseRow = typeof workoutExercises.$inferSelect;
export type WorkoutSetRow = typeof workoutSets.$inferSelect;

export type SessionExerciseJoin = {
  sessionExerciseId: string;
  orderPos: number;
  restSecDefault: number | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    kind: string | null;
    modality: string | null;
    default_rest_sec: number | null;
    bodyPart: string | null;
  };
};

export class WorkoutsDataAccess {
  private sqlite: SQLite.SQLiteDatabase;
  private db: ReturnType<typeof drizzle>;
  // optional notifier for live updates (injected lazily to avoid React import cycles in non-React contexts)
  private bumpTables?: (tables: string[]) => void;

  constructor(database: SQLite.SQLiteDatabase) {
    this.sqlite = database;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.db = drizzle(this.sqlite as any);
  }

  // Allow callers to inject a bump function to notify live queries
  setLiveNotifier(bump: (tables: string[]) => void) {
    this.bumpTables = bump;
  }

  private async inTx<T>(fn: () => Promise<T>): Promise<T> {
  // Use IMMEDIATE to acquire a RESERVED lock up front and serialize concurrent writers.
  // This avoids races when two addSet calls compute the same next set_index concurrently.
  await this.sqlite.execAsync('BEGIN IMMEDIATE');
    try {
      const result = await fn();
      await this.sqlite.execAsync('COMMIT');
      return result;
    } catch (e) {
      await this.sqlite.execAsync('ROLLBACK');
      throw e;
    }
  }

  // Reads
  async getActiveWorkoutSession(userId: string): Promise<WorkoutSessionRow | null> {
    const rows = await this.db
      .select()
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.state, 'active')))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async getSessionExercises(sessionId: string): Promise<SessionExerciseJoin[]> {
  console.debug('[WorkoutsDA] getSessionExercises:', { sessionId });
    const rows = await this.db
      .select({
        session_exercise_id: workoutExercises.id,
        order_pos: workoutExercises.orderPos,
        rest_sec_default: workoutExercises.restSecDefault,
        notes: workoutExercises.notes,
        exercise_id: exerciseTable.id,
        name: exerciseTable.name,
        kind: exerciseTable.kind,
        modality: exerciseTable.modality,
        default_rest_sec: exerciseTable.defaultRestSec,
        body_part: exerciseTable.bodyPart,
      })
      .from(workoutExercises)
      .innerJoin(exerciseTable, eq(workoutExercises.exerciseId, exerciseTable.id))
      .where(eq(workoutExercises.sessionId, sessionId))
      .orderBy(asc(workoutExercises.orderPos));

  const mapped = rows.map((r) => ({
      sessionExerciseId: r.session_exercise_id as string,
      orderPos: typeof r.order_pos === 'string' ? parseInt(r.order_pos as unknown as string, 10) : (r.order_pos as number),
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
  console.debug('[WorkoutsDA] getSessionExercises result:', { count: mapped.length });
  return mapped;
  }

  async getSetsForSessionExercise(sessionExerciseId: string): Promise<WorkoutSetRow[]> {
    const rows = await this.db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.sessionExerciseId, sessionExerciseId))
      .orderBy(asc(workoutSets.setIndex));
    return rows as WorkoutSetRow[];
  }

  // Writes
  async startWorkout(args: { userId: string; splitId?: string | null; fromSplitExerciseIds?: string[] }) {
    const { userId, splitId = null, fromSplitExerciseIds } = args;
    return this.inTx(async () => {
      const sessionId = newUuid();
      const nowIso = new Date().toISOString();
      await this.db
        .insert(workoutSessions)
        .values({ id: sessionId, userId, splitId, state: 'active', startedAt: nowIso })
        .run();
      console.debug('[WorkoutsDA] startWorkout: created session', { sessionId, userId, splitId, fromSplitExerciseIdsCount: fromSplitExerciseIds?.length ?? 0 });

      let exerciseIds: string[] = [];
      if (Array.isArray(fromSplitExerciseIds) && fromSplitExerciseIds.length > 0) {
        exerciseIds = fromSplitExerciseIds;
      } else if (splitId) {
        // Hydrate from split_exercises in their order
        const splitRows = await this.db
          .select({ exerciseId: splitExercisesTable.exerciseId })
          .from(splitExercisesTable)
          .where(eq(splitExercisesTable.splitId, splitId))
          .orderBy(asc(splitExercisesTable.orderPos));
        exerciseIds = splitRows.map((r) => r.exerciseId as string);
        if (exerciseIds.length === 0) {
          console.warn('[WorkoutsDA] startWorkout: split has no exercises in SQLite split_exercises', { splitId });
        }
      }

      // Insert session exercises with contiguous order starting at 0
      if (exerciseIds.length === 0) {
        console.debug('[WorkoutsDA] startWorkout: no exerciseIds provided/resolved; session will start empty');
      }
      for (let i = 0; i < exerciseIds.length; i += 1) {
        const wexId = newUuid();
        await this.db
          .insert(workoutExercises)
          .values({
            id: wexId,
            sessionId,
            exerciseId: exerciseIds[i]!,
            orderPos: i,
          })
          .run();
      }
  console.debug('[WorkoutsDA] startWorkout: inserted session exercises', { count: exerciseIds.length });

  // Notify live queries: a new session exists and exercises were inserted
  this.bumpTables?.(['workout_sessions', 'workout_exercises']);
  return { sessionId };
    });
  }

  async addSet(
    sessionExerciseId: string,
    data: { weight?: number | null; reps?: number | null; rpe?: number | null; notes?: string | null }
  ): Promise<WorkoutSetRow> {
    // Retry a few times in case of a transient UNIQUE violation from concurrent inserts.
    const maxAttempts = 5;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.inTx(async () => {
          const id = newUuid();
          // Atomic compute of next set_index using INSERT ... SELECT with aggregate
          await this.sqlite.runAsync(
            `INSERT INTO workout_sets (id, session_exercise_id, set_index, weight, reps, rpe, notes)
             SELECT ?, ?, COALESCE(MAX(set_index) + 1, 0), ?, ?, ?, ?
             FROM workout_sets WHERE session_exercise_id = ?;`,
            id,
            sessionExerciseId,
            data.weight ?? null,
            data.reps ?? null,
            data.rpe ?? null,
            data.notes ?? null,
            sessionExerciseId
          );
          const rows = await this.db.select().from(workoutSets).where(eq(workoutSets.id, id)).limit(1);
          const row = rows[0] as WorkoutSetRow;
          this.bumpTables?.(['workout_sets']);
          return row;
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const isUnique = msg.includes('UNIQUE constraint failed') && (msg.includes('workout_sets.session_exercise_id') || msg.includes('workout_sets_order_uq'));
        if (!isUnique) throw e;
        lastErr = e;
        await new Promise((r) => setTimeout(r, 12 * attempt));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async updateSet(setId: string, patch: Partial<Pick<WorkoutSetRow, 'weight' | 'reps' | 'rpe' | 'notes' | 'completed' | 'startedAt' | 'completedAt'>>): Promise<boolean> {
    await this.db.update(workoutSets).set(patch).where(eq(workoutSets.id, setId)).run();
  this.bumpTables?.(['workout_sets']);
    return true;
  }

  async deleteSet(setId: string): Promise<boolean> {
    return this.inTx(async () => {
      // Find owning session_exercise_id
      const row = await this.db.select().from(workoutSets).where(eq(workoutSets.id, setId)).limit(1);
      const sessionExerciseId = row[0]?.sessionExerciseId as string | undefined;
      await this.db.delete(workoutSets).where(eq(workoutSets.id, setId)).run();
      if (sessionExerciseId) {
        const sets = await this.db
          .select({ id: workoutSets.id })
          .from(workoutSets)
          .where(eq(workoutSets.sessionExerciseId, sessionExerciseId))
          .orderBy(asc(workoutSets.setIndex));
        let pos = 0;
        for (const s of sets) {
          await this.db.update(workoutSets).set({ setIndex: pos }).where(eq(workoutSets.id, s.id)).run();
          pos += 1;
        }
      }
  // Notify live queries that sets changed
  this.bumpTables?.(['workout_sets']);
  return true;
    });
  }

  async endWorkout(sessionId: string, opts?: { status?: 'completed' | 'cancelled' }): Promise<boolean> {
    const status = opts?.status ?? 'completed';
    const nowIso = new Date().toISOString();
    await this.db
      .update(workoutSessions)
      .set({ state: status, finishedAt: nowIso, updatedAt: nowIso })
      .where(eq(workoutSessions.id, sessionId))
      .run();
  this.bumpTables?.(['workout_sessions']);
    return true;
  }

  async getSessionInfo(sessionId: string): Promise<{ id: string; userId: string; splitId: string | null; state: string; startedAt: string | null; finishedAt: string | null } | null> {
    const rows = await this.db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);
    const r = rows[0] as any;
    if (!r) return null;
    return {
      id: r.id as string,
      userId: r.userId as string,
      splitId: (r.splitId ?? null) as string | null,
      state: r.state as string,
      startedAt: (r.startedAt ?? null) as string | null,
      finishedAt: (r.finishedAt ?? null) as string | null,
    };
  }

  async getSplitName(splitId: string): Promise<string | null> {
    const rows = await this.db.select({ name: splitsTable.name }).from(splitsTable).where(eq(splitsTable.id, splitId)).limit(1);
    return (rows[0]?.name as string | undefined) ?? null;
  }

  async deleteWorkout(sessionId: string): Promise<boolean> {
    return this.inTx(async () => {
      // Find all session exercises
      const exRows = await this.db
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .where(eq(workoutExercises.sessionId, sessionId));
      // Delete sets for each exercise
      for (const ex of exRows) {
        await this.db.delete(workoutSets).where(eq(workoutSets.sessionExerciseId, ex.id as any)).run();
      }
      // Delete exercises
      await this.db.delete(workoutExercises).where(eq(workoutExercises.sessionId, sessionId)).run();
      // Delete session
      await this.db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
  this.bumpTables?.(['workout_sets', 'workout_exercises', 'workout_sessions']);
      return true;
    });
  }

  async reorderSessionExercises(sessionId: string, nextIds: string[]): Promise<boolean> {
    return this.inTx(async () => {
      let pos = 0;
      for (const id of nextIds) {
        await this.db.update(workoutExercises).set({ orderPos: pos }).where(and(eq(workoutExercises.id, id), eq(workoutExercises.sessionId, sessionId))).run();
        pos += 1;
      }
  // Notify that exercises order changed
  this.bumpTables?.(['workout_exercises']);
      return true;
    });
  }

  async addExerciseToSession(sessionId: string, exerciseId: string): Promise<{ id: string }> {
    const maxRow = await this.db
      .select({ maxOrder: sql<string>`COALESCE(MAX(${workoutExercises.orderPos}), -1)` })
      .from(workoutExercises)
      .where(eq(workoutExercises.sessionId, sessionId));
    const nextOrder = (parseInt((maxRow[0]?.maxOrder ?? '-1') as string, 10) || -1) + 1;
    const id = newUuid();
    await this.db
      .insert(workoutExercises)
      .values({ id, sessionId, exerciseId, orderPos: nextOrder })
      .run();
  this.bumpTables?.(['workout_exercises']);
    return { id };
  }

  async removeExerciseFromSession(sessionExerciseId: string): Promise<boolean> {
    return this.inTx(async () => {
      // Delete child sets first (no FK cascades guaranteed)
      await this.db.delete(workoutSets).where(eq(workoutSets.sessionExerciseId, sessionExerciseId)).run();
      // Find session id and remove the exercise row
      const row = await this.db.select().from(workoutExercises).where(eq(workoutExercises.id, sessionExerciseId)).limit(1);
      const sessionId = row[0]?.sessionId as string | undefined;
      await this.db.delete(workoutExercises).where(eq(workoutExercises.id, sessionExerciseId)).run();

      if (sessionId) {
        // Renormalize order positions for remaining exercises
        const rest = await this.db
          .select({ id: workoutExercises.id })
          .from(workoutExercises)
          .where(eq(workoutExercises.sessionId, sessionId))
          .orderBy(asc(workoutExercises.orderPos));
        let pos = 0;
        for (const r of rest) {
          await this.db.update(workoutExercises).set({ orderPos: pos }).where(eq(workoutExercises.id, r.id)).run();
          pos += 1;
        }
      }
  this.bumpTables?.(['workout_exercises', 'workout_sets']);
      return true;
    });
  }
}
