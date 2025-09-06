# CP6 Plan: Cloud Deployment & Sync (In Progress)

Status: Phase B (Schema Alignment – Harmonization Partially Complete)
Date: 2025-09-06
Branch: dataflow-overhaul

## Objective
Introduce real cloud synchronization (Supabase + ElectricSQL) while constraining scope to an MVP table set. Maintain forward compatibility with broader `schema.ts` for future features.

## Phase A – Table Scope Definition (Complete)
Selected MVP sync tables (see `src/db/sync/manifest.ts`):
- splits
- split_day_assignments
- split_exercises
- exercise_catalog
- workout_sessions
- workout_exercises
- workout_sets

Excluded (future): user_settings, taxonomy & personalization tables, template sets, media, goals, milestones. Rationale: current UI does not surface these yet; excluding them reduces replication & policy complexity.

## Rationale
- Minimize initial RLS policy surface.
- Reduce replication metadata churn.
- Allow fast iteration on core workout & program flows before layering advanced analytics and taxonomy.

## Next (Phase B – Schema Alignment & Migrations)
1. Extract or reference an MVP schema slice (option: lightweight adapter that re-exports only needed table definitions).
2. Generate fresh migrations if required; otherwise reuse existing migration if already aligned.
3. Prepare Supabase project (empty) for applying migrations.

---
(Plan will be appended as phases complete.)

## Phase B – Schema Alignment & Harmonization (Sub‑component: Exercise Catalog)

### Goal
Ensure local SQLite schema for the exercise catalog matches (a subset of) remote Postgres `exercise_catalog` early, avoiding a costly rename & column backfill after replication is live.

### Harmonization Sub‑Plan (Executed + Pending)

Checklist & Decisions (User Confirmed):
- Table strategy: Replace legacy `exercises` with `exercise_catalog` (create new, drop old). DONE
- Column parity: Add slug, media_thumb_url, media_video_url, is_public, owner_user_id, updated_at. DONE
- Enum normalization: Use code‑side constant arrays + validator (no local DB enum constraint). PENDING (validator)
- ID & FK strategy: Keep existing IDs (no re-ID rewrite now); future rows use UUIDs. DONE (decision) / PENDING (optional audit)
- Data migration: Accept data loss; reseed later from deterministic seed list. DONE (dropped old table)
- Seed strategy: Introduce slug-based idempotent upsert (planned). PENDING
- Code refactor: Update all imports/queries/schema references to `exercise_catalog`. DONE
- Placeholder media: Leave columns null, UI provides fallback. DONE (decision)
- Sync manifest reinclusion: Re-add `exercise_catalog` after seeding & validator. PENDING
- Testing & validation: Typecheck passes; runtime seed to be added. PARTIAL
- Rollback safety: Covered by create-new-then-drop approach (no complex data retained). DONE
- Follow-up taxonomy/search: Deferred to later CP phases. PENDING

### Current Diff Summary (Local vs Remote)
- Exercise catalog now structurally aligned for columns we care about; enums still free-form locally until validator added.
- `workout_sets` still simplified locally (set_index, weight, reps, rpe, completed) vs rich remote metrics (weight_kg, duration, distance, etc.) — will map minimal subset during initial sync and expand later.

### Artifacts & Code Changes
- Schema: `src/db/sqlite/schema.ts` now exports `exerciseCatalog`.
- Queries updated: `simple.ts`, `programBuilder.drizzle.ts`, `exercises.ts`, `workouts.ts`, `workouts.drizzle.ts`, `splits.ts`, `workoutHistory.drizzle.ts`.
- Manifest (still excluding exercise_catalog until seed/validator): `src/db/sync/manifest.ts`.
- Plan doc (this file) updated to reflect Phase A completion & Phase B progress.

### Pending Work (To Finish Phase B for Catalog)
1. Implement enum constants & runtime validator (kind/modality) + integrate into create/update paths.
2. Add deterministic slug generator + seed routine (idempotent upsert by slug, assigning is_public=1, owner_user_id NULL).
3. Re-add `exercise_catalog` to `SYNC_TABLES` & `schema.slice.ts` after seed in place.
4. Add lightweight updated_at maintenance (set on mutation) — partial already via default CURRENT_TIMESTAMP; ensure explicit updates on write paths.
5. (Optional now / later) Add migration notes for expanding workout_sets parity.

### Future (Post Harmonization / Later Phases)
- Taxonomy tables (muscle_groups, exercise_muscles) once UI needs tagging & filtering.
- RLS Policies (Phase C) — exercise_catalog policies will use: 
	- SELECT: is_public = true OR owner_user_id = auth.uid()
	- INSERT: owner_user_id = auth.uid()
	- UPDATE/DELETE: owner_user_id = auth.uid()
- Search indexing (remote: tsvector column + GIN index; local: simple LIKE fallback).
- User custom exercise creation & favorites integration.

## Upcoming Phase C – RLS & Auth Propagation (Preview)
Will draft policy SQL templates after exercise_catalog reincluded to avoid churn.

## Quality Status
- TypeScript typecheck: PASS
- Runtime migration risk: Low (table recreation already executed during development; seed still pending).

## Immediate Next Step (Recommended)
Implement enum constants + validator + seed routine, then re-enable exercise_catalog in sync manifest.

---
End of Day Snapshot (2025-09-06): Local catalog table harmonized (structure), seeding & enum enforcement still pending before turning on replication for exercises.
