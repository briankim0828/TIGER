// CP6 Sync Manifest: defines which tables participate in initial cloud replication.
// Keep this minimal; expand only when a new feature depends on remote sync.
// Tables here must exist in both local SQLite and the remote Postgres project.

export const SYNC_TABLES = [
  // Program builder core
  'splits',
  'split_day_assignments',
  'split_exercises',
  // Exercise catalog now aligned & seeded
  'exercise_catalog',
  // Active workout flow (subset; columns not yet fully aligned, see Phase B notes)
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
] as const;

export type SyncTable = typeof SYNC_TABLES[number];

// Tables defined in schema but intentionally excluded for MVP (add later when needed):
// - user_settings
// - exercise_muscles, muscle_groups, user_favorite_exercises, user_exercise_prefs
// - split_exercise_sets (template sets) // not yet used by UI
// - session_media, user_exercise_goals, milestone_events
// - taxonomy tables pending: exercise_muscles, muscle_groups, etc.
