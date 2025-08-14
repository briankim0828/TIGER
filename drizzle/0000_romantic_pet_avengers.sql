CREATE TYPE "public"."exercise_kind" AS ENUM('strength', 'cardio', 'mobility', 'other');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('max_weight', 'est_1rm', 'volume', 'reps_at_weight');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'kettlebell', 'band', 'cardio', 'other');--> statement-breakpoint
CREATE TYPE "public"."muscle_role" AS ENUM('primary', 'secondary', 'stabilizer');--> statement-breakpoint
CREATE TYPE "public"."session_state" AS ENUM('planned', 'active', 'completed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "auth.users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"kind" "exercise_kind" DEFAULT 'strength' NOT NULL,
	"modality" "modality" DEFAULT 'other' NOT NULL,
	"default_rest_sec" integer,
	"media_thumb_url" text,
	"media_video_url" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"owner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_catalog_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscles" (
	"exercise_id" uuid NOT NULL,
	"muscle_group_id" uuid NOT NULL,
	"role" "muscle_role" DEFAULT 'primary' NOT NULL,
	CONSTRAINT "exercise_muscles_exercise_id_muscle_group_id_role_pk" PRIMARY KEY("exercise_id","muscle_group_id","role")
);
--> statement-breakpoint
CREATE TABLE "milestone_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"goal_id" uuid,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metric_value" numeric(12, 2),
	"kind" text DEFAULT 'hit' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muscle_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	CONSTRAINT "muscle_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" "media_type" NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "split_day_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"split_id" uuid NOT NULL,
	CONSTRAINT "split_day_assignments_user_id_weekday_unique" UNIQUE("user_id","weekday")
);
--> statement-breakpoint
CREATE TABLE "split_exercise_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"split_exercise_id" uuid NOT NULL,
	"set_order" integer NOT NULL,
	"target_reps" integer,
	"target_weight_kg" numeric(7, 2),
	"rir" smallint,
	CONSTRAINT "split_exercise_sets_split_exercise_id_set_order_unique" UNIQUE("split_exercise_id","set_order")
);
--> statement-breakpoint
CREATE TABLE "split_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"split_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_pos" integer NOT NULL,
	"rest_sec_default" integer,
	"notes" text,
	CONSTRAINT "split_exercises_split_id_order_pos_unique" UNIQUE("split_id","order_pos")
);
--> statement-breakpoint
CREATE TABLE "splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_exercise_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"kind" "goal_type" NOT NULL,
	"target_weight_kg" numeric(7, 2),
	"target_reps" integer,
	"target_volume_kg" numeric(12, 2),
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_exercise_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"default_rest_sec" integer,
	"notes" text,
	CONSTRAINT "user_exercise_prefs_user_id_exercise_id_unique" UNIQUE("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "user_favorite_exercises" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorite_exercises_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"unit_pref" "unit_system" DEFAULT 'metric' NOT NULL,
	"timezone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"default_rest_sec" integer DEFAULT 120 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_pos" integer NOT NULL,
	"rest_sec_default" integer,
	"from_split_exercise_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_exercises_session_id_order_pos_unique" UNIQUE("session_id","order_pos")
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "session_state" DEFAULT 'planned' NOT NULL,
	"planned_for_date" date,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"split_id" uuid,
	"note" text,
	"energy_kcal" integer,
	"total_volume_kg" numeric(12, 2),
	"total_sets" integer,
	"duration_sec" integer,
	"media_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_exercise_id" uuid NOT NULL,
	"set_order" integer NOT NULL,
	"is_warmup" boolean DEFAULT false NOT NULL,
	"weight_kg" numeric(7, 2),
	"reps" integer,
	"duration_sec" integer,
	"distance_m" numeric(9, 2),
	"effort_rpe" numeric(3, 1),
	"rest_sec_planned" integer,
	"rest_sec_actual" integer,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sets_workout_exercise_id_set_order_unique" UNIQUE("workout_exercise_id","set_order")
);
--> statement-breakpoint
ALTER TABLE "exercise_catalog" ADD CONSTRAINT "exercise_catalog_owner_user_id_auth.users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."auth.users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscle_group_id_muscle_groups_id_fk" FOREIGN KEY ("muscle_group_id") REFERENCES "public"."muscle_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_goal_id_user_exercise_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."user_exercise_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_groups" ADD CONSTRAINT "muscle_groups_parent_id_muscle_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."muscle_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_media" ADD CONSTRAINT "session_media_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_day_assignments" ADD CONSTRAINT "split_day_assignments_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_day_assignments" ADD CONSTRAINT "split_day_assignments_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_exercise_sets" ADD CONSTRAINT "split_exercise_sets_split_exercise_id_split_exercises_id_fk" FOREIGN KEY ("split_exercise_id") REFERENCES "public"."split_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_exercises" ADD CONSTRAINT "split_exercises_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_exercises" ADD CONSTRAINT "split_exercises_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_goals" ADD CONSTRAINT "user_exercise_goals_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_goals" ADD CONSTRAINT "user_exercise_goals_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_prefs" ADD CONSTRAINT "user_exercise_prefs_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exercise_prefs" ADD CONSTRAINT "user_exercise_prefs_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_exercises" ADD CONSTRAINT "user_favorite_exercises_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_exercises" ADD CONSTRAINT "user_favorite_exercises_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_from_split_exercise_id_split_exercises_id_fk" FOREIGN KEY ("from_split_exercise_id") REFERENCES "public"."split_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exercise_catalog_owner" ON "exercise_catalog" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_milestones_user_date" ON "milestone_events" USING btree ("user_id","achieved_at");--> statement-breakpoint
CREATE INDEX "idx_session_media_session" ON "session_media" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_split_exercises_split" ON "split_exercises" USING btree ("split_id");--> statement-breakpoint
CREATE INDEX "idx_splits_user" ON "splits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goals_user_ex" ON "user_exercise_goals" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "idx_workout_exercises_session" ON "workout_exercises" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_workout_exercises_ex" ON "workout_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_date" ON "workout_sessions" USING btree ("user_id","planned_for_date");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_state" ON "workout_sessions" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "idx_workout_sets_ex" ON "workout_sets" USING btree ("workout_exercise_id");