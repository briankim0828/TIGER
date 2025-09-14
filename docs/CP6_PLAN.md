# CP6 Plan: Cloud Deployment & Sync (Completed for MVP scope)

Status: Phases F–K COMPLETE (End-to-end remote sync in production flows)
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
- RLS policy scripts consolidated under `sql/rls/` (old single-table template removed).
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
- Baseline regeneration after all drift remediation: `drizzle/sync/0000_cp6_baseline.sql` (authoritative CP6 starting point).
- Next Step: Apply fresh baseline to remote once Supabase project provisioned.

## Migration Strategy Decision (Baseline vs Incremental)
Decision: BASELINE for MVP sync.
Rationale: Remote Supabase project not yet created (no persisted data), narrowing scope via schema slice, want a clean authoritative starting point. Will switch to incremental once real user data or replication state exists remotely.
Artifacts:
- Slice schema: `src/db/schema.sync.ts`
- Drizzle sync config: `drizzle.sync.config.ts`
- Baseline migration generated: `drizzle/sync/0000_cp6_baseline.sql`
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
psql $DATABASE_URL -f drizzle/sync/0000_cp6_baseline.sql   # baseline (once)
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


## Updated Phases F–N (Local-First, No ElectricSQL)

Decision: The app is local-first. All mutations write to SQLite and enqueue to the outbox first (even when online). A background flusher syncs with Supabase. Startup performs a server→local pull to converge to the remote source of truth.

### Phase F – Sync Engine (Pull + Background Flush)
- Startup pull: After auth, for each table in `SYNC_TABLES`, fetch server snapshot (user-scoped or `is_public`) and upsert locally via Drizzle.
- Strategy: MVP uses full snapshot per user for simplicity; optional future delta pulls via `updated_at > last_pull_at`.
- Local state: Maintain `last_pull_at` and basic counters in a local `sync_state` table.
- Background flush: A flusher service continuously drains the outbox when connectivity is available; no foreground blocking on writes.
- Deletes: Record deletes as outbox ops; startup pull reconciles remote deletions (snapshot truth if no tombstones).

### Phase G – Auth Wiring & User ID Propagation
- Source: Supabase email auth. Provide `useAuthUserId()`.
- Gate: Defer startup pull and user-scoped queries until user id present; show loading shell.
- Ownership: Always set `user_id`/`owner_user_id = auth.uid()` in payloads; RLS enforces.
- Session changes: On logout, reset `sync_state`; consider partitioning local DB per user if needed.

### Phase H – Outbox (Mandatory Enqueue)
- Table: Local `outbox` with `id (uuid)`, `table`, `op` (insert|update|delete), `row_id`, `payload (json)`, `created_at`, `retry_count`, `status`.
- Enqueue-first: DAO layer wraps all mutations to (1) write locally to target table, (2) append an outbox item, regardless of connectivity.
- Flusher: Runs on app foreground and connectivity regain; processes FIFO with exponential backoff. Marks items done on 2xx (PostgREST upsert/delete). On failure, increments `retry_count`, updates `last_error_at` in `sync_state`.
- Connectivity signal: Repeated background failures flip an `isOnline=false` flag; UI can render offline state. Success flips it back to true.
- Idempotency: Deterministic UUIDs for rows and PostgREST upsert allow safe retries.

### Phase I – Conflict Strategy
- Rule: Last-write-wins by `updated_at` (set by client at mutation time). Tie-break by `id` or server clock if needed.
- Ordering: Assume single-device writer for order columns during MVP; document this.
- Deletes: Remote-missing rows removed on pull. Local delete is an outbox op that deletes on server when flushed.

### Phase J – Observability & Health
- `SyncStatus` component: shows online/offline, last pull, outbox size, last flush result.
- Logs: `[sync]` for pull, `[outbox]` for enqueue/flush cycles.
- Metrics: Track `last_pull_at`, `last_flush_at`, `pending_outbox`, `last_error` in `sync_state`.

### Phase K – Test Matrix (E2E)
- Fresh online: startup pull → local populated; creating entities enqueues outbox, flusher syncs in background.
- Offline first run: mutations enqueue and update local UI; reconnect triggers flush; next pull converges.
- Mid-session drop: sets continue locally; background flusher resumes on reconnect without duplicates.
- RLS: Cross-user reads denied; public catalog readable.
- Auth switch: Logout/login as new user; `sync_state` reset; fresh pull scopes data correctly.

### Phase L – Decommission Local Emulation
- Remove custom live/bump utilities. If needed, keep `useLiveQuery` only as a thin alias to local subscriptions (no remote coupling).
- Ensure all flows rely on startup pull + outbox + background flush.

### Phase M – Documentation & Runbook
- Update this file with final states and constraints.
- `docs/SYNC_OPERATIONS.md`: env vars, startup order, reset DB, clear outbox, manual pull, reading status, troubleshooting.
- README: Local-first model, Supabase as source of truth, background flush.

### Phase N – Success Criteria
- Local-first UX: mutations instantaneous locally; outbox always enqueued.
- Background flush keeps remote in sync; offline detection via flusher failures.
- Startup pull converges local with server; deletions reconciled.
- No `local-user` references; RLS enforced; debug status present; CP6 docs merged.

## Phase F Execution Status (2025-09-13 → 2025-09-14)
- Local-first sync operational: outbox + background flusher; snapshot pull after auth; transient remote errors retried with backoff.
- Remote sync validated for all MVP tables:
  - `splits` (insert/update/delete; two-phase reorder avoids UNIQUE(user_id, order_pos) conflicts)
  - `split_day_assignments` (insert/update/delete; weekday normalized 0..6; removed created_at/updated_at from payload)
  - `split_exercises` (insert/delete/reorder; stable order maintenance)
  - `exercise_catalog` (reads + upsert by slug in flusher when needed)
  - `workout_sessions` (start/end; user_id included for RLS)
  - `workout_exercises` (insert/reorder/delete; exercise_id mapped to remote by slug to satisfy FK)
  - `workout_sets` (insert/update/delete; contiguous set_order maintained)

Key fixes implemented during execution:
- Startup pull resiliency: retry/backoff for transient 5xx; per-table error does not abort full pull; status recorded in `sync_state`.
- Correct weekday mapping (0=Mon..6=Sun) and calendar logic in Progress screen.
- ActiveWorkoutModal wired to authenticated `user.id` (removed 'local-user' placeholder).
- Workout start flow: pass exercise_catalog ids (not split_exercises ids); remote exercise_id FK satisfied (with outbox flusher mapping by slug for local-only exercises).
- Add to session: atomic INSERT ... SELECT COALESCE(MAX(order_pos)+1,0) to avoid duplicate order_pos under concurrency.
- Reorder splits: two-phase updates (temp high order, then final contiguous) to avoid remote UNIQUE collisions.

---

## Remaining Phases G–N (Closeout Summary)

Status assumption: Phase F complete; core parts of G and H implemented for E2E. Workouts E2E validated for all sync tables.

### Phase G — Auth Wiring & User ID Propagation (Finalization)
Scope now is polish and consistency. Most wiring exists (auth-gated startup pull, `local-user` reassignment, user_id on session writes).

Actions
- Ensure every mutation path that writes owner-scoped rows includes `user_id` consistently:
  - `workout_sessions` (insert/update) — already done.
  - Confirm no stray code paths directly insert into owner tables without `user_id`.
- Remove any lingering reliance on the `'local-user'` sentinel in production code. Keep the reassignment code path as a dev safeguard only.
- Add a small `useAuthUserId()` helper (or reuse Supabase hook if present) so callers never need to query auth in hot paths.

Acceptance Criteria
- No inserts/updates reach Supabase without the correct `user_id` when RLS demands it.
- No references to `'local-user'` remain in non-dev code paths.
- Startup pull is strictly gated on presence of an authenticated user.

### Phase H — Outbox Reliability Enhancements (As-Needed)
Outbox + background flusher are implemented and working. Only add these refinements if issues are observed during soak testing.

Optional Refinements (Defer unless needed)
- Exponential backoff with jitter for repeated failures.
- Per-item quarantine after N consecutive failures with surfaced `last_error` and a one-tap retry.
- Guard against duplicate enqueues for noisy UI actions (idempotent checks where possible).

Acceptance Criteria (met)
- Flusher reliably drains the outbox; transient failures recover via retry.
- `sync_state` reflects accurate `is_online`, `last_flush_at`, and `last_error` upon failure.

### Phase I — Conflict Strategy (Confirm and Document)
We use last-write-wins by `updated_at`, with pragmatic ordering assumptions for MVP.

Actions
- Ensure `updated_at` is included on server-visible updates where the table has that column (sessions already do; sets/exercises may not need it in MVP).
- Document tie-breaks: when `updated_at` equal, break by `id` or server clock.
- Note current assumption: single-device writer for order columns; surface this as a constraint in docs.

Acceptance Criteria
- Docs clearly state the conflict policy and constraints (see also REMOTE_DB_OPERATIONS.md).
- Remote rows updated from the app consistently carry `updated_at` when applicable.

### Phase J — Observability & Health (Lightweight Debug)

Actions
- Add a `SyncStatus` dev/debug component (or a panel under an existing debug screen) showing:
  - `outbox` pending count, `sync_state.is_online`, `last_pull_at`, `last_flush_at`, `last_error`.
- Keep concise `[sync]` and `[outbox]` logs (already present) and ensure high-noise logs can be toggled.

Acceptance Criteria
- A developer can open the app, see outbox size and last pull/flush/error, and diagnose basic issues without attaching a SQL console.

### Phase K — Test Matrix (E2E) — Final Pass
Assuming E2E completed for workouts, do a short soak test:

Actions
- Run an online session with multiple sets, reorder operations, and end/cancel flows.
- Run an offline session (airplane mode), perform several mutations, reconnect, and verify convergence.
- Validate cross-user isolation (RLS) by signing in as a different user and confirming no leakage.

Acceptance Criteria
- All scenarios converge locally and remotely with no orphaned outbox entries.
- RLS denies cross-user reads/writes; public catalog remains readable.

### Phase L — Decommission Local Emulation (Reframe)
Original plan suggested removing local “live bump” utilities. Since ElectricSQL isn’t integrated yet, retain the lightweight bump mechanism through CP6 for stable UI reactivity.

Actions (Deferred to post‑CP6)
- Replace local bump with a proper reactive layer (ElectricSQL or another approach) once cloud replication model is finalized.

Acceptance Criteria (for CP6)
- Keep current lightweight live update notifier; document its temporary nature.

### Phase M — Documentation & Runbook

Actions
- Update `docs/SYNC_OPERATIONS.md` with:
  - Environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), login preconditions.
  - Startup order: auth → startup pull → local use → background flush.
  - How to reset local DB, clear outbox, trigger manual pull.
  - Troubleshooting common errors (RLS denied, payload mismatch, offline loops).
- Add a short “dev smoke” note for workouts (manual steps or `scripts/dev/smokeWorkoutsSync.ts` if we add it later).

Acceptance Criteria
- A new developer can follow the runbook to set up env, validate sync, and recover from common failure modes.

### Phase N — Success Criteria & Baseline Freeze

Actions
- Mark CP6 baseline as “applied” remotely; switch to incremental migrations for any future schema evolution of sync tables.
- Create a short “CP6 Closeout” section in this file summarizing:
  - What sync covers (tables), known constraints, and what’s explicitly out of scope.
  - Next initiative (e.g., expand taxonomy or adopt ElectricSQL for reactivity) to be planned as CP7.

Acceptance Criteria
- All success criteria listed earlier in this document are satisfied.
- Main branch contains the stable code and docs; next work proceeds on a new branch with incremental migrations only.

---

Quick Checklist to Close CP6
- [x] Phase G finalization checks pass (user_id propagation verified; no `local-user` in prod paths).
- [x] Phase H reliability validated; retry/backoff in pull; flusher marks online/offline.
- [x] Phase I conflict policy documented; `updated_at` behavior confirmed for updates.
- [x] Phase J debug signals present via logs and `sync_state`.
- [x] Phase K soak tests complete (online/offline, reorder, add/remove; no FK/UNIQUE violations).
- [x] Phase M docs updated; runbook present.
- [x] Phase N: going forward, use incremental migrations for sync tables.

