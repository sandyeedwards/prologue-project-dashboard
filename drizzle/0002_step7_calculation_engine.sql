CREATE TYPE "estimate_source" AS ENUM('OWN', 'CHILDREN', 'NONE');
--> statement-breakpoint
CREATE TABLE "calculation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" "sync_status" DEFAULT 'RUNNING' NOT NULL,
  "calculation_version" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "projects_read" integer DEFAULT 0 NOT NULL,
  "projects_calculated" integer DEFAULT 0 NOT NULL,
  "warnings" integer DEFAULT 0 NOT NULL,
  "errors" integer DEFAULT 0 NOT NULL,
  "summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "project_metrics" (
  "project_id" uuid PRIMARY KEY NOT NULL,
  "calculation_run_id" uuid NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_fee" numeric(16, 2),
  "target_cost" numeric(16, 2),
  "target_profit" numeric(16, 2),
  "target_margin_percent" numeric(9, 4),
  "canonical_estimated_minutes" integer DEFAULT 0 NOT NULL,
  "logged_minutes" integer DEFAULT 0 NOT NULL,
  "task_linked_minutes" integer DEFAULT 0 NOT NULL,
  "unallocated_minutes" integer DEFAULT 0 NOT NULL,
  "unestimated_logged_minutes" integer DEFAULT 0 NOT NULL,
  "completed_task_count" integer DEFAULT 0 NOT NULL,
  "total_task_count" integer DEFAULT 0 NOT NULL,
  "projected_labor_cost" numeric(16, 2),
  "actual_labor_cost" numeric(16, 2),
  "remaining_labor_cost" numeric(16, 2),
  "projected_non_labor_cost" numeric(16, 2),
  "actual_non_labor_cost" numeric(16, 2),
  "remaining_non_labor_cost" numeric(16, 2),
  "projected_total_cost" numeric(16, 2),
  "actual_total_cost" numeric(16, 2),
  "forecast_cost" numeric(16, 2),
  "forecast_profit" numeric(16, 2),
  "forecast_margin_percent" numeric(9, 4),
  "estimate_consumption_percent" numeric(9, 4),
  "progress_percent" numeric(9, 4),
  "financial_score" numeric(6, 2),
  "schedule_score" numeric(6, 2),
  "effort_score" numeric(6, 2),
  "overdue_score" numeric(6, 2),
  "completeness_score" numeric(6, 2),
  "health_score" numeric(6, 2),
  "health_band" "health_band" NOT NULL,
  "labor_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "assignment_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "task_list_budget_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "expense_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "is_provisional" boolean DEFAULT true NOT NULL,
  "details" jsonb
);
--> statement-breakpoint
CREATE TABLE "task_metrics" (
  "task_id" uuid PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL,
  "calculation_run_id" uuid NOT NULL,
  "estimate_source" "estimate_source" NOT NULL,
  "own_estimated_minutes" integer DEFAULT 0 NOT NULL,
  "counted_estimated_minutes" integer DEFAULT 0 NOT NULL,
  "branch_estimated_minutes" integer DEFAULT 0 NOT NULL,
  "own_logged_minutes" integer DEFAULT 0 NOT NULL,
  "branch_logged_minutes" integer DEFAULT 0 NOT NULL,
  "remaining_minutes" integer DEFAULT 0 NOT NULL,
  "is_canonical_holder" boolean DEFAULT false NOT NULL,
  "is_branch_complete" boolean DEFAULT false NOT NULL,
  "is_outsourced" boolean DEFAULT false NOT NULL,
  "projected_labor_cost" numeric(16, 2),
  "actual_labor_cost" numeric(16, 2),
  "remaining_labor_cost" numeric(16, 2),
  "projected_outsourced_cost" numeric(16, 2),
  "assignment_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "details" jsonb,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_group_metrics" (
  "project_id" uuid NOT NULL,
  "group_name" text NOT NULL,
  "calculation_run_id" uuid NOT NULL,
  "target_cost" numeric(16, 2),
  "target_cost_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
  "estimated_minutes" integer DEFAULT 0 NOT NULL,
  "logged_minutes" integer DEFAULT 0 NOT NULL,
  "projected_labor_cost" numeric(16, 2),
  "actual_labor_cost" numeric(16, 2),
  "projected_non_labor_cost" numeric(16, 2),
  "actual_non_labor_cost" numeric(16, 2),
  "forecast_cost" numeric(16, 2),
  "variance_to_target" numeric(16, 2),
  "progress_percent" numeric(9, 4),
  "details" jsonb,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "operational_group_metrics_project_id_group_name_pk" PRIMARY KEY("project_id", "group_name")
);
--> statement-breakpoint
ALTER TABLE "project_metrics" ADD CONSTRAINT "project_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_metrics" ADD CONSTRAINT "project_metrics_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "operational_group_metrics" ADD CONSTRAINT "operational_group_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "operational_group_metrics" ADD CONSTRAINT "operational_group_metrics_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "calculation_runs_started_at_idx" ON "calculation_runs" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX "project_metrics_health_idx" ON "project_metrics" USING btree ("health_band", "health_score");
--> statement-breakpoint
CREATE INDEX "project_metrics_run_idx" ON "project_metrics" USING btree ("calculation_run_id");
--> statement-breakpoint
CREATE INDEX "task_metrics_project_idx" ON "task_metrics" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "task_metrics_run_idx" ON "task_metrics" USING btree ("calculation_run_id");
--> statement-breakpoint
CREATE INDEX "operational_group_metrics_run_idx" ON "operational_group_metrics" USING btree ("calculation_run_id");
