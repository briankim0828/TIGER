// Schema Slice for CP6 MVP sync
// Re-export only the Postgres tables we plan to replicate initially.
// This allows Electric initialization to scope to a narrow set while the full schema.ts remains the future superset.

export { splits, splitDayAssignments, splitExercises, workoutSessions, workoutExercises, workoutSets } from '../schema';
