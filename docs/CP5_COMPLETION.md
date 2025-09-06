# CP5 Completion: Legacy Data Layer Retirement

Date: 2025-09-06
Branch: dataflow-overhaul

## Objective
Hard cut removal of legacy AsyncStorage & DataContext based data layer, consolidating all workout/program storage onto local SQLite via Drizzle. Data loss was explicitly accepted, allowing simplified implementation (no migration).

## Key Changes
- Added `workoutHistory.drizzle.ts` with calendar + stats queries (getWorkoutCalendarEntries, getWorkoutStats, deleteAllWorkouts).
- Introduced `useWorkoutHistory` hook via query index.
- Refactored `ProgressScreen` & `ProfileScreen` to use history & stats queries; removed `DataContext` usage.
- Removed legacy provider wrapper from `App.tsx`.
- Migrated primitive constants (WEEKDAYS, BODY_PARTS, WeekDay, BodyPart) into `src/types/base.ts`.
- Simplified seeding logic in `simple.ts` with `MINI_SEED` list (no giant default constant retained).
- Added new UI type `WorkoutCalendarEntry` to `src/types/ui.ts`.
- Cleaned `SessionSummaryModal` & other components to rely only on new query layer.
- Manually deleted legacy files: `src/contexts/DataContext.tsx`, `src/services/data.ts`, `src/supabase/supabaseWorkout.ts`, `src/supabase/supabaseSplits.ts`, `src/types/index.ts`.
 - Pruned unused Supabase workout stat/delete helpers from `supabaseProfile.ts` (now fully local via `useWorkoutHistory`).

## Removed Concepts
- Centralized React Context state for workouts/splits.
- AsyncStorage caching & manual synchronization stubs.
- Supabase workout & split persistence code (auth only retained elsewhere).
- Large static exercise seed map (replaced by minimal inline seed).

## Current Data Access Pattern
UI -> hooks (`useWorkouts`, `useWorkoutHistory`, etc.) -> data access classes -> Drizzle (SQLite).

## Follow Ups (Optional)
- Integrate ElectricSQL replication layer (CP6) using the consolidated query interfaces.
- Expand exercise seed set progressively or fetch from remote catalog.
- Add automated tests around stats aggregation & calendar generation.
- Consider pruning any unused Supabase profile helpers after CP6 integration decisions.

## Validation
- Grep confirms no lingering references to legacy types/functions (useData, StoredWorkoutSession, WorkoutDay, DEFAULT_EXERCISES_BY_BODY_PART).
- Updated imports: `WeekDay` now sourced from `types/base`.

End of CP5.
