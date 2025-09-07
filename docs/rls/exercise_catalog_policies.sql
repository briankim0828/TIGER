-- RLS policy templates for exercise_catalog (Phase C)
-- Enable RLS
ALTER TABLE exercise_catalog ENABLE ROW LEVEL SECURITY;

-- Public read of seeded catalog rows (is_public = true) plus own custom exercises
CREATE POLICY exercise_catalog_select ON exercise_catalog
  FOR SELECT USING (is_public = true OR owner_user_id = auth.uid());

-- Insert: allow only if owner_user_id = auth.uid() (public seeds inserted via service role outside RLS scope)
CREATE POLICY exercise_catalog_insert ON exercise_catalog
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Update: only owners can modify their rows (public seeds treated immutable)
CREATE POLICY exercise_catalog_update ON exercise_catalog
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Delete: only owners can delete their rows
CREATE POLICY exercise_catalog_delete ON exercise_catalog
  FOR DELETE USING (owner_user_id = auth.uid());
