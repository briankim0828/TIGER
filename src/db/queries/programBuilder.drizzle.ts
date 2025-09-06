import * as SQLite from 'expo-sqlite';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { exerciseCatalog, splits, splitDayAssignments, splitExercises, count } from '../sqlite/schema';
import { SimpleDataAccess } from './simple';
import { newUuid } from '../../utils/ids';
import type { ExerciseRow, SplitExerciseJoin, SplitWithCountRow, SplitRow } from './simple';

export class ProgramBuilderDataAccess {
  private sqlite: SQLite.SQLiteDatabase;
  private db: ReturnType<typeof drizzle>;

  constructor(database: SQLite.SQLiteDatabase) {
    this.sqlite = database;
    // Drizzle adapter for expo-sqlite
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.db = drizzle(this.sqlite as any);
  }

  // Reads (preserve signatures and result shapes)
  async getUserSplits(userId: string): Promise<SplitRow[]> {
    const rows = await this.db
      .select({
        id: splits.id,
        user_id: splits.userId,
        name: splits.name,
        color: splits.color,
        order_pos: splits.orderPos,
        is_active: splits.isActive,
        created_at: splits.createdAt,
        updated_at: splits.updatedAt,
      })
      .from(splits)
  .where(eq(splits.userId, userId))
  .orderBy(asc(sql`COALESCE(${splits.orderPos}, 0)`), asc(splits.createdAt));
    return rows as SplitRow[];
  }

  async getAllExercises(): Promise<ExerciseRow[]> {
  const rows = await this.db.select().from(exerciseCatalog).orderBy(asc(exerciseCatalog.name));
    // Map Drizzle row -> existing ExerciseRow shape (camelCase to legacy fields where needed)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind ?? null,
      modality: r.modality ?? null,
      default_rest_sec: (r.defaultRestSec ?? null) as number | null,
      bodyPart: r.bodyPart ?? null,
    }));
  }

  async getExerciseById(exerciseId: string): Promise<ExerciseRow | undefined> {
    const rows = await this.db
      .select()
  .from(exerciseCatalog)
  .where(eq(exerciseCatalog.id, exerciseId))
      .limit(1);
    const r = rows[0];
    if (!r) return undefined;
    return {
      id: r.id,
      name: r.name,
      kind: r.kind ?? null,
      modality: r.modality ?? null,
      default_rest_sec: (r.defaultRestSec ?? null) as number | null,
      bodyPart: r.bodyPart ?? null,
    };
  }

  async getUserSplitsWithExerciseCounts(userId: string): Promise<SplitWithCountRow[]> {
    // SELECT s.*, COUNT(se.id) AS exercise_count
    // FROM splits s LEFT JOIN split_exercises se ON se.split_id = s.id
    // WHERE s.user_id = ? GROUP BY s.id, ... ORDER BY s.created_at ASC
  const rows = await this.db
      .select({
        id: splits.id,
        user_id: splits.userId,
        name: splits.name,
        color: splits.color,
    order_pos: splits.orderPos,
        is_active: splits.isActive,
        created_at: splits.createdAt,
        updated_at: splits.updatedAt,
        exercise_count: sql<number>`COUNT(${splitExercises.id})`.as('exercise_count'),
      })
      .from(splits)
      .leftJoin(splitExercises, eq(splitExercises.splitId, splits.id))
      .where(eq(splits.userId, userId))
  .groupBy(
        splits.id,
        splits.userId,
        splits.name,
        splits.color,
        splits.isActive,
        splits.createdAt,
        splits.updatedAt,
      )
  .orderBy(asc(sql`COALESCE(${splits.orderPos}, 0)`), asc(splits.createdAt));

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      color: r.color,
      is_active: (r.is_active ?? 1) as number,
      created_at: r.created_at ?? '',
      updated_at: r.updated_at ?? '',
      exercise_count: typeof r.exercise_count === 'string' ? parseInt(r.exercise_count as unknown as string, 10) : (r.exercise_count ?? 0),
      exerciseCount: typeof r.exercise_count === 'string' ? parseInt(r.exercise_count as unknown as string, 10) : (r.exercise_count ?? 0),
    }));
  }

  async getSplitExercises(splitId: string): Promise<SplitExerciseJoin[]> {
    const rows = await this.db
      .select({
        split_exercise_id: splitExercises.id,
        order_pos: splitExercises.orderPos,
        rest_sec_default: splitExercises.restSecDefault,
        notes: splitExercises.notes,
        exercise_id: exerciseCatalog.id,
        name: exerciseCatalog.name,
        kind: exerciseCatalog.kind,
        modality: exerciseCatalog.modality,
        default_rest_sec: exerciseCatalog.defaultRestSec,
        body_part: exerciseCatalog.bodyPart,
      })
      .from(splitExercises)
      .innerJoin(exerciseCatalog, eq(splitExercises.exerciseId, exerciseCatalog.id))
      .where(eq(splitExercises.splitId, splitId))
      .orderBy(asc(splitExercises.orderPos));

    return rows.map((r) => ({
      splitExerciseId: r.split_exercise_id,
      orderPos: typeof r.order_pos === 'string' ? parseInt(r.order_pos, 10) : (r.order_pos as number),
      restSecDefault: (r.rest_sec_default ?? null) as number | null,
      notes: (r.notes ?? null) as string | null,
      exercise: {
        id: r.exercise_id,
        name: r.name,
        kind: (r.kind ?? null) as string | null,
        modality: (r.modality ?? null) as string | null,
        default_rest_sec: (r.default_rest_sec ?? null) as number | null,
        bodyPart: (r.body_part ?? null) as string | null,
      },
    }));
  }

  async getDayAssignments(userId: string): Promise<Array<{ weekday: string; split_id: string }>> {
    const rows = await this.db
      .select({ weekday: splitDayAssignments.weekday, split_id: splitDayAssignments.splitId })
      .from(splitDayAssignments)
      .where(eq(splitDayAssignments.userId, userId));
    return rows as Array<{ weekday: string; split_id: string }>;
  }

  // Delegate remaining operations (writes and any reads not yet migrated) to SimpleDataAccess
  async createSplit(data: { name: string; userId: string; color?: string }) {
    const id = newUuid();
    // Determine next order_pos per user
    const maxRow = await this.db
      .select({ maxOrder: sql<string>`COALESCE(MAX(${splits.orderPos}), 0)` })
      .from(splits)
      .where(eq(splits.userId, data.userId));
    const nextOrder = (parseInt((maxRow[0]?.maxOrder ?? '0') as string, 10) || 0) + 1;
    await this.db.insert(splits).values({
      id,
      userId: data.userId,
      name: data.name,
      color: data.color ?? '#4F46E5',
      orderPos: nextOrder,
    }).run();
    return { id, ...data };
  }

  async updateSplit(data: { id: string; name?: string; color?: string; isActive?: boolean; orderPos?: number }) {
    const fields: Partial<{
      name: string;
      color: string | null;
      isActive: number | null;
      updatedAt: string;
      orderPos: number;
    }> = {};
    if (typeof data.name === 'string') fields.name = data.name;
    if (typeof data.color === 'string') fields.color = data.color;
    if (typeof data.isActive === 'boolean') fields.isActive = data.isActive ? 1 : 0;
  if (typeof data.orderPos === 'number') fields.orderPos = data.orderPos;
    fields.updatedAt = sql`CURRENT_TIMESTAMP` as unknown as string;

    await this.db.update(splits).set(fields).where(eq(splits.id, data.id)).run();
    return true;
  }

  async deleteSplit(splitId: string) {
    // delete children then parent (SQLite may not enforce cascades)
    await this.db.delete(splitExercises).where(eq(splitExercises.splitId, splitId)).run();
    await this.db.delete(splits).where(eq(splits.id, splitId)).run();
    return true;
  }

  async setDayAssignment(userId: string, weekday: string, splitId: string | null) {
    if (!splitId) {
      await this.db.delete(splitDayAssignments).where(and(eq(splitDayAssignments.userId, userId), eq(splitDayAssignments.weekday, weekday))).run();
      return true;
    }
    const id = newUuid();
    await this.db
      .insert(splitDayAssignments)
      .values({ id, userId, weekday, splitId })
      .onConflictDoUpdate({
        target: [splitDayAssignments.userId, splitDayAssignments.weekday],
        set: { splitId },
      })
      .run();
    return true;
  }

  async addExercisesToSplit(splitId: string, exerciseIds: string[], options?: { avoidDuplicates?: boolean }) {
    // Determine current max order
    const maxRow = await this.db
      .select({ maxOrder: sql<string>`COALESCE(MAX(${splitExercises.orderPos}), 0)` })
      .from(splitExercises)
      .where(eq(splitExercises.splitId, splitId));
    let nextOrder = (parseInt((maxRow[0]?.maxOrder ?? '0') as string, 10) || 0) + 1;

    let existingIds: Set<string> | null = null;
    if (options?.avoidDuplicates) {
      const existing = await this.db
        .select({ exerciseId: splitExercises.exerciseId })
        .from(splitExercises)
        .where(eq(splitExercises.splitId, splitId));
      existingIds = new Set(existing.map((r) => r.exerciseId));
    }

    for (const exId of exerciseIds) {
      if (existingIds && existingIds.has(exId)) continue;
      const id = newUuid();
      await this.db.insert(splitExercises).values({
        id,
        splitId,
        exerciseId: exId,
        orderPos: nextOrder,
      }).run();
      nextOrder += 1;
    }
    return true;
  }

  async removeExerciseFromSplit(splitId: string, exerciseId: string) {
    await this.db
      .delete(splitExercises)
      .where(and(eq(splitExercises.splitId, splitId), eq(splitExercises.exerciseId, exerciseId)))
      .run();

    // Renormalize order positions
    const rows = await this.db
      .select({ id: splitExercises.id })
      .from(splitExercises)
      .where(eq(splitExercises.splitId, splitId))
      .orderBy(asc(splitExercises.orderPos));
    let pos = 1;
    for (const r of rows) {
      await this.db.update(splitExercises).set({ orderPos: pos }).where(eq(splitExercises.id, r.id)).run();
      pos += 1;
    }
    return true;
  }

  async reorderSplitExercises(splitId: string, orderedExerciseIds: string[]) {
    // Map exercise_id -> split_exercises.id
    const rows = await this.db
      .select({ id: splitExercises.id, exerciseId: splitExercises.exerciseId })
      .from(splitExercises)
      .where(eq(splitExercises.splitId, splitId));
    const map = new Map<string, string>(rows.map((r) => [r.exerciseId, r.id] as const));

    let pos = 1;
    for (const exId of orderedExerciseIds) {
      const rowId = map.get(exId);
      if (!rowId) continue;
      await this.db.update(splitExercises).set({ orderPos: pos }).where(eq(splitExercises.id, rowId)).run();
      pos += 1;
    }
    return true;
  }

  async createExercise(data: { name: string; kind?: string; modality?: string; bodyPart?: string }) {
    const id = newUuid();
  await this.db.insert(exerciseCatalog).values({
      id,
      name: data.name,
      kind: data.kind ?? 'strength',
      modality: data.modality ?? 'other',
      bodyPart: data.bodyPart ?? null,
    }).run();
    return { id, ...data };
  }

  async getSplitById(splitId: string): Promise<SplitRow | undefined> {
    const simple = new SimpleDataAccess(this.sqlite);
    return simple.getSplitById(splitId);
  }

  async getUserWorkoutSessions(userId: string) {
    const simple = new SimpleDataAccess(this.sqlite);
    return simple.getUserWorkoutSessions(userId);
  }

  async createWorkoutSession(data: { userId: string; splitId?: string }) {
    const simple = new SimpleDataAccess(this.sqlite);
    return simple.createWorkoutSession(data);
  }

  async completeWorkoutSession(sessionId: string, notes?: string) {
    const simple = new SimpleDataAccess(this.sqlite);
    return simple.completeWorkoutSession(sessionId, notes);
  }
}
