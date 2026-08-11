import { AppShell } from "@/components/app-shell";
import {
  ChartPanel,
  HealthDonut,
  PortfolioAnalysisDisclosure,
} from "@/components/reporting-charts";
import { DashboardProfitabilityTabs } from "@/components/dashboard-profitability-tabs";
import { DashboardPortfolioFilters } from "@/components/dashboard-portfolio-filters";
import { HoursCompletionSummary } from "@/components/hours-completion-summary";
import { MetricCard } from "@/components/reporting-ui";
import { requireUser } from "@/lib/auth/session";
import {
  filterAndSortProjects,
  getAvailableProjectTypes,
  getPortfolioHistoricalProfitSeries,
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

function knownFor(knownCount: number, projectCount: number): string {
  return `Known for ${knownCount} of ${projectCount} project${projectCount === 1 ? "" : "s"}`;
}

function actualCostCoverageDetail(
  completeCount: number,
  partialCount: number,
  projectCount: number,
): string {
  if (!partialCount) {
    return `Complete cost coverage for ${completeCount} of ${projectCount} project${projectCount === 1 ? "" : "s"}`;
  }
  return `Cost coverage: ${completeCount} complete Ã‚Â· ${partialCount} partial/missing`;
}

function displayDate(value: Date | null): string {
  if (!value) return "Not calculated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/dashboard");
  const params = await searchParams;
  const allProjects = await getProjectRows();
  const filter: ProjectFilter = {
    client: one(params.client),
    health: one(params.health),
    status: one(params.status),
    type: one(params.type),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
  };
  const projects = filterAndSortProjects(allProjects, filter);
  const summary = summarizeProjects(projects);
  const [operationalGroups, historicalProfitSeries] = await Promise.all([
    getPortfolioOperationalGroups(projects),
    getPortfolioHistoricalProfitSeries(projects),
  ]);
  const statuses = [...new Set(allProjects.map((row) => row.status).filter(Boolean))].sort();
  const clients = [
    ...new Set(
      allProjects.map((row) => row.companyName).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const types = getAvailableProjectTypes(allProjects);
  const visibleOperationalGroups = operationalGroups.filter(
    (group) => group.groupName !== "Unclassified",
  );
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
  const profitabilityRows = reconciliationRows.filter((row) => row.label !== "Unclassified");
  const totalRevenue = reconciliationRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
  const totalForecastCost = reconciliationRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const totalRemainingCost = reconciliationRows.reduce((sum, row) => {
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
  }, 0);
  const totalForecastProfit = totalRevenue - totalForecastCost;
  const actualCostCompositionComplete = reconciliationRows.every(
    (row) => row.actualCost !== null && row.actualCost !== undefined,
  );
  const remainingCostCompositionComplete = reconciliationRows.every(
    (row) => row.remainingCost !== null && row.remainingCost !== undefined,
  );
  const totalProfitabilityRow = reconciliationRows.length
    ? {
        label: "All groups combined",
        detail: `${summary.projectCount} project${summary.projectCount === 1 ? "" : "s"} Ã‚Â· ${profitabilityRows.length} operational group${profitabilityRows.length === 1 ? "" : "s"}`,
        revenue: totalRevenue,
        cost: totalForecastCost,
        actualCost: actualCostCompositionComplete
          ? reconciliationRows.reduce((sum, row) => sum + (row.actualCost ?? 0), 0)
          : null,
        remainingCost: remainingCostCompositionComplete
          ? reconciliationRows.reduce((sum, row) => sum + (row.remainingCost ?? 0), 0)
          : null,
        profit: totalForecastProfit,
        margin: totalRevenue > 0 ? (totalForecastProfit / totalRevenue) * 100 : null,
        projectCount: summary.projectCount,
      }
    : null;
  const effortRows = visibleOperationalGroups.map((group) => ({
    label: group.groupName,
    detail: `${group.projectCount} project${group.projectCount === 1 ? "" : "s"}`,
    values: {
      estimated: group.estimatedMinutes / 60,
      logged: group.loggedMinutes / 60,
    },
  }));

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide executive-dashboard">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Executive portfolio intelligence</p>
            <h1>Project Financial Performance</h1>
            <p>
              Understand cost exposure, remaining work, and forecasted profit across the active
              reporting portfolio.
            </p>
            <div className="report-titlebar__status" aria-label="Portfolio health summary">
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
          </div>
        </section>

        <section className="executive-kpis" aria-label="Portfolio financial summary">
          <div className="executive-kpis__primary">
            <MetricCard
              priority="primary"
              label="Actual Cost to Date"
              value={money(summary.totalActualCost)}
              detail={actualCostCoverageDetail(
                summary.actualCostKnownCount,
                summary.actualCostPartialCount,
                summary.projectCount,
              )}
              help="Historical Teamwork labor cost plus active imported project expenses through the latest synchronization. The total includes known subtotals for projects with partial source coverage; missing cost records are never treated as zero."
            />
            <MetricCard
              priority="primary"
              label="Costed Remaining Work"
              value={money(totalRemainingCost)}
              detail={knownFor(summary.forecastCostKnownCount, summary.projectCount)}
              help={`Estimated remaining internal and outsourced cost from today to completion. This excludes actual cost already incurred and mirrors the costed remaining work shown in the profitability chart. ${summary.provisionalCount} project${summary.provisionalCount === 1 ? " is" : "s are"} provisional, so missing rates, assignments, or expenses can make this a known minimum.`}
              tone={summary.provisionalCount ? "warning" : "success"}
            />
            <MetricCard
              priority="primary"
              label="Forecasted Profit"
              value={money(summary.totalForecastProfit)}
              detail={knownFor(summary.forecastProfitKnownCount, summary.projectCount)}
              help="Known client fees less known forecast cost. Provisional projects can cause this value to change when unresolved costs are priced."
            />
          </div>
          <div className="executive-kpis__secondary">
            <MetricCard
              label="Allocated Revenue"
              value={money(summary.totalClientFee)}
              detail={knownFor(summary.clientFeeKnownCount, summary.projectCount)}
              help="Sum of fixed-fee project budgets returned by Teamwork. Missing fees remain missing and are not treated as $0."
            />
            <MetricCard
              label="Projects in View"
              value={summary.projectCount}
              detail={`${summary.greenCount} healthy Ã‚Â· ${summary.amberCount} at risk Ã‚Â· ${summary.redCount} unhealthy`}
            />
            <MetricCard
              label="Logged Hours"
              value={hours(summary.totalLoggedMinutes)}
              detail={`${hours(summary.totalLoggedMinutes)} of ${hours(summary.totalEstimatedMinutes)} estimated`}
            />
          </div>
        </section>

        <section
          className="executive-report-stack"
          aria-label="Portfolio profitability, health, and effort"
        >
          <DashboardProfitabilityTabs
            groupRows={profitabilityRows}
            groupDescription="Compare allocated revenue, actual cost, remaining work, and forecast outcome across classified operational groups. Unclassified reconciliation remains included in combined portfolio totals but is not presented as an operational group."
            totalRow={totalProfitabilityRow}
            historicalSeries={historicalProfitSeries}
            historicalInitialRange={{ from: filter.dateFrom, to: filter.dateTo }}
            filterControls={
              <DashboardPortfolioFilters
                action="/dashboard"
                filter={filter}
                clients={clients}
                statuses={statuses}
                types={types}
                resetHref="/dashboard"
              />
            }
          />

          <div className="executive-support-row">
            <ChartPanel
              className="executive-report-grid__health executive-support-row__health"
              eyebrow="Portfolio condition"
              title="Health Summary"
            >
              <HealthDonut
                green={summary.greenCount}
                amber={summary.amberCount}
                red={summary.redCount}
                gray={summary.grayCount}
              />
            </ChartPanel>
            <ChartPanel
              className="executive-report-grid__effort executive-support-row__effort"
              eyebrow="Effort exposure"
              title="Logged vs Estimated Hours by Group"
              description="Each row shows logged hours as a percent of the estimate. Values above 100% indicate the group has exceeded its estimate."
            >
              <HoursCompletionSummary rows={effortRows} />
            </ChartPanel>
          </div>
        </section>

        <PortfolioAnalysisDisclosure rows={profitabilityRows} projects={projects} />

        <footer className="report-footer">
          <span>Currency: USD</span>
          <span>All amounts rounded</span>
          <span>Data as of {displayDate(summary.latestCalculatedAt)}</span>
        </footer>
      </main>
    </AppShell>
  );
}
