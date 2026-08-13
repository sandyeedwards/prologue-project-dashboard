import { count, desc, eq } from "drizzle-orm";
import { AppShell } from "@/components/app-shell";
import { MarginText } from "@/components/reporting-ui";
import { requireRole } from "@/lib/auth/session";
import { getDb } from "@/db/client";
import { REPORTING_RULES } from "@/config/reporting-rules";
import {
  calculationRuns,
  dataQualityIssues,
  projectMetrics,
  projects,
  taskMetrics,
} from "@/db/schema";

export const dynamic = "force-dynamic";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Missing";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Missing";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

export default async function CalculationsAdminPage() {
  const session = await requireRole("ADMIN", "/admin/calculations");
  const db = getDb();
  const [latestRun] = await db
    .select()
    .from(calculationRuns)
    .orderBy(desc(calculationRuns.startedAt))
    .limit(1);
  const [[projectCount], [taskCount], [issueCount]] = await Promise.all([
    db.select({ value: count() }).from(projectMetrics),
    db.select({ value: count() }).from(taskMetrics),
    db.select({ value: count() }).from(dataQualityIssues),
  ]);
  const [pilot] = await db
    .select({
      name: projects.name,
      healthBand: projectMetrics.healthBand,
      forecastCost: projectMetrics.forecastCost,
      forecastMarginPercent: projectMetrics.forecastMarginPercent,
      isProvisional: projectMetrics.isProvisional,
      details: projectMetrics.details,
    })
    .from(projects)
    .innerJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .where(eq(projects.projectNumber, REPORTING_RULES.calculationPilotProjectNumber))
    .limit(1);

  return (
    <AppShell user={session.user}>
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Administration</p>
          <h1>Calculation engine</h1>
          <p className="lede">
            Current project, task, operational-group, forecast, data-quality, and health metrics.
          </p>
        </section>

        <section className="status-grid">
          <div className="status-card">
            <p className="status-card__label">Latest run</p>
            <p className="status-card__value">{latestRun?.status ?? "Not run"}</p>
            <p className="status-card__detail">
              {latestRun?.completedAt?.toLocaleString() ?? "Run npm run step7:run"}
            </p>
          </div>
          <div className="status-card">
            <p className="status-card__label">Projects</p>
            <p className="status-card__value">{projectCount.value}</p>
            <p className="status-card__detail">Reporting-eligible projects calculated</p>
          </div>
          <div className="status-card">
            <p className="status-card__label">Tasks</p>
            <p className="status-card__value">{taskCount.value}</p>
            <p className="status-card__detail">Canonical task metrics materialized</p>
          </div>
          <div className="status-card">
            <p className="status-card__label">Data quality</p>
            <p className="status-card__value">{issueCount.value}</p>
            <p className="status-card__detail">Current transparent warnings</p>
          </div>
        </section>

        <section className="panel">
          <div>
            <p className="eyebrow">Pilot validation</p>
            <h2>
              {pilot?.name ?? `${REPORTING_RULES.calculationPilotProjectNumber} not calculated`}
            </h2>
          </div>
          {pilot ? (
            <ul>
              <li>Health band: {pilot.healthBand}</li>
              <li>Forecast cost: {money(pilot.forecastCost)}</li>
              <li>
                Forecast margin: <MarginText value={pilot.forecastMarginPercent} digits={4} />
              </li>
              <li>Provisional: {pilot.isProvisional ? "Yes" : "No"}</li>
              <li>
                Projected outsourced cost:{" "}
                {money(
                  (pilot.details as Record<string, unknown> | null)?.projectedOutsourcedCost as
                    string | number | null | undefined,
                )}
              </li>
            </ul>
          ) : (
            <p>Run the Step 7 calculation command after applying the migration.</p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
