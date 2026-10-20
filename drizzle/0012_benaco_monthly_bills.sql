CREATE TABLE "hosting_benaco_monthly_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_month" date NOT NULL,
	"billed_amount" numeric(16, 2) NOT NULL,
	"active_panos" numeric(18, 2) NOT NULL,
	"notes" text,
	"entered_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosting_benaco_monthly_bills_month_check" CHECK ("hosting_benaco_monthly_bills"."billing_month" >= DATE '2023-01-01'),
	CONSTRAINT "hosting_benaco_monthly_bills_amount_check" CHECK ("hosting_benaco_monthly_bills"."billed_amount" >= 0),
	CONSTRAINT "hosting_benaco_monthly_bills_panos_check" CHECK ("hosting_benaco_monthly_bills"."active_panos" > 0)
);
--> statement-breakpoint
ALTER TABLE "hosting_benaco_monthly_bills" ADD CONSTRAINT "hosting_benaco_monthly_bills_entered_by_user_id_app_users_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_benaco_monthly_bills_month_unique" ON "hosting_benaco_monthly_bills" USING btree ("billing_month");
