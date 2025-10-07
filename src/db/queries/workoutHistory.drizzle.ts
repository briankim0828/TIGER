import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { and, eq, inArray, sql, asc, desc } from 'drizzle-orm';
import { workoutSessions, workoutExercises, workoutSets, exerciseCatalog } from '../sqlite/schema';
import { enqueueOutbox } from '../sync/outbox';

/**
 * Lightweight calendar entry (date + completion flag)
 * Derived from workout_sessions rows where started_at is defined.
 */
export type WorkoutCalendarEntry = {
  date: string;        // YYYY-MM-DD (derived from startedAt ISO)
  completed: boolean;  // state === 'completed'
};

export type WorkoutStats = {
  totalWorkouts: number;
  hoursTrained: number; // rounded to 1 decimal from duration hours
};

export type WorkoutPostExercise = {
  sessionExerciseId: string;
  name: string;
  setCount: number;
};

export type WorkoutPost = {
  sessionId: string;
  sessionName: string | null;
  note: string | null;
  durationMin: number | null;
  totalVolumeKg: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exercises: WorkoutPostExercise[];
};

/**
 * History/Stats data access kept separate from the interactive session mutations
 * to make removal of legacy DataContext straightforward.
 */
export class WorkoutHistoryDataAccess {
  private sqlite: SQLite.SQLiteDatabase;
  private db: ReturnType<typeof drizzle>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.sqlite = database;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.db = drizzle(this.sqlite as any);
  }

  /** Return simple calendar entries for a user. */
  async getWorkoutCalendarEntries(userId: string): Promise<WorkoutCalendarEntry[]> {
    const rows = await this.db
      .select({ id: workoutSessions.id, startedAt: workoutSessions.startedAt, state: workoutSessions.state })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId));

    const entries: WorkoutCalendarEntry[] = [];
    for (const r of rows) {
      if (!r.startedAt) continue;
      // Normalize to date component (UTC slice)
      const date = r.startedAt.slice(0, 10); // YYYY-MM-DD
      // If multiple sessions same day, mark completed if ANY completed
      const existing = entries.find(e => e.date === date);
      if (existing) {
        if (!existing.completed && r.state === 'completed') existing.completed = true;
      } else {
        entries.push({ date, completed: r.state === 'completed' });
      }
    }
    return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  /** Basic aggregate stats for profile screen */
  async getWorkoutStats(userId: string): Promise<WorkoutStats> {
    // Duration = finishedAt - startedAt (only completed sessions with both timestamps)
    const rows = await this.db
      .select({ startedAt: workoutSessions.startedAt, finishedAt: workoutSessions.finishedAt, state: workoutSessions.state })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, userId)));

    let totalCompleted = 0;
    let totalDurationMs = 0;
    for (const r of rows) {
      if (r.state === 'completed' && r.startedAt && r.finishedAt) {
        totalCompleted += 1;
        const start = Date.parse(r.startedAt);
        const end = Date.parse(r.finishedAt);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          totalDurationMs += (end - start);
        }
      }
    }
    const hours = totalDurationMs / 1000 / 3600;
    return { totalWorkouts: totalCompleted, hoursTrained: Math.round(hours * 10) / 10 };
  }

  /**
   * Feed-style posts: one per completed workout session, newest first, with per-exercise set counts.
   */
  async getWorkoutPosts(userId: string, limit = 25): Promise<WorkoutPost[]> {
    // 1) Fetch latest completed sessions for the user
    const sessions = await this.db
      .select({
        id: workoutSessions.id,
        sessionName: workoutSessions.sessionName,
        note: workoutSessions.note,
        durationMin: workoutSessions.durationMin,
        totalVolumeKg: workoutSessions.totalVolumeKg,
        startedAt: workoutSessions.startedAt,
        finishedAt: workoutSessions.finishedAt,
      })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.state, 'completed')))
      .orderBy(desc(workoutSessions.finishedAt))
      .limit(limit);

    if (sessions.length === 0) return [];
    const sessionIds = sessions.map((s) => s.id as string);

    // 2) Fetch exercises with set counts for these sessions in one query
    const exRows = await this.db
      .select({
        sessionId: workoutExercises.sessionId,
        sessionExerciseId: workoutExercises.id,
        name: exerciseCatalog.name,
        setCount: sql<number>`COUNT(${workoutSets.id})`.as('set_count'),
        orderPos: workoutExercises.orderPos,
      })
      .from(workoutExercises)
      .leftJoin(workoutSets, eq(workoutSets.workoutExerciseId, workoutExercises.id))
      .innerJoin(exerciseCatalog, eq(workoutExercises.exerciseId, exerciseCatalog.id))
      .where(inArray(workoutExercises.sessionId, sessionIds))
      .groupBy(workoutExercises.sessionId, workoutExercises.id, exerciseCatalog.name, workoutExercises.orderPos)
      .orderBy(asc(workoutExercises.sessionId), asc(workoutExercises.orderPos));

    // 3) Group exercises by sessionId
    const bySession = new Map<string, WorkoutPostExercise[]>();
    for (const r of exRows as Array<{ sessionId: string; sessionExerciseId: string; name: string; setCount: number; orderPos: number }>) {
      const sid = r.sessionId as string;
      const arr = bySession.get(sid) ?? [];
      arr.push({ sessionExerciseId: r.sessionExerciseId as string, name: r.name as string, setCount: (r.setCount ?? 0) });
      bySession.set(sid, arr);
    }

    // 4) Map sessions into posts, preserving order from sessions[] (newest first)
    const posts: WorkoutPost[] = sessions.map((s) => ({
      sessionId: s.id as string,
      sessionName: (s.sessionName ?? null) as string | null,
      note: (s.note ?? null) as string | null,
      durationMin: (s.durationMin ?? null) as number | null,
      totalVolumeKg: (s.totalVolumeKg ?? null) as number | null,
      startedAt: (s.startedAt ?? null) as string | null,
      finishedAt: (s.finishedAt ?? null) as string | null,
      exercises: bySession.get(s.id as string) ?? [],
    }));
    return posts;
  }

  /** Clear all workout history for a user. */
  async deleteAllWorkouts(userId: string): Promise<number> {
    // Try direct delete (relies on ON DELETE CASCADE in schema)
    try {
      await this.sqlite.runAsync('DELETE FROM workout_sessions WHERE user_id = ?', userId);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const code = (e as any)?.code ?? (e as any)?.errno;
      const isFk = msg.includes('FOREIGN KEY constraint failed') || code === 19;
      if (!isFk) throw e;
      // Fallback: child-first delete in case FK CASCADE isn’t present yet on this device DB
      await this.sqlite.withTransactionAsync(async () => {
        await this.sqlite.runAsync(
          `DELETE FROM workout_sets WHERE workout_exercise_id IN (
             SELECT id FROM workout_exercises WHERE session_id IN (
               SELECT id FROM workout_sessions WHERE user_id = ?
             )
           )`,
          userId
        );
        await this.sqlite.runAsync(
          `DELETE FROM workout_exercises WHERE session_id IN (
             SELECT id FROM workout_sessions WHERE user_id = ?
           )`,
          userId
        );
        await this.sqlite.runAsync('DELETE FROM workout_sessions WHERE user_id = ?', userId);
      });
    }
    // SQLite execAsync does not return affected rows; do a count after.
    const remain = await this.db
      .select({ c: sql<number>`COUNT(*)`.as('c') })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId));
    return (remain[0]?.c as number) ?? 0;
  }

  /**
   * Sync-aware clear: enqueue remote deletes for each session, then delete locally.
   * This ensures the background flusher propagates the deletions to Supabase.
   */
  async deleteAllWorkoutsSyncAware(userId: string): Promise<number> {
    // Collect session IDs for the user first
    const rows = await this.db
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId));

    // Enqueue remote deletes for each session row
    if (rows.length > 0) {
      await this.sqlite.withTransactionAsync(async () => {
        for (const r of rows) {
          const id = r.id as string;
          await enqueueOutbox(this.sqlite, { table: 'workout_sessions', op: 'delete', rowId: id });
        }
      });
      // Then perform the local delete (falling back to child-first if FK error occurs)
      try {
        await this.sqlite.runAsync('DELETE FROM workout_sessions WHERE user_id = ?', userId);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const code = (e as any)?.code ?? (e as any)?.errno;
        const isFk = msg.includes('FOREIGN KEY constraint failed') || code === 19;
        if (!isFk) throw e;
        await this.sqlite.withTransactionAsync(async () => {
          await this.sqlite.runAsync(
            `DELETE FROM workout_sets WHERE workout_exercise_id IN (
               SELECT id FROM workout_exercises WHERE session_id IN (
                 SELECT id FROM workout_sessions WHERE user_id = ?
               )
             )`,
            userId
          );
          await this.sqlite.runAsync(
            `DELETE FROM workout_exercises WHERE session_id IN (
               SELECT id FROM workout_sessions WHERE user_id = ?
             )`,
            userId
          );
          await this.sqlite.runAsync('DELETE FROM workout_sessions WHERE user_id = ?', userId);
        });
      }
    } else {
      // No rows; still ensure local table is clean (noop if already empty)
      await this.sqlite.runAsync('DELETE FROM workout_sessions WHERE user_id = ?', userId);
    }

    // Return remaining count for convenience
    const remain = await this.db
      .select({ c: sql<number>`COUNT(*)`.as('c') })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId));
    return (remain[0]?.c as number) ?? 0;
  }
}
