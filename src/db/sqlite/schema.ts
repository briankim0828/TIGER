import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
