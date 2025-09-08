-- CP6 Baseline Migration (MVP Sync Slice)
-- IMPORTANT: Do NOT edit after applying to remote. Future changes go in new numbered migrations.
-- NOTE: auth.users is managed by Supabase; we reference it but do not create or alter it here.

-- Enums
CREATE TYPE "public"."body_part" AS ENUM('chest','back','leg','shoulder','triceps','biceps','core','forearm','cardio');
CREATE TYPE "public"."modality" AS ENUM('barbell','dumbbell','kettlebell','machine','smith','cable','bodyweight');
CREATE TYPE "public"."session_state" AS ENUM('active','completed');

-- exercise_catalog (public + user custom)
CREATE TABLE "public"."exercise_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "modality" "public"."modality" NOT NULL,
  "body_part" "public"."body_part",
  "default_rest_sec" integer,
  "media_thumb_url" text,
  "media_video_url" text,
  "is_public" boolean DEFAULT true NOT NULL,
  "owner_user_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT exercise_catalog_slug_unique UNIQUE("slug"),
  CONSTRAINT exercise_catalog_owner_user_id_users_id_fk FOREIGN KEY ("owner_user_id") REFERENCES auth.users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX idx_exercise_catalog_owner ON exercise_catalog(owner_user_id);

-- splits
CREATE TABLE "public"."splits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "order_pos" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT splits_user_id_order_pos_unique UNIQUE("user_id","order_pos"),
  CONSTRAINT splits_user_id_users_id_fk FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX idx_splits_user ON splits(user_id);

-- workout_sessions
CREATE TABLE "public"."workout_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "state" "public"."session_state" DEFAULT 'active' NOT NULL,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "split_id" uuid,
  "note" text,
  "energy_kcal" integer,
  "total_volume_kg" integer,
  "total_sets" integer,
  "duration_sec" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT workout_sessions_user_id_users_id_fk FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT workout_sessions_split_id_splits_id_fk FOREIGN KEY ("split_id") REFERENCES splits(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX idx_sessions_user_state ON workout_sessions(user_id, state);

-- split_day_assignments
CREATE TABLE "public"."split_day_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "weekday" integer NOT NULL,
  "split_id" uuid NOT NULL,
  CONSTRAINT split_day_assignments_user_id_weekday_unique UNIQUE("user_id","weekday"),
  CONSTRAINT split_day_assignments_user_id_users_id_fk FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT split_day_assignments_split_id_splits_id_fk FOREIGN KEY ("split_id") REFERENCES splits(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- split_exercises
CREATE TABLE "public"."split_exercises" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "split_id" uuid NOT NULL,
  "exercise_id" uuid NOT NULL,
  "order_pos" integer NOT NULL,
  "rest_sec_default" integer,
  "notes" text,
  CONSTRAINT split_exercises_split_id_order_pos_unique UNIQUE("split_id","order_pos"),
  CONSTRAINT split_exercises_split_id_splits_id_fk FOREIGN KEY ("split_id") REFERENCES splits(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT split_exercises_exercise_id_exercise_catalog_id_fk FOREIGN KEY ("exercise_id") REFERENCES exercise_catalog(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX idx_split_exercises_split ON split_exercises(split_id);

-- workout_exercises
CREATE TABLE "public"."workout_exercises" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "exercise_id" uuid NOT NULL,
  "order_pos" integer NOT NULL,
  "rest_sec_default" integer,
  "from_split_exercise_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT workout_exercises_session_id_order_pos_unique UNIQUE("session_id","order_pos"),
  CONSTRAINT workout_exercises_session_id_workout_sessions_id_fk FOREIGN KEY ("session_id") REFERENCES workout_sessions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT workout_exercises_exercise_id_exercise_catalog_id_fk FOREIGN KEY ("exercise_id") REFERENCES exercise_catalog(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT workout_exercises_from_split_exercise_id_split_exercises_id_fk FOREIGN KEY ("from_split_exercise_id") REFERENCES split_exercises(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX idx_workout_exercises_session ON workout_exercises(session_id);
CREATE INDEX idx_workout_exercises_ex ON workout_exercises(exercise_id);

-- workout_sets
CREATE TABLE "public"."workout_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workout_exercise_id" uuid NOT NULL,
  "set_order" integer NOT NULL,
  "is_warmup" boolean DEFAULT false NOT NULL,
  "weight_kg" integer,
  "reps" integer,
  "duration_sec" integer,
  "distance_m" integer,
  "rest_sec" integer,
  "is_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT workout_sets_workout_exercise_id_set_order_unique UNIQUE("workout_exercise_id","set_order"),
  CONSTRAINT workout_sets_workout_exercise_id_workout_exercises_id_fk FOREIGN KEY ("workout_exercise_id") REFERENCES workout_exercises(id) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX idx_workout_sets_ex ON workout_sets(workout_exercise_id);

-- END BASELINE