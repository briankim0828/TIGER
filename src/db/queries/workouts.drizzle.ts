import * as SQLite from 'expo-sqlite';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import {
  workoutSessions,
  workoutExercises,
  workoutSets,
  exerciseCatalog as exerciseTable,
  splitExercises as splitExercisesTable,
  splits as splitsTable,
} from '../sqlite/schema';
import { newUuid } from '../../utils/ids';
import { useElectric } from '../../electric';
import { enqueueOutbox } from '../sync/outbox';

export type WorkoutSessionRow = typeof workoutSessions.$inferSelect;
export type WorkoutExerciseRow = typeof workoutExercises.$inferSelect;
export type WorkoutSetRow = typeof workoutSets.$inferSelect;

export type SessionExerciseJoin = {
  sessionExerciseId: string; // keep legacy field name for UI compatibility
  orderPos: number;
  restSecDefault: number | null;
  note: string | null; // renamed in schema; expose as note
  exercise: {
    id: string;
    name: string;
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
  async setSessionNote(sessionId: string, note: string): Promise<boolean> {
    const nowIso = new Date().toISOString();
    await this.db.update(workoutSessions).set({ note, updatedAt: nowIso }).where(eq(workoutSessions.id, sessionId)).run();
    // Fetch user_id for RLS on update
    const owner = await this.db.select({ userId: workoutSessions.userId }).from(workoutSessions).where(eq(workoutSessions.id, sessionId)).limit(1);
    const userId = owner[0]?.userId as string | undefined;
    await enqueueOutbox(this.sqlite, {
      table: 'workout_sessions',
      op: 'update',
      rowId: sessionId,
      payload: { id: sessionId, ...(userId ? { user_id: userId } : {}), note, updated_at: nowIso },
    });
    this.bumpTables?.(['workout_sessions']);
    return true;
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
        note: workoutExercises.note,
        exercise_id: exerciseTable.id,
        name: exerciseTable.name,
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
      note: (r.note ?? null) as string | null,
      exercise: {
        id: r.exercise_id as string,
        name: r.name as string,
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
      .where(eq(workoutSets.workoutExerciseId, sessionExerciseId))
      .orderBy(asc(workoutSets.setOrder));
    return rows as WorkoutSetRow[];
  }

  // Writes
  async startWorkout(args: { userId: string; splitId?: string | null; fromSplitExerciseIds?: string[]; startedAtOverride?: string }) {
    const { userId, splitId = null, fromSplitExerciseIds, startedAtOverride } = args;
    return this.inTx(async () => {
      const sessionId = newUuid();
      const nowIso = new Date().toISOString();
      const startedIso = startedAtOverride ?? nowIso;
      await this.db
        .insert(workoutSessions)
        .values({ id: sessionId, userId, splitId, state: 'active', startedAt: startedIso })
        .run();
      await enqueueOutbox(this.sqlite, {
        table: 'workout_sessions',
        op: 'insert',
        rowId: sessionId,
        payload: {
          id: sessionId,
          user_id: userId,
          split_id: splitId,
          state: 'active',
          started_at: startedIso,
          created_at: nowIso,
          updated_at: nowIso,
        },
      });
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
        await enqueueOutbox(this.sqlite, {
          table: 'workout_exercises',
          op: 'insert',
          rowId: wexId,
          payload: {
            id: wexId,
            session_id: sessionId,
            exercise_id: exerciseIds[i]!,
            order_pos: i,
          },
        });
      }
  console.debug('[WorkoutsDA] startWorkout: inserted session exercises', { count: exerciseIds.length });

  // Notify live queries: a new session exists and exercises were inserted
  this.bumpTables?.(['workout_sessions', 'workout_exercises']);
  return { sessionId };
    });
  }

  async addSet(
    sessionExerciseId: string,
    data: { weightKg?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null; restSec?: number | null; isWarmup?: boolean | null }
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
            `INSERT INTO workout_sets (id, workout_exercise_id, set_order, is_warmup, weight_kg, reps, duration_sec, distance_m, rest_sec, is_completed)
             SELECT ?, ?, COALESCE(MAX(set_order) + 1, 0), ?, ?, ?, ?, ?, ?, 0
             FROM workout_sets WHERE workout_exercise_id = ?;`,
            id,
            sessionExerciseId,
            (data.isWarmup ? 1 : 0),
            data.weightKg ?? null,
            data.reps ?? null,
            data.durationSec ?? null,
            data.distanceM ?? null,
            data.restSec ?? null,
            sessionExerciseId
          );
          const rows = await this.db.select().from(workoutSets).where(eq(workoutSets.id, id)).limit(1);
          const row = rows[0] as WorkoutSetRow;
          await enqueueOutbox(this.sqlite, {
            table: 'workout_sets',
            op: 'insert',
            rowId: row.id,
            payload: {
              id: row.id,
              workout_exercise_id: row.workoutExerciseId,
              set_order: row.setOrder,
              is_warmup: row.isWarmup ?? 0,
              weight_kg: row.weightKg ?? null,
              reps: row.reps ?? null,
              duration_sec: row.durationSec ?? null,
              distance_m: row.distanceM ?? null,
              rest_sec: row.restSec ?? null,
              is_completed: row.isCompleted ?? 0,
              created_at: (row as any).createdAt ?? new Date().toISOString(),
            },
          });
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

  async updateSet(setId: string, patch: Partial<Pick<WorkoutSetRow, 'weightKg' | 'reps' | 'durationSec' | 'distanceM' | 'restSec' | 'isWarmup' | 'isCompleted'>>): Promise<boolean> {
    await this.db.update(workoutSets).set(patch).where(eq(workoutSets.id, setId)).run();
    const payload: any = { id: setId };
    if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg;
    if (patch.reps !== undefined) payload.reps = patch.reps;
    if (patch.durationSec !== undefined) payload.duration_sec = patch.durationSec;
    if (patch.distanceM !== undefined) payload.distance_m = patch.distanceM;
    if (patch.restSec !== undefined) payload.rest_sec = patch.restSec;
    if (patch.isWarmup !== undefined) payload.is_warmup = patch.isWarmup ? 1 : 0;
    if (patch.isCompleted !== undefined) payload.is_completed = patch.isCompleted ? 1 : 0;
    await enqueueOutbox(this.sqlite, { table: 'workout_sets', op: 'update', rowId: setId, payload });
    this.bumpTables?.(['workout_sets']);
    return true;
  }

  async deleteSet(setId: string): Promise<boolean> {
    return this.inTx(async () => {
      // Find owning session_exercise_id
  const row = await this.db.select().from(workoutSets).where(eq(workoutSets.id, setId)).limit(1);
  const sessionExerciseId = row[0]?.workoutExerciseId as string | undefined;
      await this.db.delete(workoutSets).where(eq(workoutSets.id, setId)).run();
      await enqueueOutbox(this.sqlite, { table: 'workout_sets', op: 'delete', rowId: setId });
      if (sessionExerciseId) {
        const sets = await this.db
          .select({ id: workoutSets.id })
          .from(workoutSets)
          .where(eq(workoutSets.workoutExerciseId, sessionExerciseId))
          .orderBy(asc(workoutSets.setOrder));
        let pos = 0;
        for (const s of sets) {
          await this.db.update(workoutSets).set({ setOrder: pos }).where(eq(workoutSets.id, s.id)).run();
          await enqueueOutbox(this.sqlite, { table: 'workout_sets', op: 'update', rowId: s.id as string, payload: { id: s.id, set_order: pos } });
          pos += 1;
        }
      }
  // Notify live queries that sets changed
  this.bumpTables?.(['workout_sets']);
  return true;
    });
  }

  async endWorkout(
    sessionId: string,
    opts?: { status?: 'completed' | 'cancelled'; finishedAtOverride?: string; note?: string; totalVolumeKg?: number; totalSets?: number; durationMin?: number; sessionName?: string }
  ): Promise<boolean> {
    const status = opts?.status ?? 'completed';
    const nowIso = new Date().toISOString();
    const finishedIso = opts?.finishedAtOverride ?? nowIso;
    const patch: any = { state: status, finishedAt: finishedIso, updatedAt: nowIso };
    if (typeof opts?.note === 'string') patch.note = opts.note;
  if (typeof opts?.totalVolumeKg === 'number') patch.totalVolumeKg = opts.totalVolumeKg;
    if (typeof opts?.totalSets === 'number') patch.totalSets = opts.totalSets;
    if (typeof opts?.durationMin === 'number') patch.durationMin = opts.durationMin;
  if (typeof opts?.sessionName === 'string') patch.sessionName = opts.sessionName;
    await this.db.update(workoutSessions).set(patch).where(eq(workoutSessions.id, sessionId)).run();
  // Fetch user_id for RLS on update
  const owner = await this.db.select({ userId: workoutSessions.userId }).from(workoutSessions).where(eq(workoutSessions.id, sessionId)).limit(1);
  const userId = owner[0]?.userId as string | undefined;
  await enqueueOutbox(this.sqlite, {
    table: 'workout_sessions',
    op: 'update',
    rowId: sessionId,
    payload: {
      id: sessionId,
      ...(userId ? { user_id: userId } : {}),
      state: status,
      finished_at: finishedIso,
      updated_at: nowIso,
      ...(typeof opts?.note === 'string' ? { note: opts.note } : {}),
      ...(typeof opts?.totalVolumeKg === 'number' ? { total_volume_kg: opts.totalVolumeKg } : {}),
      ...(typeof opts?.totalSets === 'number' ? { total_sets: opts.totalSets } : {}),
      ...(typeof opts?.durationMin === 'number' ? { duration_min: opts.durationMin } : {}),
      ...(typeof opts?.sessionName === 'string' ? { session_name: opts.sessionName } : {}),
    },
  });
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
        const setRows = await this.db
          .select({ id: workoutSets.id })
          .from(workoutSets)
          .where(eq(workoutSets.workoutExerciseId, ex.id as any));
        await this.db.delete(workoutSets).where(eq(workoutSets.workoutExerciseId, ex.id as any)).run();
        for (const s of setRows) {
          await enqueueOutbox(this.sqlite, { table: 'workout_sets', op: 'delete', rowId: s.id as string });
        }
      }
      // Delete exercises
      await this.db.delete(workoutExercises).where(eq(workoutExercises.sessionId, sessionId)).run();
      for (const ex of exRows) {
        await enqueueOutbox(this.sqlite, { table: 'workout_exercises', op: 'delete', rowId: ex.id as string });
      }
      // Delete session
      await this.db.delete(workoutSessions).where(eq(workoutSessions.id, sessionId)).run();
      await enqueueOutbox(this.sqlite, { table: 'workout_sessions', op: 'delete', rowId: sessionId });
  this.bumpTables?.(['workout_sets', 'workout_exercises', 'workout_sessions']);
      return true;
    });
  }

  async reorderSessionExercises(sessionId: string, nextIds: string[]): Promise<boolean> {
    return this.inTx(async () => {
      let pos = 0;
      for (const id of nextIds) {
        await this.db.update(workoutExercises).set({ orderPos: pos }).where(and(eq(workoutExercises.id, id), eq(workoutExercises.sessionId, sessionId))).run();
        await enqueueOutbox(this.sqlite, { table: 'workout_exercises', op: 'update', rowId: id, payload: { id, order_pos: pos } });
        pos += 1;
      }
  // Notify that exercises order changed
  this.bumpTables?.(['workout_exercises']);
      return true;
    });
  }

  async addExerciseToSession(sessionId: string, exerciseId: string): Promise<{ id: string }> {
    return this.inTx(async () => {
      const id = newUuid();
      // Atomic compute + insert to avoid duplicate order_pos under concurrency
      await this.sqlite.runAsync(
        `INSERT INTO workout_exercises (id, session_id, exercise_id, order_pos)
         SELECT ?, ?, ?, COALESCE(MAX(order_pos) + 1, 0)
         FROM workout_exercises WHERE session_id = ?;`,
        id,
        sessionId,
        exerciseId,
        sessionId
      );
      // Read back to get the actual order_pos we inserted
      const rows = await this.db
        .select({ orderPos: workoutExercises.orderPos })
        .from(workoutExercises)
        .where(and(eq(workoutExercises.id, id), eq(workoutExercises.sessionId, sessionId)))
        .limit(1);
      const insertedOrder = (rows[0]?.orderPos as number | undefined) ?? 0;
      await enqueueOutbox(this.sqlite, {
        table: 'workout_exercises',
        op: 'insert',
        rowId: id,
        payload: { id, session_id: sessionId, exercise_id: exerciseId, order_pos: insertedOrder },
      });
      this.bumpTables?.(['workout_exercises']);
      return { id };
    });
  }

  async removeExerciseFromSession(sessionExerciseId: string): Promise<boolean> {
    return this.inTx(async () => {
      // Delete child sets first (no FK cascades guaranteed)
  const setRows = await this.db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .where(eq(workoutSets.workoutExerciseId, sessionExerciseId));
  await this.db.delete(workoutSets).where(eq(workoutSets.workoutExerciseId, sessionExerciseId)).run();
  for (const s of setRows) {
    await enqueueOutbox(this.sqlite, { table: 'workout_sets', op: 'delete', rowId: s.id as string });
  }
      // Find session id and remove the exercise row
      const row = await this.db.select().from(workoutExercises).where(eq(workoutExercises.id, sessionExerciseId)).limit(1);
      const sessionId = row[0]?.sessionId as string | undefined;
      await this.db.delete(workoutExercises).where(eq(workoutExercises.id, sessionExerciseId)).run();
      await enqueueOutbox(this.sqlite, { table: 'workout_exercises', op: 'delete', rowId: sessionExerciseId });

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
          await enqueueOutbox(this.sqlite, { table: 'workout_exercises', op: 'update', rowId: r.id as string, payload: { id: r.id, order_pos: pos } });
          pos += 1;
        }
      }
  this.bumpTables?.(['workout_exercises', 'workout_sets']);
      return true;
    });
  }
}
