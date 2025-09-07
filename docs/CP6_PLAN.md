# CP6 Plan: Cloud Deployment & Sync (In Progress)

Status: Phase B COMPLETE (Exercise Catalog Harmonized & Seeded)
Date: 2025-09-07
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

### Harmonization Summary (Completed)

Decisions & Outcomes:
- Table strategy: Legacy `exercises` fully replaced by `exercise_catalog` (drop + recreate). DONE
- Column parity: slug, media_* urls, is_public, owner_user_id, timestamps present. DONE
- Enum model CHANGE: Consolidated previous kind+modality into single `modality` enum plus `body_part` enum (Postgres) with code-side validation in SQLite. DONE
- Validation: Runtime normalizer ensures modality/bodyPart values are within allowed sets; invalid inputs dropped (bodyPart) or defaulted (modality→bodyweight). DONE
- IDs: All seeds & future inserts use UUID (no reuse of slug as id). DONE
- Seeding: Deterministic slug-based idempotent seed routine (`seedExerciseCatalog`) executed on bootstrap; ON CONFLICT DO NOTHING. DONE
- Slugs: Generated via `ensureSlug`; immutable post-insert. DONE
- Code refactor: All query layers and components updated; `kind` references removed. DONE
- updated_at maintenance: Explicitly set on mutation paths where needed. DONE (MVP scope)
- Sync manifest: `exercise_catalog` re-added to `SYNC_TABLES`. DONE
- Smoke test: Script `scripts/dev/smokeExerciseCatalog.ts` validates modality/bodyPart + slug format. DONE
- RLS templates: Added `docs/rls/exercise_catalog_policies.sql` for Phase C. DONE (prep only)
- Rollback safety: Re-runnable seed + destructive recreation acceptable (test data only). DONE
- Deferred: taxonomy tables, search indexing, workout_sets rich metric parity. PENDING

### Current Diff Summary (Local vs Remote)
- Exercise catalog now structurally aligned for columns we care about; enums still free-form locally until validator added.
- (OLD) `workout_sets` simplification note removed.
- FINAL: Local & slice Postgres `workout_sets` now aligned to unified minimal/forward-compatible shape:
  - Columns: id, workout_exercise_id, set_order, is_warmup, weight_kg, reps, duration_sec, distance_m, rest_sec, is_completed, created_at.
  - Dropped legacy fields: rpe, notes, started_at, completed_at, removed, rest_sec_planned/rest_sec_actual (merged to rest_sec).
  - Ordering uniqueness: UNIQUE(workout_exercise_id, set_order).
  - Rationale: Minimal metrics used by current UI + forward-compatible placeholders for future modalities (time, distance) without premature complexity.

### Artifacts & Code Changes
- Schema: `src/db/sqlite/schema.ts` now exports `exerciseCatalog`.
- Queries updated: `simple.ts`, `programBuilder.drizzle.ts`, `exercises.ts`, `workouts.ts`, `workouts.drizzle.ts`, `splits.ts`, `workoutHistory.drizzle.ts`.
- Manifest (still excluding exercise_catalog until seed/validator): `src/db/sync/manifest.ts`.
- Plan doc (this file) updated to reflect Phase A completion & Phase B progress.

### Phase B Residual / Deferred Items
- Rich workout_sets parity (distance/duration metrics) – move to later CP phase.
- Taxonomy & search enhancements – future.

### Future (Post Harmonization / Later Phases)
- Taxonomy tables (muscle_groups, exercise_muscles) once UI needs tagging & filtering.
- RLS Policies (Phase C) — exercise_catalog policies will use: 
	- SELECT: is_public = true OR owner_user_id = auth.uid()
	- INSERT: owner_user_id = auth.uid()
	- UPDATE/DELETE: owner_user_id = auth.uid()
- Search indexing (remote: tsvector column + GIN index; local: simple LIKE fallback).
- User custom exercise creation & favorites integration.

## Phase C – Supabase Setup, RLS & Auth (READY TO START)
Prereqs satisfied:
- MVP schema slice finalized & baseline migration generated.
- Local SQLite aligned (core FKs staged) & public catalog seed prepared.
- Remote seed SQL + RLS enable & policy scripts authored (`sql/seed/`, `sql/rls/`).
- Documentation scaffold (`SYNC_OPERATIONS.md`) added.

Phase C Entry Checklist (all green):
1. Baseline migration present.
2. Seed script present & idempotent.
3. RLS policy SQL prepared.
4. No unresolved schema drift items.

Next concrete actions:
1. Provision Supabase project & capture URL + anon key.
2. Apply baseline + seed + RLS (run order: baseline -> seed -> enable RLS -> policies).
3. Add environment variables for client auth.
4. Implement auth user propagation (replace 'local-user').
5. Begin ElectricSQL integration phase once auth verified.

Exit Criteria for Phase C:
- Auth login produces user id reused in inserts.
- RLS denies cross-user access but allows own rows & public catalog.
- Seeded exercises visible to any authenticated user.
- Baseline replication candidate environment stable (no hot edits to baseline).

## Quality Status
- TypeScript typecheck: PASS
- Runtime migration risk: Low (table recreation already executed during development; seed still pending).

## Immediate Next Step (Phase C Entry)
Proceed to RLS enablement & auth propagation using prepared policy templates; integrate real Supabase auth IDs before replication start.

---
Phase B Completion Snapshot (2025-09-07): Catalog fully harmonized (modality/bodyPart enums), seeded, validated, and included in sync manifest; ready for Phase C (RLS + Auth + Electric integration).

## Phase B Status Update (Delta)
- Added `src/db/schema.sync.ts` (MVP slice: exercise_catalog, splits, split_day_assignments, split_exercises, workout_sessions, workout_exercises, workout_sets + required enums)
- Added `drizzle.sync.config.ts` for generating focused migrations under `drizzle/sync/`
- Baseline regeneration after all drift remediation: `drizzle/sync/0000_steady_talkback.sql` (supersedes earlier transient baselines not pushed).
- Next Step: Apply fresh baseline to remote once Supabase project provisioned.

## Migration Strategy Decision (Baseline vs Incremental)
Decision: BASELINE for MVP sync.
Rationale: Remote Supabase project not yet created (no persisted data), narrowing scope via schema slice, want a clean authoritative starting point. Will switch to incremental once real user data or replication state exists remotely.
Artifacts:
- Slice schema: `src/db/schema.sync.ts`
- Drizzle sync config: `drizzle.sync.config.ts`
- Baseline migration generated: `drizzle/sync/0000_steady_talkback.sql`
Rules:
- Do NOT edit the generated baseline file after it is applied; future changes append new numbered migrations.
- Only tables in `SYNC_TABLES` may be added here until Phase N success criteria met.

## Pending Before Phase C
1. Drift Check: Compare local SQLite definitions for MVP tables to Postgres slice (enums vs text, nullability, defaults, unique constraints). Add notes or adjustments.
2. Remote Seed Script: Create `sql/seed_exercise_catalog_public.sql` with idempotent INSERT ... ON CONFLICT (slug) DO NOTHING for public catalog entries.
3. Apply Baseline: After Supabase project creation (Phase C start), apply `0000_nosy_starfox.sql` then the seed script.

### ID Generation Strategy (Exercise Catalog)
Decision: Continue client-generated UUIDs for `exercise_catalog.id` to keep deterministic object identity before first sync commit and simplify potential offline-first creation. Postgres default remains harmless fallback (never relied upon when client supplies id).
Rationale: Ensures no race where a row inserted locally pre-sync needs remapping after server assignment; aligns with existing seed & creation utilities already generating UUIDs.

### Drift Remediation: split_day_assignments
- Weekday normalized to integer (0=Monday .. 6=Sunday) locally to match Postgres slice.
- Added PRAGMA foreign_keys ON in sqlite client (best-effort; logical cascade handled in app code until explicit FK definitions added for SQLite schema).
- UNIQUE(user_id, weekday) retained.
- Pending: consider adding code validator to ensure 0..6 on insert/update.

## Phase B Addendum: Phase 1 Local FK Enforcement (SQLite)

Date: 2025-09-07
Scope: Added foreign key constraints in `src/db/sqlite/schema.ts` for core relational chain while deferring user ownership FKs.

Implemented FKs (SQLite):
- split_exercises.split_id → splits.id (ON DELETE CASCADE)
- split_exercises.exercise_id → exercise_catalog.id (NO ACTION)
- split_day_assignments.split_id → splits.id (ON DELETE CASCADE)
- workout_sessions.split_id → splits.id (ON DELETE SET NULL)
- workout_exercises.session_id → workout_sessions.id (ON DELETE CASCADE)
- workout_exercises.exercise_id → exercise_catalog.id (NO ACTION)
- workout_exercises.from_split_exercise_id → split_exercises.id (ON DELETE SET NULL)
- workout_sets.workout_exercise_id → workout_exercises.id (ON DELETE CASCADE)

Deferred to Phase 2:
- Any FK referencing user ownership (user_id, owner_user_id) pending auth / RLS rollout.

Rationale:
- Enforce core hierarchical integrity (split → session → exercise → set) locally to surface logic issues earlier.
- Avoid premature coupling with auth tables while RLS design is still in progress.

Reset Instructions (Dev Only):
1. Close the running Expo app if open.
2. Delete the local SQLite file (e.g. `pr_app.db`) from the device/emulator or bump a `SCHEMA_VERSION` gate if implemented.
3. Relaunch app; bootstrap code will recreate tables with FK constraints and re-run catalog seed idempotently.
4. Verify with: `SELECT * FROM pragma_foreign_key_list('workout_exercises');` using a debug console if needed.

Validation Checklist:
- PRAGMA foreign_keys is enabled in `createDrizzleClient`.
- Cascading deletes: remove a workout_session → associated workout_exercises + workout_sets removed.
- Removing a split cascades to split_exercises and split_day_assignments; active sessions referencing it get split_id set NULL.

Follow-Up (Phase 2 Targets):
- Introduce user FKs once Supabase auth wiring + RLS policies are live; ensure ON DELETE CASCADE vs RESTRICT semantics align with retention strategy.
- Add lightweight runtime assertion around weekday range (0..6) in insertion helpers (if not already present) and possibly promote to CHECK constraint later.

Risk Notes:
- Existing dev data will be dropped on recreation; acceptable (ephemeral test data).
- If a stale app build runs without PRAGMA enforcement, FKs won't apply—ensuring the PRAGMA call executes early is critical.

## Remote Seed: Public Exercise Catalog (Preparation)
Added SQL file: `sql/seed/exercise_catalog_public_seed.sql`
Purpose: Populate baseline public exercises on Supabase after applying the baseline migration.
Properties:
- Idempotent via `ON CONFLICT (slug) DO NOTHING`.
- Slug generation logic mirrors client `ensureSlug` public path using Postgres regex.
- Does not set `owner_user_id` (public entries only) and leaves `default_rest_sec` NULL.
- Safe to extend with more rows; maintain deterministic `name` -> `slug` mapping.
Execution Example:
```
psql $DATABASE_URL -f drizzle/sync/0000_steady_talkback.sql   # baseline (once)
psql $DATABASE_URL -f sql/seed/exercise_catalog_public_seed.sql
```
NPM helper: `npm run db:seed:remote:catalog` (prints instructions; does not execute).
Validation:
```
SELECT count(*) FROM exercise_catalog WHERE is_public = true;
SELECT slug, modality, body_part FROM exercise_catalog ORDER BY slug LIMIT 5;
```
Future Enhancements:
- Add a `seed_state` tracking table remotely if multiple seed waves introduced.
- Provide RLS policies ensuring only public rows visible to unauthenticated users (Phase C).

