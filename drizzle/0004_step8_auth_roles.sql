ALTER TABLE "oauth_states" ADD COLUMN "purpose" text DEFAULT 'CONNECTION' NOT NULL;
--> statement-breakpoint
ALTER TABLE "oauth_states" ADD COLUMN "return_to" text;
--> statement-breakpoint
CREATE TABLE "app_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "app_sessions_token_hash_unique" ON "app_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "app_sessions_user_idx" ON "app_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "app_sessions_expires_idx" ON "app_sessions" USING btree ("expires_at");
