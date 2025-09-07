// src/db/schema.ts
import {
  pgTable, uuid, text, boolean, integer, timestamp, date, numeric, smallint,
  pgEnum, index, unique, primaryKey, type AnyPgColumn
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* =========================
   ENUMS
   ========================= */
export const sessionState = pgEnum("session_state", ["planned","active","completed","discarded"]);
export const mediaType = pgEnum("media_type", ["photo","video"]);
export const goalType = pgEnum("goal_type", ["max_weight","est_1rm","volume","reps_at_weight"]);
// Consolidated modality enum (replaces prior separate exercise_kind + modality concepts)
export const modality = pgEnum("modality", [
  "barbell","dumbbell","kettlebell","machine","smith","cable","bodyweight"
]);
// Body part enum (broad grouping – taxonomy tables may supersede later)
export const bodyPartEnum = pgEnum("body_part", [
  "chest","back","leg","shoulder","triceps","biceps","core","forearm","cardio"
]);
export const muscleRole = pgEnum("muscle_role", ["primary","secondary","stabilizer"]);
export const unitSystem = pgEnum("unit_system", ["metric","imperial"]);

/* =========================
   USER SETTINGS
   ========================= */
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  unitPref: unitSystem("unit_pref").notNull().default("metric"),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  defaultRestSec: integer("default_rest_sec").notNull().default(120),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Minimal auth.users shadow (foreign-key target). Do not migrate/own this table.
// Supabase creates it; we only reference its id.
export const authUsers = pgTable("auth.users", {
  id: uuid("id").primaryKey(),
});

/* =========================
   EXERCISE CATALOG & TAXONOMY
   ========================= */
export const exerciseCatalog = pgTable("exercise_catalog", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  // Single modality dimension (combines previous kind + modality semantics)
  modality: modality("modality").notNull(),
  // Broad body part grouping – optional; future taxonomy may replace
  bodyPart: bodyPartEnum("body_part"),
  defaultRestSec: integer("default_rest_sec"),
  mediaThumbUrl: text("media_thumb_url"),
  mediaVideoUrl: text("media_video_url"),
  isPublic: boolean("is_public").notNull().default(true),
  ownerUserId: uuid("owner_user_id").references(() => authUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // tsvector "search" column is best added via raw SQL migration; omitted here.
}, (t) => ({
  ownerIdx: index("idx_exercise_catalog_owner").on(t.ownerUserId),
}));

export const muscleGroups = pgTable("muscle_groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  parentId: uuid("parent_id").references(((): AnyPgColumn => muscleGroups.id)),
});

export const exerciseMuscles = pgTable("exercise_muscles", {
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id, { onDelete: "cascade" }),
  muscleGroupId: uuid("muscle_group_id").notNull().references(() => muscleGroups.id, { onDelete: "cascade" }),
  role: muscleRole("role").notNull().default("primary"),
}, (t) => ({
  pk: primaryKey({ columns: [t.exerciseId, t.muscleGroupId, t.role] }),
}));

export const userFavoriteExercises = pgTable("user_favorite_exercises", {
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.exerciseId] }),
}));

export const userExercisePrefs = pgTable("user_exercise_prefs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id, { onDelete: "cascade" }),
  defaultRestSec: integer("default_rest_sec"),
  notes: text("notes"),
}, (t) => ({
  uniq: unique().on(t.userId, t.exerciseId),
}));

/* =========================
   SPLITS (TEMPLATES)
   ========================= */
export const splits = pgTable("splits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("idx_splits_user").on(t.userId),
}));

export const splitDayAssignments = pgTable("split_day_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(), // 0..6 (validate in app or add CHECK via raw SQL)
  splitId: uuid("split_id").notNull().references(() => splits.id, { onDelete: "cascade" }),
}, (t) => ({
  uniq: unique().on(t.userId, t.weekday),
}));

export const splitExercises = pgTable("split_exercises", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  splitId: uuid("split_id").notNull().references(() => splits.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id),
  orderPos: integer("order_pos").notNull(),
  restSecDefault: integer("rest_sec_default"),
  notes: text("notes"),
}, (t) => ({
  uniqOrder: unique().on(t.splitId, t.orderPos),
  splitIdx: index("idx_split_exercises_split").on(t.splitId),
}));

export const splitExerciseSets = pgTable("split_exercise_sets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  splitExerciseId: uuid("split_exercise_id").notNull().references(() => splitExercises.id, { onDelete: "cascade" }),
  setOrder: integer("set_order").notNull(),
  targetReps: integer("target_reps"),
  targetWeightKg: numeric("target_weight_kg", { precision: 7, scale: 2 }),
  rir: smallint("rir"),
}, (t) => ({
  uniqOrder: unique().on(t.splitExerciseId, t.setOrder),
}));

/* =========================
   WORKOUT SESSIONS
   ========================= */
export const workoutSessions = pgTable("workout_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  state: sessionState("state").notNull().default("planned"),
  plannedForDate: date("planned_for_date"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  splitId: uuid("split_id").references(() => splits.id),
  note: text("note"),
  energyKcal: integer("energy_kcal"),
  totalVolumeKg: numeric("total_volume_kg", { precision: 12, scale: 2 }),
  totalSets: integer("total_sets"),
  durationSec: integer("duration_sec"),
  mediaCount: integer("media_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDateIdx: index("idx_sessions_user_date").on(t.userId, t.plannedForDate),
  userStateIdx: index("idx_sessions_user_state").on(t.userId, t.state),
}));

export const sessionMedia = pgTable("session_media", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  kind: mediaType("kind").notNull(),
  storagePath: text("storage_path").notNull(), // Supabase Storage path
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index("idx_session_media_session").on(t.sessionId),
}));

export const workoutExercises = pgTable("workout_exercises", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id),
  orderPos: integer("order_pos").notNull(),
  restSecDefault: integer("rest_sec_default"),
  fromSplitExerciseId: uuid("from_split_exercise_id").references(() => splitExercises.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOrder: unique().on(t.sessionId, t.orderPos),
  sessionIdx: index("idx_workout_exercises_session").on(t.sessionId),
  exerciseIdx: index("idx_workout_exercises_ex").on(t.exerciseId),
}));

export const workoutSets = pgTable("workout_sets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutExerciseId: uuid("workout_exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
  setOrder: integer("set_order").notNull(),
  isWarmup: boolean("is_warmup").notNull().default(false),
  weightKg: numeric("weight_kg", { precision: 7, scale: 2 }),
  reps: integer("reps"),
  durationSec: integer("duration_sec"),
  distanceM: numeric("distance_m", { precision: 9, scale: 2 }),
  effortRpe: numeric("effort_rpe", { precision: 3, scale: 1 }),
  restSecPlanned: integer("rest_sec_planned"),
  restSecActual: integer("rest_sec_actual"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  removed: boolean("removed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqOrder: unique().on(t.workoutExerciseId, t.setOrder),
  weIdx: index("idx_workout_sets_ex").on(t.workoutExerciseId),
}));

/* =========================
   GOALS & MILESTONES
   ========================= */
export const userExerciseGoals = pgTable("user_exercise_goals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id),
  kind: goalType("kind").notNull(),
  targetWeightKg: numeric("target_weight_kg", { precision: 7, scale: 2 }),
  targetReps: integer("target_reps"),
  targetVolumeKg: numeric("target_volume_kg", { precision: 12, scale: 2 }),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userExerciseIdx: index("idx_goals_user_ex").on(t.userId, t.exerciseId),
}));

export const milestoneEvents = pgTable("milestone_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id").notNull().references(() => exerciseCatalog.id),
  goalId: uuid("goal_id").references(() => userExerciseGoals.id),
  achievedAt: timestamp("achieved_at", { withTimezone: true }).notNull().defaultNow(),
  metricValue: numeric("metric_value", { precision: 12, scale: 2 }),
  kindText: text("kind").notNull().default("hit"), // "hit" | "surpassed" (string for flexibility)
}, (t) => ({
  userDateIdx: index("idx_milestones_user_date").on(t.userId, t.achievedAt),
}));

/* =========================
   RELATIONS (optional but handy)
   ========================= */
export const exerciseCatalogRelations = relations(exerciseCatalog, ({ many }) => ({
  muscles: many(exerciseMuscles),
  favorites: many(userFavoriteExercises),
  prefs: many(userExercisePrefs),
}));

export const splitsRelations = relations(splits, ({ many }) => ({
  splitExercises: many(splitExercises),
}));

export const splitExercisesRelations = relations(splitExercises, ({ one, many }) => ({
  split: one(splits, { fields: [splitExercises.splitId], references: [splits.id] }),
  exercise: one(exerciseCatalog, { fields: [splitExercises.exerciseId], references: [exerciseCatalog.id] }),
  sets: many(splitExerciseSets),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ many, one }) => ({
  split: one(splits, { fields: [workoutSessions.splitId], references: [splits.id] }),
  exercises: many(workoutExercises),
  media: many(sessionMedia),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ one, many }) => ({
  session: one(workoutSessions, { fields: [workoutExercises.sessionId], references: [workoutSessions.id] }),
  exercise: one(exerciseCatalog, { fields: [workoutExercises.exerciseId], references: [exerciseCatalog.id] }),
  sets: many(workoutSets),
}));

/* =========================
   TYPES
   ========================= */
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

export type Exercise = typeof exerciseCatalog.$inferSelect;
export type InsertExercise = typeof exerciseCatalog.$inferInsert;

export type MuscleGroup = typeof muscleGroups.$inferSelect;
export type InsertMuscleGroup = typeof muscleGroups.$inferInsert;

export type Split = typeof splits.$inferSelect;
export type InsertSplit = typeof splits.$inferInsert;

export type SplitExercise = typeof splitExercises.$inferSelect;
export type InsertSplitExercise = typeof splitExercises.$inferInsert;

export type SplitExerciseSet = typeof splitExerciseSets.$inferSelect;
export type InsertSplitExerciseSet = typeof splitExerciseSets.$inferInsert;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;

export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type InsertWorkoutExercise = typeof workoutExercises.$inferInsert;

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;

export type UserExerciseGoal = typeof userExerciseGoals.$inferSelect;
export type InsertUserExerciseGoal = typeof userExerciseGoals.$inferInsert;

export type MilestoneEvent = typeof milestoneEvents.$inferSelect;
export type InsertMilestoneEvent = typeof milestoneEvents.$inferInsert;

export type UserExercisePref = typeof userExercisePrefs.$inferSelect;
export type InsertUserExercisePref = typeof userExercisePrefs.$inferInsert;

export type UserFavoriteExercise = typeof userFavoriteExercises.$inferSelect;
export type InsertUserFavoriteExercise = typeof userFavoriteExercises.$inferInsert;
