-- Add session_name to workout_sessions (remote Postgres)
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS session_name text;
