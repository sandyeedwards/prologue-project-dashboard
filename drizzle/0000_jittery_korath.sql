CREATE TYPE "public"."assignment_kind" AS ENUM('USER', 'TEAM', 'COMPANY', 'JOB_ROLE');--> statement-breakpoint
CREATE TYPE "public"."dashboard_role" AS ENUM('VIEWER', 'MANAGER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."financial_coverage" AS ENUM('COMPLETE', 'PARTIAL', 'MISSING', 'NOT_EXPECTED');--> statement-breakpoint
CREATE TYPE "public"."health_band" AS ENUM('GREEN', 'AMBER', 'RED', 'GRAY');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('INFO', 'WARNING', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."snapshot_kind" AS ENUM('NIGHTLY', 'MONTH_END', 'RECONSTRUCTED');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('TEAMWORK', 'DASHBOARD_OVERRIDE', 'DERIVED', 'NOTEBOOK_FALLBACK');--> statement-breakpoint
CREATE TYPE "public"."sync_kind" AS ENUM('INITIAL_IMPORT', 'NIGHTLY', 'MANUAL', 'SNAPSHOT');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('RUNNING', 'SUCCEEDED', 'SUCCEEDED_WITH_WARNINGS', 'FAILED');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_user_id" bigint,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "dashboard_role" DEFAULT 'VIEWER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"name" text NOT NULL,
	"is_owner_company" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_list_id" uuid,
	"task_id" uuid,
	"severity" "issue_severity" NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"project_id" uuid NOT NULL,
	"project_budget_id" uuid,
	"task_list_id" uuid,
	"operational_group" text,
	"title" text NOT NULL,
	"category" text,
	"expense_date" date,
	"total_cost" numeric(16, 2),
	"total_billable" numeric(16, 2),
	"markup_percent" numeric(9, 4),
	"is_outsourced_modeling" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_group_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"priority" integer NOT NULL,
	"pattern" text NOT NULL,
	"group_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outsourced_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"hourly_rate" numeric(14, 4) NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outsourced_rates_nonnegative" CHECK ("outsourced_rates"."hourly_rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outsourced_task_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"company_id" uuid,
	"first_name" text,
	"last_name" text,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_client_user" boolean DEFAULT false NOT NULL,
	"is_service_account" boolean DEFAULT false NOT NULL,
	"is_site_admin" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "project_archive_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"archived_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text NOT NULL,
	"category" text,
	"currency_code" text DEFAULT 'USD',
	"client_fee" numeric(16, 2),
	"target_cost" numeric(16, 2),
	"target_profit" numeric(16, 2),
	"target_margin_percent" numeric(9, 4),
	"starts_on" date,
	"ends_on" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"financial_details_hidden" boolean DEFAULT false NOT NULL,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"kind" "snapshot_kind" NOT NULL,
	"client_fee" numeric(16, 2),
	"target_cost" numeric(16, 2),
	"projected_labor_cost" numeric(16, 2),
	"projected_non_labor_cost" numeric(16, 2),
	"actual_labor_cost" numeric(16, 2),
	"actual_non_labor_cost" numeric(16, 2),
	"forecast_cost" numeric(16, 2),
	"forecast_profit" numeric(16, 2),
	"forecast_margin_percent" numeric(9, 4),
	"estimated_minutes" integer,
	"logged_minutes" integer,
	"completed_task_count" integer,
	"total_task_count" integer,
	"estimate_consumption_percent" numeric(9, 4),
	"health_score" numeric(6, 2),
	"health_band" "health_band" NOT NULL,
	"task_list_budget_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
	"expense_coverage" "financial_coverage" DEFAULT 'MISSING' NOT NULL,
	"is_provisional" boolean DEFAULT true NOT NULL,
	"calculation_version" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tags" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "project_tags_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"company_id" uuid,
	"owner_person_id" uuid,
	"name" text NOT NULL,
	"project_number" text,
	"status" text NOT NULL,
	"project_type" text,
	"start_date" date,
	"end_date" date,
	"archived_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"excluded_from_reporting" boolean DEFAULT false NOT NULL,
	"exclusion_reason" text,
	"teamwork_updated_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"entity_type" text,
	"teamwork_entity_id" bigint,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "sync_kind" NOT NULL,
	"status" "sync_status" DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"cursor" jsonb,
	"summary" jsonb,
	"triggered_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"task_id" uuid NOT NULL,
	"kind" "assignment_kind" NOT NULL,
	"teamwork_assignee_id" bigint NOT NULL,
	"person_id" uuid,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_assignments_task_id_kind_teamwork_assignee_id_pk" PRIMARY KEY("task_id","kind","teamwork_assignee_id")
);
--> statement-breakpoint
CREATE TABLE "task_list_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint,
	"project_budget_id" uuid NOT NULL,
	"task_list_id" uuid NOT NULL,
	"target_cost" numeric(16, 2),
	"source" "source_kind" DEFAULT 'TEAMWORK' NOT NULL,
	"coverage" "financial_coverage" DEFAULT 'COMPLETE' NOT NULL,
	"override_reason" text,
	"overridden_by_user_id" uuid,
	"overridden_at" timestamp with time zone,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_billable" boolean,
	"operational_group" text NOT NULL,
	"operational_group_source" "source_kind" DEFAULT 'DERIVED' NOT NULL,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"project_id" uuid NOT NULL,
	"task_list_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"parent_teamwork_id" bigint,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"estimated_minutes" integer,
	"accumulated_estimated_minutes" integer,
	"progress_percent" integer,
	"start_date" date,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_outsourced_candidate" boolean DEFAULT false NOT NULL,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_estimated_minutes_nonnegative" CHECK ("tasks"."estimated_minutes" is null or "tasks"."estimated_minutes" >= 0),
	CONSTRAINT "tasks_progress_valid" CHECK ("tasks"."progress_percent" is null or ("tasks"."progress_percent" >= 0 and "tasks"."progress_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamwork_id" bigint NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid,
	"person_id" uuid,
	"logged_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"is_billable" boolean DEFAULT false NOT NULL,
	"description" text,
	"historical_cost_rate" numeric(14, 4),
	"historical_cost_total" numeric(16, 4),
	"cost_info_returned" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"teamwork_updated_at" timestamp with time zone,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_minutes_nonnegative" CHECK ("time_entries"."minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_quality_issues" ADD CONSTRAINT "data_quality_issues_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outsourced_rates" ADD CONSTRAINT "outsourced_rates_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_archive_overrides" ADD CONSTRAINT "project_archive_overrides_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_archive_overrides" ADD CONSTRAINT "project_archive_overrides_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_budgets" ADD CONSTRAINT "project_budgets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_issues" ADD CONSTRAINT "sync_issues_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_triggered_by_user_id_app_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_budgets" ADD CONSTRAINT "task_list_budgets_project_budget_id_project_budgets_id_fk" FOREIGN KEY ("project_budget_id") REFERENCES "public"."project_budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_budgets" ADD CONSTRAINT "task_list_budgets_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_list_budgets" ADD CONSTRAINT "task_list_budgets_overridden_by_user_id_app_users_id_fk" FOREIGN KEY ("overridden_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_lists" ADD CONSTRAINT "task_lists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_task_list_id_task_lists_id_fk" FOREIGN KEY ("task_list_id") REFERENCES "public"."task_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_unique" ON "app_users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_teamwork_user_unique" ON "app_users" USING btree ("teamwork_user_id") WHERE "app_users"."teamwork_user_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_teamwork_id_unique" ON "companies" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "data_quality_project_idx" ON "data_quality_issues" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "data_quality_open_idx" ON "data_quality_issues" USING btree ("project_id","code") WHERE "data_quality_issues"."resolved_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_teamwork_id_unique" ON "expenses" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "expenses_project_date_idx" ON "expenses" USING btree ("project_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_budget_idx" ON "expenses" USING btree ("project_budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_group_rules_priority_unique" ON "operational_group_rules" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "outsourced_rates_effective_from_unique" ON "outsourced_rates" USING btree ("effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "outsourced_task_aliases_normalized_unique" ON "outsourced_task_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "people_teamwork_id_unique" ON "people" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "people_company_idx" ON "people" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_archive_overrides_project_unique" ON "project_archive_overrides" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_budgets_teamwork_id_unique" ON "project_budgets" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "project_budgets_project_idx" ON "project_budgets" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_snapshots_unique" ON "project_snapshots" USING btree ("project_id","snapshot_date","kind");--> statement-breakpoint
CREATE INDEX "project_snapshots_date_idx" ON "project_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_teamwork_id_unique" ON "projects" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "projects_company_idx" ON "projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_project_number_idx" ON "projects" USING btree ("project_number");--> statement-breakpoint
CREATE INDEX "projects_archived_at_idx" ON "projects" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "sync_issues_run_idx" ON "sync_issues" USING btree ("sync_run_id");--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_teamwork_id_unique" ON "tags" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "tags_normalized_name_idx" ON "tags" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "task_assignments_person_idx" ON "task_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_list_budgets_period_list_unique" ON "task_list_budgets" USING btree ("project_budget_id","task_list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_list_budgets_teamwork_id_unique" ON "task_list_budgets" USING btree ("teamwork_id") WHERE "task_list_budgets"."teamwork_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_lists_teamwork_id_unique" ON "task_lists" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "task_lists_project_idx" ON "task_lists" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_lists_group_idx" ON "task_lists" USING btree ("operational_group");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_teamwork_id_unique" ON "tasks" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_task_list_idx" ON "tasks" USING btree ("task_list_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_teamwork_idx" ON "tasks" USING btree ("parent_teamwork_id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_teamwork_id_unique" ON "time_entries" USING btree ("teamwork_id");--> statement-breakpoint
CREATE INDEX "time_entries_project_date_idx" ON "time_entries" USING btree ("project_id","logged_date");--> statement-breakpoint
CREATE INDEX "time_entries_task_idx" ON "time_entries" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "time_entries_person_date_idx" ON "time_entries" USING btree ("person_id","logged_date");