# Side Utilities and Supporting Modules

This document explains the small but important utility modules that support the app. They are not main screens/components but are actively used in the current data model (SQLite + Drizzle) and will remain relevant after the dataflow overhaul (CP4a) and into CP4b (live queries). Irrelevant/legacy-only modules per the plan are omitted.

## Contexts

- `src/contexts/WorkoutContext.tsx`
  - What: Thin facade providing transactional workout operations (start/end session, add/update/delete set, add/remove/reorder session exercises) and helpers (get active session, fetch snapshot, get split name/info).
  - Why: Keeps UI free of SQL/DAO details; ensures a stable interface for workout features.
  - Used by: `ActiveWorkoutModal`, `App.tsx` modal container/banner, `ProgressScreen` to start sessions.

- `src/contexts/OverlayContext.tsx`
  - What: Simple overlay manager for temporary UI overlays (e.g., session summary modal trigger).
  - Why: Decouples overlay state from individual screens.
  - Used by: `ProgressScreen`, `SessionSummaryModal` trigger.

## Navigation helpers

- `src/navigation/rootNavigation.ts`
  - What: Global navigation ref + `navigate(name, params)` helper.
  - Why: Allows navigation from modules rendered outside a screen navigator (e.g., ActiveWorkoutModal).
  - Used by: `ActiveWorkoutModal` (launch selection modal), other global actions.

- `src/navigation/layoutMetrics.ts`
  - What: Tracks bottom navbar height and provides subscription to changes.
  - Why: Mini banners and sheets need to respect dynamic insets/heights.
  - Used by: `ActiveWorkoutBanner` for container margin alignment.

- `src/navigation/selectionRegistry.ts`
  - What: Tiny registry to route selected exercises back to any caller via a requestId without passing callbacks through navigation state.
  - API: `registerSelectionCallback(id, cb)`, `consumeSelectionCallback(id)`.
  - Used by: `ActiveWorkoutModal` (session add), `ExerciseSelectionView` (generic selection return).

## Electric/DB access

- `src/electric/provider.tsx` and `src/electric/index.ts`
  - What: Initializes and exposes the SQLite/Drizzle client via React context.
  - Why: Single DB instance with stable lifetime; consumers access through hooks.
  - Used by: `src/db/queries/index.ts` hooks; all DAO classes.

- `src/db/queries/index.ts`
  - What: Exports hooks: `useDatabase()` (Program Builder DAO) and `useWorkouts()` (Workouts DAO).
  - Why: Central access point; memoizes DAO instances bound to the DB.
  - Used by: Screens/components and contexts across the app.

- `src/db/queries/programBuilder.drizzle.ts`
  - What: Drizzle-backed DAO for Program Builder (splits, split exercises, day assignments, exercise catalog).
  - Why: Typed, ordered, idempotent reads/writes replacing ad-hoc SQL.
  - Used by: `WorkoutScreen`, `MySplits`, `SplitDetailScreen`, `ExerciseSelectionView`.

- `src/db/queries/workouts.drizzle.ts`
  - What: Drizzle-backed DAO for Active Workout (sessions, session exercises, sets) with transactions and unique-index guarantees.
  - Why: Ensures atomicity and stable ordering; supports concurrent taps.
  - Used by: `WorkoutContext` and, via it, `ActiveWorkoutModal` and app shell.

## Types

- `src/types/ui.ts`
  - What: UI view-model types (e.g., ProgramSplit, ProgramSplitWithExercises, ProgramEditMode).
  - Why: Keep UI shapes clean and independent of DB snake_case.
  - Used by: Program Builder screens/components.

- `src/types/index.ts`
  - What: Domain types shared by multiple features (e.g., Exercise, body part enums/constants).
  - Why: Common primitives and constants used in selection and grouping.
  - Used by: `ExerciseSelectionView`, Program Builder.

## Utilities

- `src/utils/ids.ts`
  - What: UUID generator and helpers for IDs.
  - Why: Consistent ID creation for inserts across DAOs.
  - Used by: DAO implementations (e.g., `workouts.drizzle.ts`).

- `src/utils/uuid.ts`
  - What: Cross-platform UUID helper used in legacy areas and migrations.
  - Why: Backward compatibility; some modules still import this directly.
  - Used by: Older code paths; new code prefers `utils/ids.ts`.

- `src/utils/supabaseClient.js`
  - What: Supabase client for auth/session.
  - Why: Authentication; data CRUD has moved to local SQLite.
  - Used by: `App.tsx` login/auth state.

## Service layer (kept if still referenced)

- `src/services/data.ts`
  - What: Legacy/simple data helpers used by non‑workout features.
  - Note: This is slated for retirement once all screens complete the migration; not used on the active workout path.

## What’s intentionally omitted (legacy to retire per plan)
- Legacy `DataContext.tsx` and any AsyncStorage‑driven persistence that will be removed post‑migration.
- Supabase CRUD shims under `src/supabase/*` that duplicate local DB responsibilities.

