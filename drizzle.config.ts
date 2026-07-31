import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://prologue:prologue_local_only@localhost:5432/prologue_dashboard",
  },
  strict: true,
  verbose: true,
});
