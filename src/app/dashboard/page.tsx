import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { DashboardPortfolioFilters } from "@/components/dashboard-portfolio-filters";
import { MetricCard } from "@/components/reporting-ui";
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

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function knownFor(knownCount: number, projectCount: number): string {
  if (!projectCount) return "No projects match the current filters.";
  return `Known for ${knownCount} of ${projectCount} project${projectCount === 1 ? "" : "s"}`;
}

function actualCostCoverageDetail(
  completeCount: number,
  partialCount: number,
  projectCount: number,
): string {
  if (!projectCount) return "No projects match the current filters.";
  if (!partialCount) {
    return `Complete cost coverage for ${completeCount} of ${projectCount} project${projectCount === 1 ? "" : "s"}`;
  }
  return `Cost coverage: ${completeCount} complete · ${partialCount} partial/missing`;
}

function portfolioMoney(value: string | number | null, projectCount: number): string {
  return projectCount ? money(value) : "No data";
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
  const today = new Date();
  const completedThisYear = projects.filter(
    (project) => project.completedAt?.getUTCFullYear() === today.getUTCFullYear(),
  ).length;
  const largestProject = projects
    .map((project) => ({ project, fee: numberValue(project.clientFee) }))
    .filter(
      (item): item is { project: (typeof projects)[number]; fee: number } => item.fee !== null,
    )
    .sort((left, right) => right.fee - left.fee)[0];
  const highestForecastProfit = projects
    .map((project) => ({ project, profit: numberValue(project.forecastProfit) }))
    .filter(
      (item): item is { project: (typeof projects)[number]; profit: number } =>
        item.profit !== null,
    )
    .sort((left, right) => right.profit - left.profit)[0];
  const strongestForecastMargin = projects
    .map((project) => ({ project, margin: numberValue(project.forecastMarginPercent) }))
    .filter(
      (item): item is { project: (typeof projects)[number]; margin: number } =>
        item.margin !== null,
    )
    .sort((left, right) => right.margin - left.margin)[0];
  const mostWorkedProject = [...projects].sort(
    (left, right) => right.loggedMinutes - left.loggedMinutes,
  )[0];

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

        <section className="company-pulse" aria-label="Company performance at a glance">
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
            <span>Forecast margin</span>
            <strong>{percent(forecastMargin)}</strong>
            <small>
              {summary.totalForecastProfit === null
                ? "Profit unavailable"
                : `${money(summary.totalForecastProfit)} expected profit`}
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

        <section className="executive-kpis" aria-label="Company financial summary">
          <div className="executive-kpis__primary">
            <MetricCard
              priority="primary"
              accent="amber"
              label="Actual Cost to Date"
              value={portfolioMoney(summary.totalActualCost, summary.projectCount)}
              detail={actualCostCoverageDetail(
                summary.actualCostKnownCount,
                summary.actualCostPartialCount,
                summary.projectCount,
              )}
              help="Historical Teamwork labor cost plus active imported project expenses through the latest synchronization. The total includes known subtotals for projects with partial source coverage; missing cost records are never treated as zero."
            />
            <MetricCard
              priority="primary"
              accent="purple"
              label="Costed Remaining Work"
              value={portfolioMoney(totalRemainingCost, summary.projectCount)}
              detail={knownFor(summary.forecastCostKnownCount, summary.projectCount)}
              help={`Estimated remaining internal and outsourced cost from today to completion. This excludes actual cost already incurred and mirrors the costed remaining work shown in the profitability chart. ${summary.provisionalCount} project${summary.provisionalCount === 1 ? " is" : "s are"} provisional, so missing rates, assignments, or expenses can make this a known minimum.`}
              tone={
                summary.projectCount
                  ? summary.provisionalCount
                    ? "warning"
                    : "success"
                  : undefined
              }
            />
            <MetricCard
              priority="primary"
              accent="green"
              label="Forecasted Profit"
              value={portfolioMoney(summary.totalForecastProfit, summary.projectCount)}
              detail={knownFor(summary.forecastProfitKnownCount, summary.projectCount)}
              help="Known client fees less known forecast cost. Provisional projects can cause this value to change when unresolved costs are priced."
            />
          </div>
          <div className="executive-kpis__secondary">
            <MetricCard
              accent="blue"
              label="Allocated Revenue"
              value={portfolioMoney(summary.totalClientFee, summary.projectCount)}
              detail={knownFor(summary.clientFeeKnownCount, summary.projectCount)}
              help="Sum of fixed-fee project budgets returned by Teamwork. Missing fees remain missing and are not treated as $0."
            />
            <MetricCard
              accent="navy"
              label="Projects in View"
              value={summary.projectCount}
              detail={`${summary.greenCount} healthy · ${summary.amberCount} at risk · ${summary.redCount} unhealthy`}
            />
            <MetricCard
              accent="purple"
              label="Logged Hours"
              value={hours(summary.totalLoggedMinutes)}
              detail={`${hours(summary.totalLoggedMinutes)} of ${hours(summary.totalEstimatedMinutes)} estimated`}
            />
          </div>
        </section>

        <section className="company-highlights" aria-label="Company highlights">
          <div className="company-highlights__intro">
            <p className="eyebrow">Around the company</p>
            <h2>Portfolio highlights</h2>
            <p>Useful milestones and standouts from the projects currently in view.</p>
          </div>
          <article className="company-highlight-card">
            <span className="company-highlight-card__icon" aria-hidden="true">
              ✓
            </span>
            <small>Completed this year</small>
            <strong>{completedThisYear}</strong>
            <p>projects reached completion in {today.getUTCFullYear()}</p>
          </article>
          <article className="company-highlight-card">
            <span className="company-highlight-card__icon" aria-hidden="true">
              ◆
            </span>
            <small>Largest project</small>
            <strong>{largestProject ? money(largestProject.fee) : "No data"}</strong>
            <p>{largestProject?.project.name ?? "No project revenue available"}</p>
          </article>
          <article className="company-highlight-card">
            <span className="company-highlight-card__icon" aria-hidden="true">
              $
            </span>
            <small>Highest forecast profit</small>
            <strong>
              {highestForecastProfit ? money(highestForecastProfit.profit) : "No data"}
            </strong>
            <p>{highestForecastProfit?.project.name ?? "No project forecast available"}</p>
          </article>
          <article className="company-highlight-card">
            <span className="company-highlight-card__icon" aria-hidden="true">
              %
            </span>
            <small>Strongest forecast margin</small>
            <strong>
              {strongestForecastMargin ? percent(strongestForecastMargin.margin) : "No data"}
            </strong>
            <p>{strongestForecastMargin?.project.name ?? "No project margin available"}</p>
          </article>
          <article className="company-highlight-card">
            <span className="company-highlight-card__icon" aria-hidden="true">
              ⚡
            </span>
            <small>Most project hours</small>
            <strong>
              {mostWorkedProject ? hours(mostWorkedProject.loggedMinutes) : "No data"}
            </strong>
            <p>{mostWorkedProject?.name ?? "No logged project time"}</p>
          </article>
        </section>

        <nav className="report-launch-grid" aria-label="Detailed company reports">
          <Link href="/profit-forecast">
            <span>Expected outcome</span>
            <strong>
              Go to Profit Forecast <b aria-hidden="true">→</b>
            </strong>
            <small>Revenue, costs, remaining work, margin, and expected profit.</small>
          </Link>
          <Link href="/revenue-trends">
            <span>History over time</span>
            <strong>
              Go to Revenue Trends <b aria-hidden="true">→</b>
            </strong>
            <small>Revenue, actual cost, and net profit from January 2025 onward.</small>
          </Link>
          <Link href="/operational-performance">
            <span>Delivery groups</span>
            <strong>
              Go to Operational Performance <b aria-hidden="true">→</b>
            </strong>
            <small>Compare financial performance across each kind of work.</small>
          </Link>
        </nav>

        <footer className="report-footer">
          <span>Currency: USD</span>
          <span>All amounts rounded</span>
          <span>Data as of {displayDate(summary.latestCalculatedAt)}</span>
        </footer>
      </main>
    </AppShell>
  );
}
