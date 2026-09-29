ALTER TABLE "hosting_deals" ADD COLUMN "site_name" text;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "ivion_calculated_quarterly_fee" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "ivion_contracted_quarterly_fee" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "ivion_date_added" date;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "ivion_date_sent_to_client" date;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "ivion_bundle_archive_date" date;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "benaco_url" text;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "benaco_calculated_cost" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "benaco_annual_fee" numeric(16, 2);--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "hosting_notes" text;--> statement-breakpoint
ALTER TABLE "hosting_deals" ADD COLUMN "hosting_communications_contact" text;