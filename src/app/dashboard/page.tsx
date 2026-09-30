import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { DashboardPortfolioFilters } from "@/components/dashboard-portfolio-filters";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";
import { requireUser } from "@/lib/auth/session";
import {
  filterAndSortProjects,
  getAvailableProjectTypes,
  getPortfolioOperationalGroups,
  getProjectRows,
  summarizeProjects,
  type ProjectFilter,
} from "@/lib/reporting/dashboard-data";
import { hours, money } from "@/lib/reporting/format";
import { getPortfolioStandouts } from "@/lib/reporting/portfolio-standouts";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function displayDate(value: Date | null): string {
  if (!value) return "Not calculated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function numberValue(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "No data" : `${value.toFixed(1)}%`;
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/dashboard");
  const params = await searchParams;
  const allProjects = await getProjectRows();
  const filter: ProjectFilter = {
    clients: many(params.client),
    healths: many(params.health),
    statuses: many(params.status),
    types: many(params.type),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
  };
  const projects = filterAndSortProjects(allProjects, filter);
  const summary = summarizeProjects(projects);
  const operationalGroups = await getPortfolioOperationalGroups(projects);
  const statuses = [...new Set(allProjects.map((row) => row.status).filter(Boolean))].sort();
  const clients = [
    ...new Set(
      allProjects.map((row) => row.companyName).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const types = getAvailableProjectTypes(allProjects);
  const reconciliationRows = operationalGroups.map((group) => ({
    label: group.groupName,
    detail: `${group.projectCount} project${group.projectCount === 1 ? "" : "s"}`,
    revenue: group.allocatedRevenue,
    cost: group.forecastCost,
    actualCost: group.actualCostToDate,
    remainingCost: group.remainingCost,
    profit: group.forecastProfit,
    margin: group.marginPercent,
    projectCount: group.projectCount,
  }));
  const totalRemainingCost = reconciliationRows.length
    ? reconciliationRows.reduce((sum, row) => {
        if (row.remainingCost !== null && row.remainingCost !== undefined)
          return sum + row.remainingCost;
        if (
          row.cost !== null &&
          row.cost !== undefined &&
          row.actualCost !== null &&
          row.actualCost !== undefined
        ) {
          return sum + Math.max(row.cost - row.actualCost, 0);
        }
        return sum;
      }, 0)
    : null;
  const forecastMargin =
    summary.totalClientFee && summary.totalForecastProfit !== null
      ? (summary.totalForecastProfit / summary.totalClientFee) * 100
      : null;
  const hoursProgress = summary.totalEstimatedMinutes
    ? (summary.totalLoggedMinutes / summary.totalEstimatedMinutes) * 100
    : null;
  const attentionCount = summary.amberCount + summary.redCount;
  const companyPulse = !summary.projectCount
    ? "No projects match this view. Adjust the filters to restore the company snapshot."
    : summary.redCount
      ? `${summary.redCount} project${summary.redCount === 1 ? " needs" : "s need"} immediate attention; review delivery risk before relying on the forecast.`
      : summary.amberCount
        ? `The portfolio is generally healthy, with ${summary.amberCount} project${summary.amberCount === 1 ? "" : "s"} to watch.`
        : "The current portfolio is healthy with no projects flagged at risk or unhealthy.";
  const healthPriority = { RED: 0, AMBER: 1, GRAY: 2, GREEN: 3 } as const;
  const projectsToWatch = projects
    .filter(
      (project) =>
        project.healthBand === "RED" ||
        project.healthBand === "AMBER" ||
        project.isProvisional ||
        project.dataQualityIssueCount > 0,
    )
    .sort((left, right) => {
      const healthDifference = healthPriority[left.healthBand] - healthPriority[right.healthBand];
      if (healthDifference) return healthDifference;
      if (left.isProvisional !== right.isProvisional) return left.isProvisional ? -1 : 1;
      return right.dataQualityIssueCount - left.dataQualityIssueCount;
    })
    .slice(0, 5);
  const portfolioStandouts = getPortfolioStandouts(projects);
  const companyProfitabilityRow = summary.projectCount
    ? {
        label: "Company forecast",
        detail: `${summary.projectCount} project${summary.projectCount === 1 ? "" : "s"}`,
        revenue: summary.totalClientFee,
        cost: summary.totalForecastCost,
        actualCost: summary.totalActualCost,
        remainingCost: totalRemainingCost,
        profit: summary.totalForecastProfit,
        margin: forecastMargin,
        projectCount: summary.projectCount,
      }
    : null;

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide executive-dashboard">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Company reporting</p>
            <h1>Company Overview</h1>
            <p>
              A quick read of company profitability, delivery health, workload, and data confidence.
            </p>
            <div className="report-titlebar__status" aria-label="Company project health summary">
              <span className="portfolio-status-dot portfolio-status-dot--green" />
              {summary.greenCount} healthy
              <span className="portfolio-status-dot portfolio-status-dot--amber" />
              {summary.amberCount} at risk
              <span className="portfolio-status-dot portfolio-status-dot--red" />
              {summary.redCount} unhealthy
            </div>
          </div>
          <div className="report-titlebar__actions">
            <span className="report-date-chip">
              Data as of {displayDate(summary.latestCalculatedAt)}
            </span>
            <DashboardPortfolioFilters
              action="/dashboard"
              filter={filter}
              clients={clients}
              statuses={statuses}
              types={types}
              resetHref="/dashboard"
            />
          </div>
        </section>

        <section
          id="company-snapshot"
          className="company-pulse company-pulse--executive"
          aria-label="Company performance at a glance"
        >
          <div className="company-pulse__summary">
            <p className="eyebrow">Company pulse</p>
            <h2>{companyPulse}</h2>
            <Link href={attentionCount ? "/projects?health=AMBER&health=RED" : "/projects"}>
              {attentionCount
                ? `Review ${attentionCount} flagged project${attentionCount === 1 ? "" : "s"}`
                : "View all projects"}
            </Link>
          </div>
          <div className="company-pulse__stat">
            <span>Cost coverage</span>
            <strong>
              {summary.projectCount
                ? `${summary.actualCostKnownCount} of ${summary.projectCount}`
                : "No data"}
            </strong>
            <small>
              {summary.actualCostPartialCount
                ? `${summary.actualCostPartialCount} partial or missing`
                : "all project costs complete"}
            </small>
          </div>
          <div className="company-pulse__stat">
            <span>Delivery health</span>
            <strong>
              {summary.projectCount
                ? `${summary.greenCount} of ${summary.projectCount}`
                : "No data"}
            </strong>
            <small>projects currently healthy</small>
          </div>
          <div className="company-pulse__stat">
            <span>Hours used</span>
            <strong>{percent(hoursProgress)}</strong>
            <small>
              {hours(summary.totalLoggedMinutes)} of {hours(summary.totalEstimatedMinutes)}
            </small>
          </div>
          <div className="company-pulse__stat">
            <span>Forecast confidence</span>
            <strong>
              {summary.projectCount
                ? `${summary.projectCount - summary.provisionalCount} of ${summary.projectCount}`
                : "No data"}
            </strong>
            <small>
              {summary.provisionalCount
                ? `${summary.provisionalCount} provisional`
                : "all projects fully costed"}
            </small>
          </div>
        </section>

        <section
          id="profit-forecast"
          className="report-section company-forecast-strip company-forecast-strip--full"
        >
          <div className="company-forecast-strip__heading">
            <div>
              <p className="eyebrow">Financial outlook</p>
              <h2>Profit Forecast</h2>
              <p>
                How current cost and remaining work translate into the company&apos;s expected
                outcome.
              </p>
            </div>
            <span>Every figure reflects the active filters.</span>
          </div>
          {companyProfitabilityRow ? (
            <PortfolioFinancialComposition
              rows={[companyProfitabilityRow]}
              variant="total"
              showHeroMetrics
            />
          ) : (
            <div className="chart-empty">No financial data matches these filters.</div>
          )}
        </section>

        <section id="projects-to-watch" className="report-section company-watchlist">
          <div className="company-watchlist__heading">
            <div>
              <p className="eyebrow">Portfolio exceptions</p>
              <h2>Projects to watch</h2>
              <p>
                Only projects with delivery risk, provisional forecasts, or data issues appear here.
              </p>
            </div>
            <Link href="/projects?health=AMBER&health=RED">View flagged projects</Link>
          </div>
          {projectsToWatch.length ? (
            <div className="company-watchlist__table-wrap">
              <table className="company-watchlist__table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Forecast profit</th>
                    <th>Forecast margin</th>
                    <th>Hours used</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsToWatch.map((project) => {
                    const projectHours = project.canonicalEstimatedMinutes
                      ? (project.loggedMinutes / project.canonicalEstimatedMinutes) * 100
                      : null;
                    const signal =
                      project.healthBand === "RED"
                        ? "Unhealthy"
                        : project.healthBand === "AMBER"
                          ? "At risk"
                          : project.isProvisional
                            ? "Forecast provisional"
                            : `${project.dataQualityIssueCount} data issue${project.dataQualityIssueCount === 1 ? "" : "s"}`;
                    return (
                      <tr key={project.id}>
                        <td>
                          <Link href={`/projects/${project.id}`}>{project.name}</Link>
                          <small>{project.companyName ?? project.projectNumber ?? "Project"}</small>
                        </td>
                        <td>{money(project.forecastProfit)}</td>
                        <td>{percent(numberValue(project.forecastMarginPercent))}</td>
                        <td>{percent(projectHours)}</td>
                        <td>
                          <span
                            className={`company-watchlist__signal company-watchlist__signal--${project.healthBand.toLowerCase()}`}
                          >
                            {signal}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="company-watchlist__empty">
              No projects in this view currently need attention.
            </p>
          )}
          {portfolioStandouts.length ? (
            <div className="portfolio-standouts">
              <div className="portfolio-standouts__heading">
                <p className="eyebrow">Portfolio standouts</p>
                <p>Noteworthy performance from the projects in this view.</p>
              </div>
              <div className="portfolio-standouts__grid">
                {portfolioStandouts.map((standout) => (
                  <Link
                    className={`portfolio-standout portfolio-standout--${standout.key}`}
                    href={`/projects/${standout.project.id}`}
                    key={standout.key}
                  >
                    <span>{standout.label}</span>
                    <strong>{standout.value}</strong>
                    <small>{standout.project.name}</small>
                    <em>{standout.detail}</em>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <footer className="report-footer">
          <span>Currency: USD</span>
          <span>All amounts rounded</span>
          <span>Data as of {displayDate(summary.latestCalculatedAt)}</span>
        </footer>
      </main>
    </AppShell>
  );
}
