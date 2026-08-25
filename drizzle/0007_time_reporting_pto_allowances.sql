CREATE TABLE "pto_allowance_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"calendar_year" integer NOT NULL,
	"allowance_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pto_allowance_overrides_year_valid" CHECK ("pto_allowance_overrides"."calendar_year" >= 2000),
	CONSTRAINT "pto_allowance_overrides_minutes_nonnegative" CHECK ("pto_allowance_overrides"."allowance_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pto_allowance_overrides" ADD CONSTRAINT "pto_allowance_overrides_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pto_allowance_overrides_person_year_unique" ON "pto_allowance_overrides" USING btree ("person_id","calendar_year");--> statement-breakpoint
CREATE INDEX "pto_allowance_overrides_year_idx" ON "pto_allowance_overrides" USING btree ("calendar_year");