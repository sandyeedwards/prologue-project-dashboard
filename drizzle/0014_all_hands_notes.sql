CREATE TABLE "all_hands_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "all_hands_notes_week_monday_check" CHECK (extract(isodow from "all_hands_notes"."week_start") = 1)
);
--> statement-breakpoint
ALTER TABLE "all_hands_notes" ADD CONSTRAINT "all_hands_notes_updated_by_user_id_app_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "all_hands_notes_week_unique" ON "all_hands_notes" USING btree ("week_start");
