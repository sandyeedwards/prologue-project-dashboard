import { desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/session";
import { getDb } from "@/db/client";
import { syncRuns, teamworkConnections } from "@/db/schema";
import { TeamworkSyncControl } from "./sync-control";
export const dynamic = "force-dynamic";
export default async function TeamworkAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole("ADMIN", "/admin/teamwork");
  const params = await searchParams;
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
  const runs = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(10);
  return (
    <AppShell user={session.user}>
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Administration</p>
          <h1>Teamwork connection</h1>
          <p>
            Authorize one Prologue administrator account to provide the dashboard’s central
            read-only reporting connection.
          </p>
        </section>
        <section className="panel">
          <h2>{connection ? "Connected" : "Not connected"}</h2>
          {connection ? (
            <>
              <p>
                <strong>{connection.installationName}</strong>
              </p>
              <p>{connection.apiEndpoint}</p>
              <p>Last sync: {connection.lastSyncAt?.toLocaleString() ?? "Not run"}</p>
            </>
          ) : (
            <p>
              Add the Step 6 environment values, then open{" "}
              <code>/api/teamwork/oauth/start?key=YOUR_SETUP_KEY</code>.
            </p>
          )}
          {params.connected && (
            <p>Authorization completed successfully. Run the initial import from PowerShell.</p>
          )}
          {params.error && <p>Authorization error: {params.error}</p>}
          <TeamworkSyncControl disabled={!connection} />
        </section>
        <section className="panel">
          <h2>Recent sync runs</h2>
          {runs.length === 0 ? (
            <p>No synchronization has run.</p>
          ) : (
            <ul>
              {runs.map((run) => (
                <li key={run.id}>
                  {run.kind} — {run.status} — {run.startedAt.toLocaleString()} — {run.recordsRead}{" "}
                  records read
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
