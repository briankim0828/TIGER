-- Rename workout_sessions.duration_sec -> duration_min (idempotent)
-- Safe to run multiple times; no-ops if already renamed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workout_sessions'
      AND column_name = 'duration_sec'
  ) THEN
    ALTER TABLE public.workout_sessions RENAME COLUMN duration_sec TO duration_min;
  END IF;
END $$;

-- Optional: verify
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='workout_sessions' AND column_name IN ('duration_min','duration_sec');
