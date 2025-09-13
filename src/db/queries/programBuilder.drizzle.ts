import * as SQLite from 'expo-sqlite';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { exerciseCatalog, splits, splitDayAssignments, splitExercises, count } from '../sqlite/schema';
import { normalizeExerciseInput } from '../catalog/validation';
import { ensureSlug } from '../../utils/slug';
import { SimpleDataAccess } from './simple';
import { newUuid } from '../../utils/ids';
import { enqueueOutbox } from '../sync/outbox';
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
        modality: (r.modality ?? null) as string | null,
        default_rest_sec: (r.default_rest_sec ?? null) as number | null,
        bodyPart: (r.body_part ?? null) as string | null,
      },
    }));
  }

  async getDayAssignments(userId: string): Promise<Array<{ weekday: number; split_id: string }>> {
    const rows = await this.db
      .select({ weekday: splitDayAssignments.weekday, split_id: splitDayAssignments.splitId })
      .from(splitDayAssignments)
      .where(eq(splitDayAssignments.userId, userId));
  return rows as Array<{ weekday: number; split_id: string }>;
  }

  // Delegate remaining operations (writes and any reads not yet migrated) to SimpleDataAccess
  async createSplit(data: { name: string; userId: string; color?: string }) {
    const id = newUuid();
    // Determine next order_pos per user (local)
    const maxRow = await this.db
      .select({ maxOrder: sql<string>`COALESCE(MAX(${splits.orderPos}), 0)` })
      .from(splits)
      .where(eq(splits.userId, data.userId));
    const nextOrder = (parseInt((maxRow[0]?.maxOrder ?? '0') as string, 10) || 0) + 1;
    // Local apply first
    await this.db.insert(splits).values({
      id,
      userId: data.userId,
      name: data.name,
      color: data.color ?? '#4F46E5',
      orderPos: nextOrder,
      updatedAt: sql`CURRENT_TIMESTAMP` as any,
    }).run();
    // Enqueue outbox (insert)
    await enqueueOutbox(this.sqlite, { table: 'splits', op: 'insert', rowId: id, payload: {
      id,
      user_id: data.userId,
      name: data.name,
      color: data.color ?? '#4F46E5',
      order_pos: nextOrder,
        // updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }});
    return { id, ...data };
  }

  async updateSplit(data: { id: string; name?: string; color?: string; isActive?: boolean; orderPos?: number }) {
  const fields: any = {};
    if (typeof data.name === 'string') fields.name = data.name;
  if (typeof data.color === 'string') fields.color = data.color as any;
    if (typeof data.isActive === 'boolean') fields.isActive = data.isActive ? 1 : 0;
  if (typeof data.orderPos === 'number') fields.orderPos = data.orderPos;
    fields.updatedAt = sql`CURRENT_TIMESTAMP` as unknown as string;

    // Local apply first
    await this.db.update(splits).set(fields).where(eq(splits.id, data.id)).run();
    // Enqueue outbox (update)
    // Fetch user_id for RLS scope
    const owner = await this.db.select({ userId: splits.userId }).from(splits).where(eq(splits.id, data.id)).limit(1);
    const userId = owner[0]?.userId as string | undefined;
    await enqueueOutbox(this.sqlite, { table: 'splits', op: 'update', rowId: data.id, payload: {
      id: data.id,
      ...(userId ? { user_id: userId } : {}),
      ...(typeof data.name === 'string' ? { name: data.name } : {}),
      ...(typeof data.color === 'string' ? { color: data.color } : {}),
      ...(typeof data.isActive === 'boolean' ? { is_active: data.isActive ? 1 : 0 } : {}),
      ...(typeof data.orderPos === 'number' ? { order_pos: data.orderPos } : {}),
      updated_at: new Date().toISOString(),
    }});
    return true;
  }

  async deleteSplit(splitId: string) {
    // local delete children then parent
    await this.db.delete(splitExercises).where(eq(splitExercises.splitId, splitId)).run();
    await this.db.delete(splits).where(eq(splits.id, splitId)).run();
    // Enqueue outbox (delete)
    await enqueueOutbox(this.sqlite, { table: 'splits', op: 'delete', rowId: splitId });
    return true;
  }

  async setDayAssignment(userId: string, weekday: string, splitId: string | null) {
    // Normalize and validate weekday (accept 'Mon'..'Sun', numeric strings, or number 0..6)
    const labelToNum: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    let wNum: number;
    if (typeof weekday === 'string') {
      if (weekday in labelToNum) {
        wNum = labelToNum[weekday];
      } else if (/^\d+$/.test(weekday)) {
        wNum = parseInt(weekday, 10);
      } else {
        // Try case-insensitive match on first three letters
        const key = weekday.slice(0, 3).replace(/^[a-z]/, (c) => c.toUpperCase());
        if (key in labelToNum) {
          wNum = labelToNum[key as keyof typeof labelToNum];
        } else {
          throw new Error(`Invalid weekday '${weekday}' (expected 0..6 or Mon..Sun)`);
        }
      }
    } else {
      wNum = (weekday as unknown as number);
    }
    if (Number.isNaN(wNum) || wNum < 0 || wNum > 6) {
      throw new Error(`Invalid weekday '${weekday}' (expected 0..6 or Mon..Sun)`);
    }
    if (!splitId) {
      // Find existing row id for outbox delete payload
      const existing = await this.db
        .select({ id: splitDayAssignments.id })
        .from(splitDayAssignments)
        .where(and(eq(splitDayAssignments.userId, userId), eq(splitDayAssignments.weekday, wNum)))
        .limit(1);
      const rowId = existing[0]?.id as string | undefined;
      await this.db.delete(splitDayAssignments).where(and(eq(splitDayAssignments.userId, userId), eq(splitDayAssignments.weekday, wNum))).run();
      if (rowId) {
        await enqueueOutbox(this.sqlite, { table: 'split_day_assignments', op: 'delete', rowId });
      }
      return true;
    }
    // Check if a row already exists for (user, weekday)
    const before = await this.db
      .select({ id: splitDayAssignments.id })
      .from(splitDayAssignments)
      .where(and(eq(splitDayAssignments.userId, userId), eq(splitDayAssignments.weekday, wNum)))
      .limit(1);
    const existed = !!before[0]?.id;
    const existingId = before[0]?.id as string | undefined;

    // Upsert locally
    const id = existed ? existingId! : newUuid();
    await this.db
      .insert(splitDayAssignments)
      .values({ id, userId, weekday: wNum, splitId })
      .onConflictDoUpdate({
        target: [splitDayAssignments.userId, splitDayAssignments.weekday],
        set: { splitId },
      })
      .run();

    const op: 'insert' | 'update' = existed ? 'update' : 'insert';
    const rowId = id;
    // Do not include created_at/updated_at: these columns don't exist on the remote table
    const payload = { id: rowId, user_id: userId, weekday: wNum, split_id: splitId } as const;
    await enqueueOutbox(this.sqlite, { table: 'split_day_assignments', op, rowId, payload });
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
      // Enqueue outbox insert for remote
      await enqueueOutbox(this.sqlite, {
        table: 'split_exercises',
        op: 'insert',
        rowId: id,
        payload: {
          id,
          split_id: splitId,
          exercise_id: exId,
          order_pos: nextOrder,
        }
      });
      nextOrder += 1;
    }
    return true;
  }

  async removeExerciseFromSplit(splitId: string, exerciseId: string) {
    // Find the row id for outbox deletion
    const row = await this.db
      .select({ id: splitExercises.id })
      .from(splitExercises)
      .where(and(eq(splitExercises.splitId, splitId), eq(splitExercises.exerciseId, exerciseId)))
      .limit(1);
    const rowId = row[0]?.id as string | undefined;
    await this.db
      .delete(splitExercises)
      .where(and(eq(splitExercises.splitId, splitId), eq(splitExercises.exerciseId, exerciseId)))
      .run();
    if (rowId) {
      await enqueueOutbox(this.sqlite, { table: 'split_exercises', op: 'delete', rowId });
    }

    // Renormalize order positions
    const rows = await this.db
      .select({ id: splitExercises.id })
      .from(splitExercises)
      .where(eq(splitExercises.splitId, splitId))
      .orderBy(asc(splitExercises.orderPos));
    let pos = 1;
    for (const r of rows) {
      await this.db.update(splitExercises).set({ orderPos: pos }).where(eq(splitExercises.id, r.id)).run();
      await enqueueOutbox(this.sqlite, { table: 'split_exercises', op: 'update', rowId: r.id as string, payload: { id: r.id, order_pos: pos } });
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
      await enqueueOutbox(this.sqlite, { table: 'split_exercises', op: 'update', rowId, payload: { id: rowId, order_pos: pos } });
      pos += 1;
    }
    return true;
  }

  async createExercise(data: { name: string; modality?: string; bodyPart?: string }) {
    const id = newUuid();
    const normalized = normalizeExerciseInput({ name: data.name, modality: data.modality, bodyPart: data.bodyPart });
    const slug = ensureSlug({ name: normalized.name, isPublic: true });
    await this.db.insert(exerciseCatalog).values({
      id,
      name: normalized.name,
      modality: normalized.modality,
      bodyPart: normalized.bodyPart ?? null,
      slug,
      createdAt: sql`CURRENT_TIMESTAMP` as any,
      updatedAt: sql`CURRENT_TIMESTAMP` as any,
    }).run();
    return { id, name: normalized.name, modality: normalized.modality, bodyPart: normalized.bodyPart };
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
