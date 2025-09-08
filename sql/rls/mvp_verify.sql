-- mvp_verify.sql
-- Verification & smoke tests for RLS + policies after applying:
--   1) mvp_enable_rls.sql
--   2) mvp_policies.sql
-- Copy/paste sections as needed. Safe: read-only except for clearly labeled test inserts.
-- NOTE: Running these in the Supabase SQL Editor executes as a high-privileged service role
-- that BYPASSES RLS. So policy enforcement tests that rely on denial must be run via the
-- client (JS SDK / PostgREST) with a user JWT. This file focuses on structural verification
-- and provides client-side snippets (commented) for behavioral checks.

/* =====================================================
   1. Confirm RLS enabled on target tables
   ===================================================== */
SELECT relname AS table,
       relrowsecurity AS rls_enabled,
       relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN (
    'exercise_catalog','splits','split_day_assignments','split_exercises',
    'workout_sessions','workout_exercises','workout_sets'
  )
ORDER BY relname;

/* =====================================================
   2. List policies (definition summary)
   ===================================================== */
SELECT rel.relname AS table,
       pol.polname,
       pol.polcmd,
       pg_get_expr(pol.polqual, pol.polrelid)      AS using_clause,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_clause
FROM pg_policy pol
JOIN pg_class rel ON rel.oid = pol.polrelid
WHERE rel.relname IN (
    'exercise_catalog','splits','split_day_assignments','split_exercises',
    'workout_sessions','workout_exercises','workout_sets'
)
ORDER BY rel.relname, pol.polname, pol.polcmd;

/* =====================================================
   3. Quick row counts (sanity before/after user actions)
   ===================================================== */
SELECT
  (SELECT count(*) FROM exercise_catalog)      AS exercise_catalog_total,
  (SELECT count(*) FROM splits)                AS splits_total,
  (SELECT count(*) FROM workout_sessions)      AS workout_sessions_total,
  (SELECT count(*) FROM workout_exercises)     AS workout_exercises_total,
  (SELECT count(*) FROM workout_sets)          AS workout_sets_total;

/* =====================================================
   4. Catalog public vs owned breakdown (service view)
   (Service role sees everything; still useful for seed sanity.)
   ===================================================== */
SELECT is_public,
       owner_user_id IS NULL AS owner_null,
       count(*)
FROM exercise_catalog
GROUP BY is_public, owner_user_id IS NULL
ORDER BY 1,2;

/* =====================================================
   5. (OPTIONAL) Force check for orphaned FK chains
   ===================================================== */
-- Orphan split_exercises (should be zero):
SELECT count(*) AS orphan_split_exercises
FROM split_exercises se
LEFT JOIN splits s ON s.id = se.split_id
WHERE s.id IS NULL;

-- Orphan workout_exercises (should be zero):
SELECT count(*) AS orphan_workout_exercises
FROM workout_exercises we
LEFT JOIN workout_sessions ws ON ws.id = we.session_id
WHERE ws.id IS NULL;

-- Orphan workout_sets (should be zero):
SELECT count(*) AS orphan_workout_sets
FROM workout_sets ws
LEFT JOIN workout_exercises we ON we.id = ws.workout_exercise_id
WHERE we.id IS NULL;

/* =====================================================
   6. CLIENT-SIDE (JS) BEHAVIORAL TESTS (comments)
   Run in your application context after authenticating different users.
   ===================================================== */
-- JS (User A) expected success:
-- const userA = (await supabase.auth.getUser()).data.user;
-- await supabase.from('exercise_catalog').insert({
--   name: 'A Private Curl', slug: 'a-private-curl', modality: 'dumbbell', body_part: 'biceps',
--   is_public: false, owner_user_id: userA.id
-- });
-- Should succeed.

-- JS (User A) spoof attempt (expected failure):
-- await supabase.from('exercise_catalog').insert({
--   name: 'Spoof', slug: 'spoof-row', modality: 'barbell', body_part: 'chest',
--   is_public: true, owner_user_id: crypto.randomUUID()
-- }); // Expect 42501 or RLS violation error.

-- JS (User B) cannot see A's private:
-- const userB = (await supabase.auth.getUser()).data.user;
-- const { data: privB } = await supabase
--   .from('exercise_catalog')
--   .select('slug,is_public,owner_user_id')
--   .eq('slug','a-private-curl');
-- Expect [] (empty array).

-- JS cross-user update attempt (User B) expected failure:
-- await supabase.from('exercise_catalog')
--   .update({ name: 'Hacked' })
--   .eq('slug','a-private-curl');

-- Splits isolation sanity:
-- User A inserts a split -> User B's select returns 0 rows.

/* =====================================================
   7. OPTIONAL: Check for accidental wide-open policy
   (Flag if any USING clause = TRUE for target tables)
   ===================================================== */
SELECT rel.relname AS table,
       pol.polname,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_clause
FROM pg_policy pol
JOIN pg_class rel ON rel.oid = pol.polrelid
WHERE rel.relname IN (
    'exercise_catalog','splits','split_day_assignments','split_exercises',
    'workout_sessions','workout_exercises','workout_sets'
)
AND pg_get_expr(pol.polqual, pol.polrelid) ~* '^\s*true\s*$';
-- Expect zero rows (no always-true USING).

/* =====================================================
   8. CLEANUP (optional) remove test private row (service role)
   ===================================================== */
-- DELETE FROM exercise_catalog WHERE slug = 'a-private-curl';

-- End of verification script.
