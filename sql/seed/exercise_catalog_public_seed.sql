-- exercise_catalog_public_seed.sql
-- Idempotent seed for public exercise catalog rows (Phase C prep).
-- Run AFTER applying baseline migration. Safe to re-run: ON CONFLICT (slug) DO NOTHING.
-- Requires extension pgcrypto (for gen_random_uuid) already used in baseline.

WITH seed(name, modality, body_part) AS (
  VALUES
    ('Barbell Bench Press', 'barbell', 'chest'),
    ('Incline Barbell Bench Press', 'barbell', 'chest'),
    ('Dumbbell Bench Press', 'dumbbell', 'chest'),
    ('Barbell Back Squat', 'barbell', 'leg'),
    ('Front Squat', 'barbell', 'leg'),
    ('Romanian Deadlift', 'barbell', 'leg'),
    ('Conventional Deadlift', 'barbell', 'back'),
    ('Barbell Row', 'barbell', 'back'),
    ('Lat Pulldown', 'cable', 'back'),
    ('Pull Up', 'bodyweight', 'back'),
    ('Seated Cable Row', 'cable', 'back'),
    ('Overhead Press', 'barbell', 'shoulder'),
    ('Dumbbell Shoulder Press', 'dumbbell', 'shoulder'),
    ('Lateral Raise', 'dumbbell', 'shoulder'),
    ('Rear Delt Fly', 'dumbbell', 'shoulder'),
    ('Bicep Curl', 'dumbbell', 'biceps'),
    ('Hammer Curl', 'dumbbell', 'biceps'),
    ('Tricep Rope Pushdown', 'cable', 'triceps'),
    ('Skullcrusher', 'barbell', 'triceps'),
    ('Crunch', 'bodyweight', 'core'),
    ('Plank', 'bodyweight', 'core'),
    ('Treadmill Walk', 'bodyweight', 'cardio'),
    ('Stationary Bike', 'bodyweight', 'cardio')
)
INSERT INTO exercise_catalog (id, name, slug, modality, body_part, default_rest_sec, is_public, created_at, updated_at)
SELECT
  gen_random_uuid(),
  s.name,
  -- Slug generation mirrors JS ensureSlug public path: lowercase, remove non-alphanum (except space & hyphen), collapse spaces -> hyphen, collapse hyphens
  (
    SELECT regexp_replace(
             regexp_replace(
               regexp_replace(lower(s.name), '[^a-z0-9\s-]+', '', 'g')
             , '\s+', '-', 'g')
           , '-{2,}', '-', 'g'
         )
  ) AS slug,
  s.modality::modality,
  s.body_part::body_part,
  NULL::integer AS default_rest_sec,
  TRUE AS is_public,
  now(),
  now()
FROM seed s
ON CONFLICT (slug) DO NOTHING;

-- Optional verification (rows inserted this run):
-- SELECT count(*) FROM exercise_catalog WHERE is_public = true;