CREATE TYPE "public"."body_part" AS ENUM('chest', 'back', 'leg', 'shoulder', 'triceps', 'biceps', 'core', 'forearm', 'cardio');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('barbell', 'dumbbell', 'kettlebell', 'machine', 'smith', 'cable', 'bodyweight');--> statement-breakpoint
CREATE TYPE "public"."session_state" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TABLE "auth.users" (
	"id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"modality" "modality" NOT NULL,
	"body_part" "body_part",
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
CREATE TABLE "split_day_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"split_id" uuid NOT NULL,
	CONSTRAINT "split_day_assignments_user_id_weekday_unique" UNIQUE("user_id","weekday")
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
	"order_pos" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "splits_user_id_order_pos_unique" UNIQUE("user_id","order_pos")
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order_pos" integer NOT NULL,
	"rest_sec_default" integer,
	"from_split_exercise_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_exercises_session_id_order_pos_unique" UNIQUE("session_id","order_pos")
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"state" "session_state" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"split_id" uuid,
	"note" text,
	"energy_kcal" integer,
	"total_volume_kg" integer,
	"total_sets" integer,
	"duration_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_sets_workout_exercise_id_set_order_unique" UNIQUE("workout_exercise_id","set_order")
);
--> statement-breakpoint
ALTER TABLE "exercise_catalog" ADD CONSTRAINT "exercise_catalog_owner_user_id_auth.users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."auth.users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_day_assignments" ADD CONSTRAINT "split_day_assignments_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_day_assignments" ADD CONSTRAINT "split_day_assignments_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_exercises" ADD CONSTRAINT "split_exercises_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_exercises" ADD CONSTRAINT "split_exercises_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercise_catalog_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_from_split_exercise_id_split_exercises_id_fk" FOREIGN KEY ("from_split_exercise_id") REFERENCES "public"."split_exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_auth.users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth.users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_split_id_splits_id_fk" FOREIGN KEY ("split_id") REFERENCES "public"."splits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_workout_exercises_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exercise_catalog_owner" ON "exercise_catalog" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_split_exercises_split" ON "split_exercises" USING btree ("split_id");--> statement-breakpoint
CREATE INDEX "idx_splits_user" ON "splits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_workout_exercises_session" ON "workout_exercises" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_workout_exercises_ex" ON "workout_exercises" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_state" ON "workout_sessions" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "idx_workout_sets_ex" ON "workout_sets" USING btree ("workout_exercise_id");