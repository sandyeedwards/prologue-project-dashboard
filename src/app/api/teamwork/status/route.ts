import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { syncRuns, teamworkConnections } from "@/db/schema";
import { authorizeApi } from "@/lib/auth/session";

export async function GET() {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  const db = getDb();
  const [connection] = await db
    .select({
      installationName: teamworkConnections.installationName,
      apiEndpoint: teamworkConnections.apiEndpoint,
      connectedAt: teamworkConnections.connectedAt,
      lastVerifiedAt: teamworkConnections.lastVerifiedAt,
      lastSyncAt: teamworkConnections.lastSyncAt,
    })
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);
  const [lastRun] = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
  return NextResponse.json({ connected: Boolean(connection), connection: connection ?? null, lastRun: lastRun ?? null });
}
