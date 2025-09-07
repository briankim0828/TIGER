-- mvp_enable_rls.sql
-- Enables RLS on all MVP sync tables (run AFTER baseline + seed).

ALTER TABLE exercise_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_day_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- (Optional hardening) REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
-- Supabase by default adds anon/auth roles; policies will govern access.
