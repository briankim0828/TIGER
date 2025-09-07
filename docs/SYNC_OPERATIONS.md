# Sync Operations Runbook (CP6)

This document lists the operational steps to initialize, seed, secure, and verify the CP6 MVP sync environment (Supabase + future ElectricSQL).

## 1. Environment Variables
Set (never commit service key):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (local dev server tooling only; NOT in client build)

## 2. Apply Baseline Schema
```
psql $DATABASE_URL -f drizzle/sync/0000_steady_talkback.sql
```
Verify tables:
```
\dt
```

## 3. Seed Public Exercise Catalog
```
psql $DATABASE_URL -f sql/seed/exercise_catalog_public_seed.sql
SELECT count(*) FROM exercise_catalog WHERE is_public = true;
```

## 4. Enable RLS & Apply Policies
```
psql $DATABASE_URL -f sql/rls/mvp_enable_rls.sql
psql $DATABASE_URL -f sql/rls/mvp_policies.sql
```
Smoke test (should be empty if querying with anon key):
```
curl -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     "$SUPABASE_URL/rest/v1/splits?select=*"
```

## 5. Auth User Insertion (Testing)
Create two users via Supabase auth UI or API. Record their UUIDs for RLS tests.

## 6. Local App Configuration
Add .env (or app config) values for URL + anon key so the client Supabase auth works.

## 7. ElectricSQL (Upcoming)
Placeholder until integration:
- Initialize Electric with local SQLite handle.
- Provide replication config pointing to Supabase replication service/gateway.
- Electrify only MVP tables.

## 8. RLS Verification Matrix
| Scenario | Expectation |
|----------|-------------|
| User A queries own splits | returns rows |
| User B queries user A splits | 0 rows |
| Public catalog fetch | all `is_public` rows visible to any auth user |
| Insert custom exercise with owner_user_id mismatch | rejected |
| Delete another user’s workout_set | rejected |

## 9. Catalog Re-seed (Idempotent)
Safe to re-run seed file; new rows inserted, existing preserved.

## 10. Troubleshooting
- Policy denies: Use `EXPLAIN` with `SET role = authenticated;` and test `SELECT` to debug.
- Missing rows after replication: confirm baseline and seed run before enabling Electric.
- Drift: Re-run drizzle generation and create a new incremental migration (never edit baseline once applied).

## 11. Future Enhancements
- Add seed_state table on server to track applied seed waves.
- Introduce CHECK constraint for weekday (0..6).
- Add views for analytics with separate policies.

## 12. Success Criteria (Ops Perspective)
- Baseline, seed, RLS applied exactly once.
- Policies enforce strict per-user isolation.
- Exercise catalog accessible without custom ownership rows.
- App functions offline; later sync merges without conflict errors.
