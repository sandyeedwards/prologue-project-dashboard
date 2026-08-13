import Link from "next/link";
import {
  ChartPanel,
  MarginSummaryDonut,
  PortfolioAnalysisDisclosure,
} from "@/components/reporting-charts";
import { DashboardProfitabilityTabs } from "@/components/dashboard-profitability-tabs";
import type { HistoricalProfitSeries } from "@/components/historical-profit-chart-types";
import { HoursCompletionSummary } from "@/components/hours-completion-summary";
import { ProjectOutcomeSummary } from "@/components/project-outcome-summary";
import {
  CompareOperationalProfitabilityChart,
  type ComparedProjectOperationalGroups,
} from "@/components/compare-operational-profitability-chart";
import { CoverageBadge, MarginBadge, MetricCard } from "@/components/reporting-ui";
import {
  summarizeProjects,
  type PortfolioOperationalGroupRow,
  type ProjectReportRow,
} from "@/lib/reporting/dashboard-data";
import { hours, money } from "@/lib/reporting/format";

function numeric(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function remainingCost(actualCost: number | null, forecastCost: number | null): number | null {
  if (actualCost === null || forecastCost === null) return null;
  return Math.max(forecastCost - actualCost, 0);
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
  return `Cost coverage: ${completeCount} complete · ${partialCount} partial/missing`;
}

function displayDate(value: Date | null): string {
  if (!value) return "Not calculated";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export function ProjectComparisonReport({
  projects,
  projectGroups,
}: {
  projects: ProjectReportRow[];
  projectGroups: Array<{ projectId: string; groups: PortfolioOperationalGroupRow[] }>;
}) {
  const chartRows = projects.map((project) => {
    const actualCost = numeric(project.actualTotalCost);
    const forecastCost = numeric(project.forecastCost);
    return {
      label: project.projectNumber ?? project.name,
      detail: project.projectNumber
        ? project.name.replace(`${project.projectNumber} - `, "")
        : undefined,
      revenue: numeric(project.clientFee),
      cost: forecastCost,
      actualCost,
      remainingCost: remainingCost(actualCost, forecastCost),
      profit: numeric(project.forecastProfit),
      margin: numeric(project.forecastMarginPercent),
      projectCount: 1,
      values: {
        estimated: project.canonicalEstimatedMinutes / 60,
        logged: project.loggedMinutes / 60,
        margin: numeric(project.forecastMarginPercent),
        progress: numeric(project.progressPercent),
      },
    };
  });
  const groupsByProjectId = new Map(projectGroups.map((entry) => [entry.projectId, entry.groups]));
  const operationalProfitabilityProjects: ComparedProjectOperationalGroups[] = projects.map(
    (project) => {
      const actualCost = numeric(project.actualTotalCost);
      const forecastCost = numeric(project.forecastCost);
      return {
        projectId: project.id,
        projectName: project.name,
        projectNumber: project.projectNumber,
        isProvisional: project.isProvisional,
        total: {
          allocatedRevenue: numeric(project.clientFee),
          actualCostToDate: actualCost,
          remainingCost: remainingCost(actualCost, forecastCost),
          forecastCost,
          forecastProfit: numeric(project.forecastProfit),
          marginPercent: numeric(project.forecastMarginPercent),
        },
        groups: groupsByProjectId.get(project.id) ?? [],
      };
    },
  );
  const effortRows = chartRows.map((row) => ({
    label: row.label,
    detail: row.detail,
    values: {
      estimated: row.values.estimated,
      logged: row.values.logged,
    },
  }));

  return (
    <section
      className="selection-report selection-report--compare"
      aria-label="Compared Project Report"
    >
      <section className="chart-grid chart-grid--compare" aria-label="Project comparison graphs">
        <ChartPanel
          className="compare-profitability-panel compare-operational-profitability-panel"
          eyebrow="Financial comparison"
          title="Project Profitability Comparison"
          description="Start with the profitability of each project as a whole, then switch to a row-by-row operational-group comparison."
        >
          <CompareOperationalProfitabilityChart projects={operationalProfitabilityProjects} />
        </ChartPanel>
        <ChartPanel
          className="compare-hours-panel"
          eyebrow="Effort comparison"
          title="Logged vs Estimated Hours by Project"
          description="Estimate length shows relative workload across projects. Blue shows logged hours within the estimate; red shows work beyond the estimate."
        >
          <HoursCompletionSummary rows={effortRows} />
        </ChartPanel>
        <ChartPanel
          eyebrow="Outcome comparison"
          title="Margin and Task Completion by Project"
          description="Compare the expected financial outcome with task completion. Margin remains a ceiling when source coverage is incomplete."
        >
          <ProjectOutcomeSummary rows={chartRows} />
        </ChartPanel>
      </section>
      <section className="compare-register" aria-labelledby="compare-register-title">
        <header className="compare-register__header">
          <div>
            <p className="eyebrow">Project register</p>
            <h3 id="compare-register-title">Financial detail behind the comparison</h3>
          </div>
          <span>
            {projects.length} selected project{projects.length === 1 ? "" : "s"}
          </span>
        </header>
        <div className="compare-register__scroll">
          <div className="compare-register__head" aria-hidden="true">
            <span>Project</span>
            <span>Margin</span>
            <span>Actual Cost</span>
            <span>Remaining Work</span>
            <span>Forecast Profit</span>
            <span>Coverage</span>
          </div>
          <div className="compare-register__rows">
            {projects.map((project) => {
              const profit = numeric(project.forecastProfit);
              const remaining = remainingCost(
                numeric(project.actualTotalCost),
                numeric(project.forecastCost),
              );
              return (
                <article
                  className={`compare-register__row${profit !== null && profit < 0 ? " compare-register__row--loss" : ""}`}
                  key={project.id}
                >
                  <div className="compare-register__project">
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                    <span>
                      {project.companyName ?? "No client company"}
                      {project.isProvisional ? " · Provisional" : ""}
                    </span>
                  </div>
                  <div className="compare-register__margin">
                    <MarginBadge value={project.forecastMarginPercent} />
                    <small>{project.isProvisional ? "Ceiling" : "Forecast"}</small>
                  </div>
                  <div className="compare-register__money">
                    <strong>{money(project.actualTotalCost)}</strong>
                    <small>Cost to date</small>
                  </div>
                  <div className="compare-register__money">
                    <strong>{money(remaining)}</strong>
                    <small>Costed work</small>
                  </div>
                  <div
                    className={`compare-register__money ${profit !== null && profit < 0 ? "is-loss" : "is-profit"}`}
                  >
                    <strong>{money(project.forecastProfit)}</strong>
                    <small>
                      {profit !== null && profit < 0 ? "Forecast loss" : "Unspent revenue"}
                    </small>
                  </div>

                  <div className="compare-register__coverage" aria-label="Source coverage">
                    <CoverageBadge value={project.laborCoverage} />
                    <CoverageBadge value={project.assignmentCoverage} />
                    <CoverageBadge value={project.expenseCoverage} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
}

export function CombinedPortfolioReport({
  projects,
  groups,
  historicalSeries,
  historicalInitialRange,
}: {
  projects: ProjectReportRow[];
  groups: PortfolioOperationalGroupRow[];
  historicalSeries: HistoricalProfitSeries[];
  historicalInitialRange?: { from?: string; to?: string };
}) {
  const summary = summarizeProjects(projects);
  const combinedMargin =
    summary.totalClientFee !== null &&
    summary.totalClientFee !== 0 &&
    summary.totalForecastProfit !== null
      ? (summary.totalForecastProfit / summary.totalClientFee) * 100
      : null;
  const profitabilityRows = groups.map((group) => ({
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
  const totalRevenue = profitabilityRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
  const totalForecastCost = profitabilityRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const totalRemainingCost = profitabilityRows.reduce((sum, row) => {
    if (row.remainingCost !== null && row.remainingCost !== undefined)
      return sum + row.remainingCost;
    return sum + (remainingCost(row.actualCost ?? null, row.cost ?? null) ?? 0);
  }, 0);
  const totalForecastProfit = totalRevenue - totalForecastCost;
  const actualCostCompositionComplete = profitabilityRows.every(
    (row) => row.actualCost !== null && row.actualCost !== undefined,
  );
  const remainingCostCompositionComplete = profitabilityRows.every(
    (row) => row.remainingCost !== null && row.remainingCost !== undefined,
  );
  const totalProfitabilityRow = profitabilityRows.length
    ? {
        label: "All selected groups",
        detail: `${summary.projectCount} project${summary.projectCount === 1 ? "" : "s"} · ${profitabilityRows.length} operational group${profitabilityRows.length === 1 ? "" : "s"}`,
        revenue: totalRevenue,
        cost: totalForecastCost,
        actualCost: actualCostCompositionComplete
          ? profitabilityRows.reduce((sum, row) => sum + (row.actualCost ?? 0), 0)
          : null,
        remainingCost: remainingCostCompositionComplete
          ? profitabilityRows.reduce((sum, row) => sum + (row.remainingCost ?? 0), 0)
          : null,
        profit: totalForecastProfit,
        margin: totalRevenue > 0 ? (totalForecastProfit / totalRevenue) * 100 : null,
        projectCount: summary.projectCount,
      }
    : null;
  const effortRows = groups.map((group) => ({
    label: group.groupName,
    detail: `${group.projectCount} project${group.projectCount === 1 ? "" : "s"}`,
    values: {
      estimated: group.estimatedMinutes / 60,
      logged: group.loggedMinutes / 60,
    },
  }));

  return (
    <section
      className="selection-report selection-report--combine executive-combined-report"
      aria-label="Combined Project Report"
    >
      <section className="executive-kpis combined-metrics" aria-label="Combined financial summary">
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
            help="Historical labor plus active Teamwork expenses across the selected projects. Known subtotals remain included when source cost coverage is partial; missing records are not treated as zero."
          />
          <MetricCard
            priority="primary"
            label="Costed Remaining Work"
            value={money(totalRemainingCost)}
            detail={knownFor(summary.forecastCostKnownCount, summary.projectCount)}
            help={`Estimated remaining internal and outsourced cost from today to completion. This excludes actual cost already incurred and matches the costed remaining work shown in the profitability chart. ${summary.provisionalCount} selected project${summary.provisionalCount === 1 ? " is" : "s are"} provisional, so missing inputs can make this a known minimum.`}
          />
          <MetricCard
            priority="primary"
            label="Unspent Revenue / Forecasted Profit"
            value={money(summary.totalForecastProfit)}
            detail={knownFor(summary.forecastProfitKnownCount, summary.projectCount)}
            help="Combined client fees less actual cost to date and remaining cost to complete. It is recalculated from the totals rather than averaging project profit values."
          />
        </div>
        <div className="executive-kpis__secondary">
          <MetricCard
            label="Allocated Revenue"
            value={money(summary.totalClientFee)}
            detail={knownFor(summary.clientFeeKnownCount, summary.projectCount)}
            help="Sum of known fixed-fee budgets for all selected projects. Missing fees are not treated as $0."
          />
          <MetricCard
            label={summary.provisionalCount ? "Margin Ceiling" : "Forecast Margin"}
            value={<MarginBadge value={combinedMargin} />}
            detail={knownFor(summary.forecastMarginKnownCount, summary.projectCount)}
            help="Combined forecast profit divided by combined client fees. This is not an average of the selected project margins."
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
        aria-label="Combined portfolio profitability, margin, and effort"
      >
        <DashboardProfitabilityTabs
          groupRows={profitabilityRows}
          totalRow={totalProfitabilityRow}
          historicalSeries={historicalSeries}
          historicalInitialRange={historicalInitialRange}
          groupDescription="Compare allocated revenue, actual cost to date, costed remaining work, and forecast profit or loss across the selected projects' operational groups."
          totalDescription="View the combined profitability of all selected projects using the same revenue, cost-to-date, remaining-cost, and profit structure."
          historicalDescription="Track gross revenue, source-dated actual cost, anticipated cost, net profit to date, and forecasted net profit over time across the selected projects. The calendar controls adjust only the visible historical range."
        />
        <div className="executive-support-row">
          <ChartPanel
            className="executive-report-grid__health executive-support-row__health"
            eyebrow="Portfolio margin"
            title="Margin Summary"
              description="Project counts use the same forecast-margin thresholds applied throughout reporting."
          >
            <MarginSummaryDonut
                margins={projects.map((project) => project.forecastMarginPercent)}
              />
          </ChartPanel>
          <ChartPanel
            className="executive-report-grid__effort executive-support-row__effort"
            eyebrow="Effort exposure"
            title="Logged vs Estimated Hours by Group"
            description="Estimate length shows relative workload across groups. Blue shows logged hours within the estimate; red shows work beyond the estimate."
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
    </section>
  );
}
