import "dotenv/config";
import { sql } from "drizzle-orm";

import { getDb, getSqlClient } from "../db/client";

async function checkDatabase(): Promise<void> {
  const startedAt = Date.now();
  const db = getDb();
  const result = await db.execute(sql<{
    database_name: string;
    database_user: string;
    server_version: string;
  }>`
    select
      current_database() as database_name,
      current_user as database_user,
      current_setting('server_version') as server_version
  `);

  const row = result[0];
  console.log(
    JSON.stringify(
      {
        status: "ok",
        latencyMs: Date.now() - startedAt,
        database: row?.database_name,
        user: row?.database_user,
        serverVersion: row?.server_version,
      },
      null,
      2,
    ),
  );
}

checkDatabase()
  .then(() => getSqlClient().end())
  .catch(async (error: unknown) => {
    console.error("Database check failed.", error);
    await getSqlClient().end();
    process.exitCode = 1;
  });
