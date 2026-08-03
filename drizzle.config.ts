import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const migrationDatabaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required for database migrations.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
