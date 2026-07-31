ALTER TABLE "project_metrics" ALTER COLUMN "estimate_consumption_percent" SET DATA TYPE numeric(18, 4);
--> statement-breakpoint
ALTER TABLE "project_snapshots" ALTER COLUMN "estimate_consumption_percent" SET DATA TYPE numeric(18, 4);
