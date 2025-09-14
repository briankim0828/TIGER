# Remote DB Operations: Patterns and Checklist

This document explains the general pattern we use to integrate the local-first app with the remote database (Supabase via PostgREST). New features and UI flows should follow these conventions to ensure reliable, cohesive behavior.

## Core Principles

- Local-first: All writes apply to SQLite immediately. UI updates instantly without waiting for the network.
- Outbox: Every mutation enqueues a row in `outbox` describing the remote operation (table, op, row_id, payload JSON). A background flusher pushes these to Supabase.
- Startup Pull: After authentication, the app pulls a snapshot for each sync table and upserts locally, converging to the server’s state.
- Idempotency: We use client-generated UUIDs and deterministic payloads so retries are safe.
- RLS-friendly: All payloads include the owning `user_id` (or rely on public visibility) so Supabase RLS policies allow access.

## Read/Write Flow

1. User action triggers a DAO method.
2. DAO writes locally (Drizzle/SQLite), then enqueues an `outbox` item with payload matching the remote schema.
3. Background flusher reads pending outbox rows FIFO and performs the corresponding remote call:
   - insert/update/delete on the target table via PostgREST.
   - on success: marks the outbox item `done`; on error: increments retry count, marks offline, and surfaces `last_error` in `sync_state`.
4. Startup pull (after auth) fetches snapshots from Supabase per table (scoped by user or public flag) and upserts locally. Transient 5xx errors are retried.

## Payload Shaping Rules

- Match the remote schema’s column names (snake_case). Example: `order_pos`, `user_id`.
- Exclude columns that are not present remotely (e.g., remove `created_at`/`updated_at` if the remote table omits them).
- Include `user_id` for owner-scoped tables to satisfy RLS.
- For foreign keys that differ locally/remotely, map IDs before sending:
  - Example: `workout_exercises.exercise_id` must reference remote `exercise_catalog.id`. If a local-only exercise exists, the flusher will upsert it by `slug` on the server and use its remote id.

## Ordered Lists Without Conflicts

- For lists with a unique order constraint, avoid duplicate positions during remote updates:
  - Compute order atomically for inserts: `INSERT ... SELECT COALESCE(MAX(order_pos)+1, 0)`.
  - For reorders across multiple rows, use a two-phase strategy:
    1) Phase 1: move affected rows to temporary high positions (e.g., 1001..100N), emitting outbox updates.
    2) Phase 2: set final contiguous positions (1..N), emitting outbox updates.
  - This prevents UNIQUE(user_id, order_pos) conflicts on the server.

## Error Handling

- Background flusher:
  - On success: `sync_state.is_online = true`, `last_flush_at` updated.
  - On error: mark item failed, increment `retry_count`, update `sync_state.last_error`, set `is_online = false`; the flusher will retry later.
- Startup pull: transient network/edge errors (e.g., 502) are retried with exponential backoff; a per-table failure doesn’t abort the entire pull.

## Conflict Strategy

- Last-write-wins by `updated_at` on tables that include it. When equal, tie-break by id/server clock as needed.
- Ordered lists assume a single-device writer for MVP. Reconcile later if multiple devices reorder concurrently.

## Auth & RLS

- Defer startup pull until `auth.user.id` is present.
- Ensure all writes include `user_id` so RLS authorizes them.
- For public tables (e.g., `exercise_catalog`), reads don’t require user ownership; inserts for custom/private rows include `owner_user_id`.

## Live UI Updates

- UI reads local SQLite.
- After local writes, we optionally bump table versions to refresh live queries (temporary mechanism until a full reactive layer is adopted).

## Developer Checklist (per new feature)

- Schema
  - Identify target tables and remote columns (snake_case).
  - Confirm any FKs and whether they need ID mapping.
- DAO Methods
  - Local write (transaction if needed) and enqueue outbox with shaped payload.
  - For ordered lists: atomic insert or two-phase reorder.
  - Include `user_id` (and `updated_at` when applicable).
- Flusher Adjustments (if needed)
  - Add any ID mapping or payload sanitation (e.g., remove columns not present remotely).
- Pull Integration
  - Add table to snapshot pull with scoping (user-owned or public).
- Observability
  - Ensure `[outbox]` and `[sync]` logs are helpful; optionally surface state in a debug view.
- E2E Test
  - Online: Verify outbox drains and remote rows are correct.
  - Offline: Mutate locally, reconnect, verify convergence.
  - Corner cases: reorder, deletes, FK existence.

## Reference: Current Implementations

- Atomic order insert: `workouts.drizzle.ts` → `addExerciseToSession()` uses INSERT ... SELECT COALESCE(MAX(order_pos)+1,0).
- Two-phase reorder: `programBuilder.drizzle.ts` → `reorderSplits()`.
- FK mapping: `sync/flush.ts` maps local `exercise_id` to remote `exercise_catalog.id` by `slug`, inserting a private copy if needed.
- Payload sanitization: `sync/flush.ts` removes `created_at`/`updated_at` for `split_day_assignments` updates.
- Retry/backoff: `sync/pull.ts` uses exponential backoff and records per-table failure without aborting the full pull.

## Troubleshooting

- 23505 unique violations on order columns: ensure two-phase reorder or atomic insert is used; check outbox payloads for duplicates.
- 23503 FK violations: confirm flusher’s ID mapping is applied and the local IDs exist in remote target tables.
- RLS errors: verify `user_id`/`owner_user_id` present and policies align.
- Persistent offline: check `sync_state.last_error` and logs for HTTP 5xx and retry behavior.
