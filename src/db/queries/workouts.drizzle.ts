import * as SQLite from 'expo-sqlite';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import {
  workoutSessions,
  workoutExercises,
  workoutSets,
  exercises as exerciseTable,
  splitExercises as splitExercisesTable,
} from '../sqlite/schema';
import { newUuid } from '../../utils/ids';

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

  constructor(database: SQLite.SQLiteDatabase) {
    this.sqlite = database;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.db = drizzle(this.sqlite as any);
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
          const nextIdxRows = await this.db
            .select({ maxIdx: sql<string>`COALESCE(MAX(${workoutSets.setIndex}), -1)` })
            .from(workoutSets)
            .where(eq(workoutSets.sessionExerciseId, sessionExerciseId));
          const nextIdx = (parseInt((nextIdxRows[0]?.maxIdx ?? '-1') as string, 10) || -1) + 1;
          const id = newUuid();
          await this.db
            .insert(workoutSets)
            .values({
              id,
              sessionExerciseId,
              setIndex: nextIdx,
              weight: data.weight ?? null,
              reps: data.reps ?? null,
              rpe: data.rpe ?? null,
              notes: data.notes ?? null,
            })
            .run();
          const rows = await this.db.select().from(workoutSets).where(eq(workoutSets.id, id)).limit(1);
          return rows[0] as WorkoutSetRow;
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        // SQLite error code 19, or unique index name/columns in message
        const isUnique = msg.includes('UNIQUE constraint failed') && (msg.includes('workout_sets.session_exercise_id') || msg.includes('workout_sets_order_uq'));
        if (!isUnique) {
          throw e;
        }
        lastErr = e;
        // Small jitter before retrying to allow the other transaction to commit
        await new Promise((r) => setTimeout(r, 12 * attempt));
        // continue loop to retry
      }
    }
    // If we exhausted retries, rethrow the last error
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async updateSet(setId: string, patch: Partial<Pick<WorkoutSetRow, 'weight' | 'reps' | 'rpe' | 'notes' | 'completed' | 'startedAt' | 'completedAt'>>): Promise<boolean> {
    await this.db.update(workoutSets).set(patch).where(eq(workoutSets.id, setId)).run();
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
    return true;
  }

  async reorderSessionExercises(sessionId: string, nextIds: string[]): Promise<boolean> {
    return this.inTx(async () => {
      let pos = 0;
      for (const id of nextIds) {
        await this.db.update(workoutExercises).set({ orderPos: pos }).where(and(eq(workoutExercises.id, id), eq(workoutExercises.sessionId, sessionId))).run();
        pos += 1;
      }
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
      return true;
    });
  }
}
