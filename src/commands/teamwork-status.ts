import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "@/db/client";
import { syncRuns, teamworkConnections } from "@/db/schema";

async function main() {
  const db = getDb();
  const [connection] = await db
    .select({
      installationName: teamworkConnections.installationName,
      apiEndpoint: teamworkConnections.apiEndpoint,
      connectedAt: teamworkConnections.connectedAt,
      lastSyncAt: teamworkConnections.lastSyncAt,
    })
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);

  const [lastRun] = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);

  console.log(
    JSON.stringify(
      { connected: Boolean(connection), connection: connection ?? null, lastRun: lastRun ?? null },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
