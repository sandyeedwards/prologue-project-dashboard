CREATE TYPE "public"."hosting_sync_kind" AS ENUM('SCHEDULED', 'MANUAL');--> statement-breakpoint
CREATE TABLE "hosting_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hubspot_deal_id" text NOT NULL,
	"deal_name" text,
	"hubspot_url" text,
	"is_in_all_hosting_records" boolean DEFAULT true NOT NULL,
	"last_seen_in_all_hosting_records_at" timestamp with time zone,
	"removed_from_all_hosting_records_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ivion_site_id" uuid,
	"ivion_instance" text,
	"ivion_hosting_start" date,
	"ivion_hosting_end" date,
	"ivion_contracted_fee" numeric(16, 2),
	"ivion_total_panos" numeric(18, 2),
	"ivion_active_panos" numeric(18, 2),
	"ivion_comp_start" date,
	"ivion_comp_end" date,
	"ivion_comp_contracted_fee" numeric(16, 2),
	"benaco_hosting_start" date,
	"benaco_hosting_end" date,
	"benaco_contracted_fee" numeric(16, 2),
	"benaco_total_panos" numeric(18, 2),
	"benaco_comp_start" date,
	"benaco_comp_end" date,
	"benaco_comp_contracted_fee" numeric(16, 2),
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_ivion_site_cost_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"effective_on" date NOT NULL,
	"annual_cost" numeric(16, 2) NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosting_ivion_site_cost_history_nonnegative" CHECK ("hosting_ivion_site_cost_history"."annual_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "hosting_ivion_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"started_on" date,
	"ended_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosting_ivion_sites_dates_valid" CHECK ("hosting_ivion_sites"."ended_on" is null or "hosting_ivion_sites"."started_on" is null or "hosting_ivion_sites"."ended_on" >= "hosting_ivion_sites"."started_on")
);
--> statement-breakpoint
CREATE TABLE "hosting_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "hosting_sync_kind" NOT NULL,
	"status" "sync_status" DEFAULT 'RUNNING' NOT NULL,
	"segment_name" text DEFAULT 'All Hosting Records' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"records_removed_from_segment" integer DEFAULT 0 NOT NULL,
	"warnings" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"message" text,
	"property_map" jsonb,
	"summary" jsonb,
	"triggered_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD CONSTRAINT "hosting_deals_ivion_site_id_hosting_ivion_sites_id_fk" FOREIGN KEY ("ivion_site_id") REFERENCES "public"."hosting_ivion_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_ivion_site_cost_history" ADD CONSTRAINT "hosting_ivion_site_cost_history_site_id_hosting_ivion_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."hosting_ivion_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_ivion_site_cost_history" ADD CONSTRAINT "hosting_ivion_site_cost_history_created_by_user_id_app_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_sync_runs" ADD CONSTRAINT "hosting_sync_runs_triggered_by_user_id_app_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_deals_hubspot_id_unique" ON "hosting_deals" USING btree ("hubspot_deal_id");--> statement-breakpoint
CREATE INDEX "hosting_deals_reporting_segment_idx" ON "hosting_deals" USING btree ("is_in_all_hosting_records");--> statement-breakpoint
CREATE INDEX "hosting_deals_ivion_site_idx" ON "hosting_deals" USING btree ("ivion_site_id");--> statement-breakpoint
CREATE INDEX "hosting_deals_ivion_instance_idx" ON "hosting_deals" USING btree ("ivion_instance");--> statement-breakpoint
CREATE INDEX "hosting_deals_ivion_dates_idx" ON "hosting_deals" USING btree ("ivion_hosting_start","ivion_hosting_end");--> statement-breakpoint
CREATE INDEX "hosting_deals_benaco_dates_idx" ON "hosting_deals" USING btree ("benaco_hosting_start","benaco_hosting_end");--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_ivion_site_cost_history_site_date_unique" ON "hosting_ivion_site_cost_history" USING btree ("site_id","effective_on");--> statement-breakpoint
CREATE INDEX "hosting_ivion_site_cost_history_site_date_idx" ON "hosting_ivion_site_cost_history" USING btree ("site_id","effective_on");--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_ivion_sites_url_unique" ON "hosting_ivion_sites" USING btree ("url");--> statement-breakpoint
CREATE INDEX "hosting_ivion_sites_sort_idx" ON "hosting_ivion_sites" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "hosting_ivion_sites_active_idx" ON "hosting_ivion_sites" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "hosting_sync_runs_started_at_idx" ON "hosting_sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_sync_runs_running_unique" ON "hosting_sync_runs" USING btree ("status") WHERE "hosting_sync_runs"."status" = 'RUNNING';
--> statement-breakpoint
-- HOSTING_INITIAL_IVION_SEED
INSERT INTO "hosting_ivion_sites"
  ("label", "url", "started_on", "is_active", "sort_order")
VALUES
  ('Prologue 1', 'https://prologuesystems.iv.navvis.com/', '2026-07-08', true, 10),
  ('Prologue 2', 'https://prologuesystems2.iv.navvis.com/', '2026-07-08', true, 20),
  ('Prologue 3', 'https://prologuesystems3.iv.navvis.com/', '2025-10-10', true, 30),
  ('Prologue Hospitality 2', 'https://prologuehospitality2.iv.navvis.com/', '2026-07-06', true, 40);

--> statement-breakpoint
INSERT INTO "hosting_ivion_site_cost_history"
  ("site_id", "effective_on", "annual_cost", "currency_code")
SELECT
  site."id",
  seed."effective_on"::date,
  seed."annual_cost"::numeric(16, 2),
  'USD'
FROM (
  VALUES
    ('https://prologuesystems.iv.navvis.com/', '2026-07-08', '16185.00'),
    ('https://prologuesystems2.iv.navvis.com/', '2026-07-08', '16185.00'),
    ('https://prologuesystems3.iv.navvis.com/', '2025-10-10', '10905.00'),
    ('https://prologuehospitality2.iv.navvis.com/', '2026-07-06', '11985.00')
) AS seed("url", "effective_on", "annual_cost")
JOIN "hosting_ivion_sites" AS site
  ON site."url" = seed."url";