import { sqliteTable, text, integer, uniqueIndex, index, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// SQLite schema mirroring the current local tables used by Program Builder

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind'),
  modality: text('modality'),
  defaultRestSec: integer('default_rest_sec'),
  bodyPart: text('body_part'),
  createdAt: text('created_at'),
});

export const splits = sqliteTable('splits', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color'),
  isActive: integer('is_active'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const splitExercises = sqliteTable('split_exercises', {
  id: text('id').primaryKey(),
  splitId: text('split_id').notNull(),
  exerciseId: text('exercise_id').notNull(),
  orderPos: integer('order_pos').notNull(),
  restSecDefault: integer('rest_sec_default'),
  notes: text('notes'),
});

export const splitDayAssignments = sqliteTable(
  'split_day_assignments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    weekday: text('weekday').notNull(), // e.g. 'Monday'
    splitId: text('split_id').notNull(),
  },
  (table) => ({
    // Mirror the UNIQUE(user_id, weekday) used by the raw SQL initializer
    userWeekdayUnique: uniqueIndex('split_day_user_weekday_uq').on(table.userId, table.weekday),
  })
);

// Convenience SQL helpers
export const count = (expr: any) => sql<number>`count(${expr})`;

export type ExerciseRowSqlite = typeof exercises.$inferSelect;
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
    userId: text('user_id').notNull(),
    splitId: text('split_id'),
    // Keep naming consistent with Simple layer
    state: text('state').notNull().default('active'), // 'active' | 'completed' | 'cancelled'
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userStateIdx: index('idx_workout_sessions_user_state').on(table.userId, table.state),
  })
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    orderPos: integer('order_pos').notNull(),
    restSecDefault: integer('rest_sec_default'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionIdx: index('idx_workout_exercises_session').on(table.sessionId),
    uniqOrder: uniqueIndex('workout_exercises_order_uq').on(table.sessionId, table.orderPos),
  })
);

export const workoutSets = sqliteTable(
  'workout_sets',
  {
    id: text('id').primaryKey(),
    sessionExerciseId: text('session_exercise_id').notNull(), // FK → workout_exercises.id
    setIndex: integer('set_index').notNull(),
    // Basic logging fields (strength/cardio)
    weight: real('weight'),
    reps: integer('reps'),
    rpe: real('rpe'),
    completed: integer('completed').default(0), // 0/1 boolean
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    sessionExerciseIdx: index('idx_workout_sets_session_exercise').on(table.sessionExerciseId),
    uniqSetOrder: uniqueIndex('workout_sets_order_uq').on(table.sessionExerciseId, table.setIndex),
  })
);

export type WorkoutSessionRowSqlite = typeof workoutSessions.$inferSelect;
export type WorkoutExerciseRowSqlite = typeof workoutExercises.$inferSelect;
export type WorkoutSetRowSqlite = typeof workoutSets.$inferSelect;
