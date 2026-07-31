CREATE TABLE "job_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teamwork_id" bigint NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "cost_rate" numeric(14, 4),
  "cost_currency" text DEFAULT 'USD',
  "cost_rate_returned" boolean DEFAULT false NOT NULL,
  "deleted_at" timestamp with time zone,
  "teamwork_updated_at" timestamp with time zone,
  "raw" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_roles_teamwork_id_unique" ON "job_roles" USING btree ("teamwork_id");
--> statement-breakpoint
CREATE INDEX "job_roles_active_idx" ON "job_roles" USING btree ("is_active");
--> statement-breakpoint
CREATE TABLE "unplanned_work_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "dismissed_by_user_id" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "dismissed_logged_minutes" integer DEFAULT 0 NOT NULL,
  "dismissed_labor_cost" numeric(16, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unplanned_work_reviews" ADD CONSTRAINT "unplanned_work_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unplanned_work_reviews" ADD CONSTRAINT "unplanned_work_reviews_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "unplanned_work_reviews" ADD CONSTRAINT "unplanned_work_reviews_dismissed_by_user_id_app_users_id_fk" FOREIGN KEY ("dismissed_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "unplanned_work_reviews_task_unique" ON "unplanned_work_reviews" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "unplanned_work_reviews_project_idx" ON "unplanned_work_reviews" USING btree ("project_id");
