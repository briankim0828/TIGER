-- mvp_policies.sql
-- Row-Level Security policies for CP6 MVP.
-- Assumes RLS already enabled (see mvp_enable_rls.sql).
-- Idempotent-ish: DROP POLICY IF EXISTS used for reapply ease in dev.

-- Public exercise_catalog read for all authenticated users; modify only by owner
DROP POLICY IF EXISTS exercise_catalog_select_all ON exercise_catalog;
CREATE POLICY exercise_catalog_select_all ON exercise_catalog
  FOR SELECT USING ( is_public = true OR owner_user_id = auth.uid() );

DROP POLICY IF EXISTS exercise_catalog_insert_owner ON exercise_catalog;
CREATE POLICY exercise_catalog_insert_owner ON exercise_catalog
  FOR INSERT WITH CHECK ( owner_user_id = auth.uid() );

DROP POLICY IF EXISTS exercise_catalog_update_owner ON exercise_catalog;
CREATE POLICY exercise_catalog_update_owner ON exercise_catalog
  FOR UPDATE USING ( owner_user_id = auth.uid() ) WITH CHECK ( owner_user_id = auth.uid() );

DROP POLICY IF EXISTS exercise_catalog_delete_owner ON exercise_catalog;
CREATE POLICY exercise_catalog_delete_owner ON exercise_catalog
  FOR DELETE USING ( owner_user_id = auth.uid() );

-- Generic per-user tables template macro (expanded manually below)
-- SELECT/INSERT/UPDATE/DELETE limited to user_id = auth.uid()

-- splits
DROP POLICY IF EXISTS splits_owner_all ON splits;
CREATE POLICY splits_owner_all ON splits
  FOR ALL USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );

-- split_day_assignments
DROP POLICY IF EXISTS split_day_assignments_owner_all ON split_day_assignments;
CREATE POLICY split_day_assignments_owner_all ON split_day_assignments
  FOR ALL USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );

-- split_exercises
DROP POLICY IF EXISTS split_exercises_owner_all ON split_exercises;
CREATE POLICY split_exercises_owner_all ON split_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM splits s WHERE s.id = split_exercises.split_id AND s.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM splits s WHERE s.id = split_exercises.split_id AND s.user_id = auth.uid()
    )
  );

-- workout_sessions
DROP POLICY IF EXISTS workout_sessions_owner_all ON workout_sessions;
CREATE POLICY workout_sessions_owner_all ON workout_sessions
  FOR ALL USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() );

-- workout_exercises
DROP POLICY IF EXISTS workout_exercises_owner_all ON workout_exercises;
CREATE POLICY workout_exercises_owner_all ON workout_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws WHERE ws.id = workout_exercises.session_id AND ws.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws WHERE ws.id = workout_exercises.session_id AND ws.user_id = auth.uid()
    )
  );

-- workout_sets
DROP POLICY IF EXISTS workout_sets_owner_all ON workout_sets;
CREATE POLICY workout_sets_owner_all ON workout_sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
        JOIN workout_sessions ws ON ws.id = we.session_id
        WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
        JOIN workout_sessions ws ON ws.id = we.session_id
        WHERE we.id = workout_sets.workout_exercise_id AND ws.user_id = auth.uid()
    )
  );

-- Optional: future read-only aggregate views can have separate relaxed policies.
