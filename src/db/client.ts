import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type SqlClient = ReturnType<typeof postgres>;
type Database = ReturnType<typeof drizzle<typeof schema>>;

const globalForDatabase = globalThis as unknown as {
  sqlClient?: SqlClient;
  database?: Database;
};

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }
  return databaseUrl;
}

export function getSqlClient(): SqlClient {
  if (!globalForDatabase.sqlClient) {
    globalForDatabase.sqlClient = postgres(getDatabaseUrl(), {
      max: process.env.NODE_ENV === "production" ? 10 : 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalForDatabase.sqlClient;
}

export function getDb(): Database {
  if (!globalForDatabase.database) {
    globalForDatabase.database = drizzle(getSqlClient(), { schema });
  }
  return globalForDatabase.database;
}
