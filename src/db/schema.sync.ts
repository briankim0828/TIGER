// schema.sync.ts
// CP6 MVP Sync Schema Slice
// Contains ONLY the tables targeted for initial real-time replication (ElectricSQL + Supabase).
// Keep this file intentionally minimal to avoid creating unused remote tables.
// If you need to add a new table to replication, FIRST add it to SYNC_TABLES in sync/manifest.ts,
// then add its definition here, regenerate migrations, and apply.

import { pgTable, uuid, text, boolean, integer, timestamp, date, pgEnum, index, unique, pgSchema } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/* =========================
   ENUMS (only those required by MVP tables)
   ========================= */
// Simplified session state: only 'active' and 'completed' per product decision
export const sessionState = pgEnum('session_state', ['active','completed']);
export const modality = pgEnum('modality', [
  'barbell','dumbbell','kettlebell','machine','smith','cable','bodyweight'
]);
export const bodyPartEnum = pgEnum('body_part', [
  'chest','back','leg','shoulder','triceps','biceps','core','forearm','cardio'
]);

/* =========================
   AUTH REFERENCE (shadow only)
   ========================= */
// NOTE: We DO NOT create or migrate the Supabase auth.users table. Use schema-qualified reference.
// IMPORTANT: The baseline migration must NOT include a CREATE TABLE for auth.users.
// If a generated migration includes that, remove it manually before applying.
const auth = pgSchema('auth');
export const authUsers = auth.table('users', {
  id: uuid('id').primaryKey(),
});

/* =========================
   EXERCISE CATALOG (public + user custom)
   ========================= */
export const exerciseCatalog = pgTable('exercise_catalog', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  modality: modality('modality').notNull(),
  bodyPart: bodyPartEnum('body_part'),
  defaultRestSec: integer('default_rest_sec'),
  mediaThumbUrl: text('media_thumb_url'),
  mediaVideoUrl: text('media_video_url'),
  isPublic: boolean('is_public').notNull().default(true),
  ownerUserId: uuid('owner_user_id').references(() => authUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('idx_exercise_catalog_owner').on(t.ownerUserId),
}));

/* =========================
   SPLITS (program template skeleton)
   ========================= */
export const splits = pgTable('splits', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  orderPos: integer('order_pos'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_splits_user').on(t.userId),
  userOrderUnique: unique().on(t.userId, t.orderPos),
}));

export const splitDayAssignments = pgTable('split_day_assignments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 0..6 (CHECK constraint optional later)
  splitId: uuid('split_id').notNull().references(() => splits.id, { onDelete: 'cascade' }),
}, (t) => ({
  uniq: unique().on(t.userId, t.weekday),
}));

export const splitExercises = pgTable('split_exercises', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  splitId: uuid('split_id').notNull().references(() => splits.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull().references(() => exerciseCatalog.id),
  orderPos: integer('order_pos').notNull(),
  restSecDefault: integer('rest_sec_default'),
  notes: text('notes'),
}, (t) => ({
  uniqOrder: unique().on(t.splitId, t.orderPos),
  splitIdx: index('idx_split_exercises_split').on(t.splitId),
}));

/* =========================
   WORKOUT SESSIONS & EXECUTION
   ========================= */
export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  state: sessionState('state').notNull().default('active'),
  // plannedForDate column removed
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  splitId: uuid('split_id').references(() => splits.id),
  note: text('note'),
  energyKcal: integer('energy_kcal'),
  totalVolumeKg: integer('total_volume_kg'), // simplified (precision numeric deferred)
  totalSets: integer('total_sets'),
  durationSec: integer('duration_sec'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userStateIdx: index('idx_sessions_user_state').on(t.userId, t.state),
}));

export const workoutExercises = pgTable('workout_exercises', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull().references(() => exerciseCatalog.id),
  orderPos: integer('order_pos').notNull(),
  restSecDefault: integer('rest_sec_default'),
  fromSplitExerciseId: uuid('from_split_exercise_id').references(() => splitExercises.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOrder: unique().on(t.sessionId, t.orderPos),
  sessionIdx: index('idx_workout_exercises_session').on(t.sessionId),
  exerciseIdx: index('idx_workout_exercises_ex').on(t.exerciseId),
}));

export const workoutSets = pgTable('workout_sets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workoutExerciseId: uuid('workout_exercise_id').notNull().references(() => workoutExercises.id, { onDelete: 'cascade' }),
  setOrder: integer('set_order').notNull(),
  isWarmup: boolean('is_warmup').notNull().default(false),
  weightKg: integer('weight_kg'),
  reps: integer('reps'),
  durationSec: integer('duration_sec'),
  distanceM: integer('distance_m'),
  restSec: integer('rest_sec'),
  isCompleted: boolean('is_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOrder: unique().on(t.workoutExerciseId, t.setOrder),
  weIdx: index('idx_workout_sets_ex').on(t.workoutExerciseId),
}));

/* =========================
   TYPES (subset)
   ========================= */
export type Exercise = typeof exerciseCatalog.$inferSelect;
export type InsertExercise = typeof exerciseCatalog.$inferInsert;
export type Split = typeof splits.$inferSelect;
export type InsertSplit = typeof splits.$inferInsert;
export type SplitExercise = typeof splitExercises.$inferSelect;
export type InsertSplitExercise = typeof splitExercises.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type InsertWorkoutExercise = typeof workoutExercises.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;
