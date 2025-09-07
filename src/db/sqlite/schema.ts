// Phase 1 FK Enforcement: added local foreign key references with cascades where
// safe. User/account ownership FKs intentionally deferred to Phase 2 to avoid
// premature coupling with auth. If you need to reset the local dev DB after
// this change, delete the SQLite file (or run a reset script) so tables are
// recreated with constraints.
import { sqliteTable, text, integer, uniqueIndex, index, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Harmonized exercise catalog table (exercises -> exercise_catalog) with parity columns
export const exerciseCatalog = sqliteTable(
  'exercise_catalog',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug'),
  // Consolidated modality (previously kind + modality)
  modality: text('modality').notNull(),
  // Body part broad grouping (enum in Postgres, free text locally with validator)
  bodyPart: text('body_part'),
    defaultRestSec: integer('default_rest_sec'),
    mediaThumbUrl: text('media_thumb_url'),
    mediaVideoUrl: text('media_video_url'),
    isPublic: integer('is_public').notNull().default(1),
    ownerUserId: text('owner_user_id'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    slugUnique: uniqueIndex('exercise_catalog_slug_uq').on(table.slug),
    ownerIdx: index('idx_exercise_catalog_owner').on(table.ownerUserId),
  })
);

export const splits = sqliteTable(
  'splits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    // Stable ordering for splits list
    orderPos: integer('order_pos'),
    isActive: integer('is_active').notNull().default(1),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
  userOrderUnique: uniqueIndex('splits_user_order_uq').on(table.userId, table.orderPos),
  userIdx: index('idx_splits_user').on(table.userId),
  })
);

export const splitExercises = sqliteTable(
  'split_exercises',
  {
    id: text('id').primaryKey(),
    splitId: text('split_id').notNull().references(() => splits.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').notNull().references(() => exerciseCatalog.id, { onDelete: 'no action' }),
    orderPos: integer('order_pos').notNull(),
    restSecDefault: integer('rest_sec_default'),
    notes: text('notes'),
  },
  (table) => ({
    splitIdx: index('idx_split_exercises_split').on(table.splitId),
    splitOrderUnique: uniqueIndex('split_exercises_split_order_uq').on(table.splitId, table.orderPos),
  })
);

export const splitDayAssignments = sqliteTable(
  'split_day_assignments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // user FK deferred to Phase 2
    weekday: integer('weekday').notNull(),
    splitId: text('split_id').notNull().references(() => splits.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    userWeekdayUnique: uniqueIndex('split_day_user_weekday_uq').on(table.userId, table.weekday),
  })
);

// Convenience SQL helpers
export const count = (expr: any) => sql<number>`count(${expr})`;

export type ExerciseRowSqlite = typeof exerciseCatalog.$inferSelect;
export type SplitRowSqlite = typeof splits.$inferSelect;
export type SplitExerciseRowSqlite = typeof splitExercises.$inferSelect;
export type SplitDayAssignmentRowSqlite = typeof splitDayAssignments.$inferSelect;

// ==========================
// Active Workout (SQLite)
// Aligns with existing Simple layer naming
// ==========================

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // user FK deferred to Phase 2
    splitId: text('split_id').references(() => splits.id, { onDelete: 'set null' }),
    state: text('state').notNull().default('active'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    note: text('note'),
    energyKcal: integer('energy_kcal'),
    totalVolumeKg: integer('total_volume_kg'),
    totalSets: integer('total_sets'),
    durationSec: integer('duration_sec'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userStateIdx: index('idx_workout_sessions_user_state').on(table.userId, table.state),
  })
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id').notNull().references(() => exerciseCatalog.id, { onDelete: 'no action' }),
    orderPos: integer('order_pos').notNull(),
    restSecDefault: integer('rest_sec_default'),
    fromSplitExerciseId: text('from_split_exercise_id').references(() => splitExercises.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionIdx: index('idx_workout_exercises_session').on(table.sessionId),
    exerciseIdx: index('idx_workout_exercises_ex').on(table.exerciseId),
    uniqOrder: uniqueIndex('workout_exercises_order_uq').on(table.sessionId, table.orderPos),
  })
);

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id').notNull().references(() => workoutExercises.id, { onDelete: 'cascade' }),
    setOrder: integer('set_order').notNull(),
    isWarmup: integer('is_warmup').notNull().default(0),
    weightKg: integer('weight_kg'),
    reps: integer('reps'),
    durationSec: integer('duration_sec'),
    distanceM: integer('distance_m'),
    restSec: integer('rest_sec'),
    isCompleted: integer('is_completed').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionExerciseIdx: index('idx_workout_sets_ex').on(table.workoutExerciseId),
    uniqSetOrder: uniqueIndex('workout_sets_order_uq').on(table.workoutExerciseId, table.setOrder),
  })
);

export type WorkoutSessionRowSqlite = typeof workoutSessions.$inferSelect;
export type WorkoutExerciseRowSqlite = typeof workoutExercises.$inferSelect;
export type WorkoutSetRowSqlite = typeof workoutSets.$inferSelect;
