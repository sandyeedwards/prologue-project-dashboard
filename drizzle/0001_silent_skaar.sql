CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamwork_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" bigint NOT NULL,
	"installation_name" text NOT NULL,
	"api_endpoint" text NOT NULL,
	"region" text,
	"encrypted_access_token" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_auth_tag" text NOT NULL,
	"connected_by_teamwork_user_id" bigint,
	"connected_by_email" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_states_hash_unique" ON "oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "teamwork_connections_installation_unique" ON "teamwork_connections" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "teamwork_connections_active_idx" ON "teamwork_connections" USING btree ("is_active");