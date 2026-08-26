import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required for database migrations.");
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

try {
  console.log(`[migrations] Applying migrations from ${migrationsFolder}`);
  await migrate(drizzle(sql), { migrationsFolder });
  console.log("[migrations] Database is current.");
} finally {
  await sql.end();
}
