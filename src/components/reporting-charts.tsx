import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { ProfitabilityRow } from "@/components/profitability-chart-types";
import { MarginBadge } from "@/components/reporting-ui";
import { PrologueMark } from "@/components/prologue-brand";
import type { ProjectReportRow } from "@/lib/reporting/dashboard-data";
import {
  profitLabel,
  profitTone,
  resolveProfitabilityRow,
} from "@/lib/reporting/forecast-position";
import { hours, money, percent } from "@/lib/reporting/format";
import {
  compareNullableDescending,
  compareProjectIdentity,
  formatHoursUsed,
  hoursUsedPercent,
  marginBand,
  MISSING,
  REPORT_LABELS,
  totalProfitabilityRows,
  type MarginBand,
} from "@/lib/reporting/labels";
import { COMBINE_PROJECT_LIMIT, combinedProjectsHref } from "@/lib/reporting/project-selection";

export type ChartSeries = {
  key: string;
  label: string;
  tone?: "blue" | "navy" | "green" | "amber" | "red" | "gray" | "purple";
};

export type ChartRow = {
  label: string;
  detail?: string;
  values: Record<string, number | null>;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

function compactNumber(value: number, suffix = ""): string {
  return `${new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)}${suffix}`;
}

export function ChartPanel({
  title,
  eyebrow,
  description,
  help,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`chart-panel${className ? ` ${className}` : ""}`}>
      <header className="chart-panel__header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {help ? (
          <span className="chart-panel__help">
            <button
              className="chart-panel__help-trigger"
              type="button"
              aria-label={`Information about ${title}`}
            >
              ?
            </button>
            <span className="chart-panel__help-panel" role="tooltip">
              {help}
            </span>
          </span>
        ) : null}
      </header>
      {children}
    </article>
  );
}

export function GroupedBarChart({
  rows,
  series,
  valueKind = "number",
  suffix = "",
  emptyMessage = "No chart data is available.",
}: {
  rows: ChartRow[];
  series: ChartSeries[];
  valueKind?: "currency" | "number" | "percent";
  suffix?: string;
  emptyMessage?: string;
}) {
  const available = rows.flatMap((row) =>
    series.map((item) => row.values[item.key]).filter(finite),
  );
  const max = Math.max(...available.map((value) => Math.abs(value)), 0);
  const formatter = (value: number) => {
    if (valueKind === "currency") return compactCurrency(value);
    if (valueKind === "percent") return `${value.toFixed(1)}%`;
    return compactNumber(value, suffix);
  };

  if (!rows.length || max === 0) return <div className="chart-empty">{emptyMessage}</div>;

  return (
    <div className="bar-chart" role="img" aria-label="Grouped bar chart">
      <div className="chart-legend" aria-hidden="true">
        {series.map((item, index) => (
          <span key={item.key}>
            <i
              className={`chart-swatch chart-tone--${item.tone ?? ["blue", "navy", "green", "amber"][index % 4]}`}
            />
            {item.label}
          </span>
        ))}
      </div>
      <div className="bar-chart__rows">
        {rows.map((row) => (
          <div className="bar-chart__row" key={row.label}>
            <div className="bar-chart__label">
              <strong>{row.label}</strong>
              {row.detail ? <small>{row.detail}</small> : null}
            </div>
            <div className="bar-chart__tracks">
              {series.map((item, index) => {
                const value = row.values[item.key];
                const width =
                  finite(value) && max > 0
                    ? Math.max((Math.abs(value) / max) * 100, value === 0 ? 0 : 1.5)
                    : 0;
                const tone = item.tone ?? ["blue", "navy", "green", "amber"][index % 4];
                const style = { "--chart-width": `${width}%` } as CSSProperties;
                return (
                  <div className="bar-chart__series" key={item.key}>
                    <div className="bar-chart__track">
                      <span className={`bar-chart__fill chart-tone--${tone}`} style={style} />
                    </div>
                    <span className="bar-chart__value">
                      {finite(value) ? formatter(value) : MISSING}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarginSummaryDonut({ projects }: { projects: ProjectReportRow[] }) {
  const groupedProjects: Record<MarginBand, ProjectReportRow[]> = {
    green: [],
    provisional: [],
    yellow: [],
    red: [],
    neutral: [],
  };

  // A provisional margin is only a ceiling, so a "strong" provisional margin is never counted
  // as a confirmed strong (green) margin.
  for (const project of projects) {
    groupedProjects[marginBand(project.forecastMarginPercent, project.isProvisional)].push(project);
  }

  const segments = [
    {
      label: "Strong margin",
      detail: "50% or higher, confirmed",
      projects: groupedProjects.green,
      tone: "green",
    },
    {
      label: "Provisional",
      detail: "50% or higher ceiling, not yet confirmed",
      projects: groupedProjects.provisional,
      tone: "provisional",
    },
    {
      label: "Watch margin",
      detail: "Above 35% and below 50%",
      projects: groupedProjects.yellow,
      tone: "amber",
    },
    {
      label: "Low margin",
      detail: "35% or lower",
      projects: groupedProjects.red,
      tone: "red",
    },
    {
      label: MISSING,
      detail: "No usable forecast margin",
      projects: groupedProjects.neutral,
      tone: "gray",
    },
  ] as const;

  const total = projects.length;

  if (!total) {
    return <div className="chart-empty">No calculated projects are available.</div>;
  }

  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="donut-chart">
      <div
        className="donut-chart__graphic"
        role="img"
        aria-label={`Forecast margin distribution across ${total} projects`}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="donut-chart__base" cx="60" cy="60" r={radius} />
          {segments.map((segment) => {
            const length = (segment.projects.length / total) * circumference;
            const currentOffset = offset;
            offset += length;

            return (
              <circle
                key={segment.label}
                className={`donut-chart__segment chart-stroke--${segment.tone}`}
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>

        <div className="donut-chart__center">
          <strong>{total}</strong>
          <span>projects</span>
        </div>
      </div>

      <div className="donut-chart__legend">
        {segments.map((segment) => {
          const count = segment.projects.length;
          const href = combinedProjectsHref(segment.projects.map((project) => project.id));
          const isOverCombineLimit = count > COMBINE_PROJECT_LIMIT;

          const summary = (
            <>
              <span className="donut-chart__legend-label">
                <i className={`chart-swatch chart-tone--${segment.tone}`} />
                {segment.label}
              </span>
              <strong>{count}</strong>
              <small>
                {segment.detail}
                {isOverCombineLimit
                  ? ` · Select up to ${COMBINE_PROJECT_LIMIT} in Projects to combine`
                  : ""}
              </small>
            </>
          );

          return (
            <div className="donut-chart__legend-row" key={segment.label}>
              {href ? (
                <Link
                  className="donut-chart__legend-link"
                  href={href}
                  aria-label={`Open Combined Project Report for ${count} ${segment.label.toLowerCase()} project${count === 1 ? "" : "s"}`}
                >
                  {summary}
                </Link>
              ) : (
                <div className="donut-chart__legend-summary">{summary}</div>
              )}

              {count > 0 ? (
                <div className="donut-chart__projects" role="tooltip">
                  <strong>Projects in this margin band</strong>
                  {segment.projects.map((project) => (
                    <span key={project.id}>
                      {project.projectNumber
                        ? `${project.projectNumber} \u00b7 ${project.name}`
                        : project.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { ProfitabilityRow } from "@/components/profitability-chart-types";

export function DivergingProfitChart({ rows }: { rows: ProfitabilityRow[] }) {
  const resolvedRows = rows.map((row) => {
    const values = resolveProfitabilityRow(row);
    return { row, values, tone: profitTone(row, values) };
  });
  const knownRows = resolvedRows.filter((entry) => entry.values.known.profit);
  if (!knownRows.length)
    return <div className="chart-empty">No profit or loss positions are available.</div>;

  const maximumProfit = Math.max(...knownRows.map((entry) => Math.max(entry.values.profit, 0)), 0);
  const maximumLoss = Math.max(...knownRows.map((entry) => Math.max(-entry.values.profit, 0)), 0);

  const lossLanePercent =
    maximumLoss > 0
      ? Math.min(30, Math.max(10, (maximumLoss / Math.max(maximumLoss + maximumProfit, 1)) * 100))
      : 7;

  const profitLanePercent = 100 - lossLanePercent;

  const chartStyle = {
    "--diverging-loss-lane": `${lossLanePercent}%`,
  } as CSSProperties;

  return (
    <div
      className="diverging-profit"
      role="img"
      aria-label="Projected Profit and loss by operational group"
      style={chartStyle}
    >
      <div className="diverging-profit__axis" aria-hidden="true">
        <span>Loss</span>
        <i />
        <span>Profit</span>
      </div>
      <div className="diverging-profit__rows">
        {resolvedRows.map(({ row, values, tone }) => {
          const known = values.known.profit;
          const profit = known ? values.profit : 0;
          const width = !known
            ? 0
            : profit < 0
              ? maximumLoss > 0
                ? Math.max((Math.abs(profit) / maximumLoss) * lossLanePercent, 2)
                : 0
              : maximumProfit > 0
                ? Math.max((profit / maximumProfit) * profitLanePercent, profit === 0 ? 0 : 2)
                : 0;
          // Bars keep their side (profit/loss) and add an amber hatch when provisional.
          const barClass =
            profit < 0
              ? "diverging-profit__bar--loss"
              : `diverging-profit__bar--profit${tone === "is-provisional" ? " diverging-profit__bar--provisional" : ""}`;
          return (
            <div className="diverging-profit__row" key={row.label}>
              <div className="diverging-profit__label">
                <strong>{row.label}</strong>
                {row.detail ? <small>{row.detail}</small> : null}
              </div>
              <div className="diverging-profit__plot">
                <span className="diverging-profit__zero" aria-hidden="true" />
                {known ? (
                  <span
                    className={`diverging-profit__bar ${barClass}`}
                    style={{ "--diverging-width": `${width}%` } as CSSProperties}
                  />
                ) : null}
              </div>
              <div className={`diverging-profit__value diverging-profit__value--${tone.slice(3)}`}>
                <strong>{known ? compactCurrency(profit) : MISSING}</strong>
                <small>
                  {known && values.margin !== null
                    ? `${values.margin.toFixed(1)}% margin`
                    : known
                      ? profitLabel(row, values)
                      : `${REPORT_LABELS.projectedProfit} missing`}
                  {tone === "is-provisional" ? ` \u00b7 ${REPORT_LABELS.provisional}` : ""}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OperationalBreakdown({ rows }: { rows: ProfitabilityRow[] }) {
  // Totals cover only rows with a known fee, forecast cost and profit, so every total describes
  // the same groups; incomplete rows are counted and noted rather than added as zero.
  const totals = totalProfitabilityRows(rows);
  const totalValue = (value: number | null) => (value === null ? MISSING : compactCurrency(value));

  return (
    <div className="operational-breakdown">
      <div className="operational-breakdown__metrics">
        <div>
          <span>{REPORT_LABELS.fee}</span>
          <strong>{totalValue(totals.revenue)}</strong>
        </div>
        <div>
          <span>{REPORT_LABELS.forecastCost}</span>
          <strong>{totalValue(totals.cost)}</strong>
        </div>
        <div>
          <span>
            {totals.profit !== null && totals.profit < 0
              ? REPORT_LABELS.projectedLoss
              : REPORT_LABELS.projectedProfit}
          </span>
          <strong className={`operational-breakdown__total--${totals.tone.slice(3)}`}>
            {totalValue(totals.profit)}
          </strong>
        </div>
        <div>
          <span>{REPORT_LABELS.forecastMargin}</span>
          <strong>{totals.margin === null ? MISSING : `${totals.margin.toFixed(1)}%`}</strong>
        </div>
      </div>
      {totals.excludedCount ? (
        <p className="operational-breakdown__partial-note">
          {totals.includedCount
            ? `Totals cover ${totals.includedCount} of ${rows.length} groups; ${totals.excludedCount} with a missing fee, cost or profit ${totals.excludedCount === 1 ? "is" : "are"} excluded, not counted as $0.`
            : "No group has a known fee, forecast cost and profit, so totals are missing."}
        </p>
      ) : null}
      <div className="table-wrap operational-breakdown__table-wrap">
        <table className="data-table operational-breakdown__table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Projects</th>
              <th>{REPORT_LABELS.fee}</th>
              <th>{REPORT_LABELS.forecastCost}</th>
              <th>{REPORT_LABELS.projectedProfit}</th>
              <th>{REPORT_LABELS.forecastMargin}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = resolveProfitabilityRow(row);
              const tone = profitTone(row, values);
              return (
                <tr key={row.label}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{row.projectCount ?? "\u2014"}</td>
                  <td>{finite(row.revenue) ? compactCurrency(row.revenue) : MISSING}</td>
                  <td>{finite(row.cost) ? compactCurrency(row.cost) : MISSING}</td>
                  <td className={`operational-breakdown__${tone.slice(3)}`}>
                    {values.known.profit ? compactCurrency(values.profit) : MISSING}
                  </td>
                  <td>{values.margin !== null ? `${values.margin.toFixed(1)}%` : MISSING}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function numericProjectValue(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function AnalysisTakeaway({ rows }: { rows: ProfitabilityRow[] }) {
  const profitable = rows
    .filter((row) => finite(row.profit) && (row.profit ?? 0) > 0)
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const losses = rows
    .filter((row) => finite(row.profit) && (row.profit ?? 0) < 0)
    .sort((a, b) => (a.profit ?? 0) - (b.profit ?? 0));
  const leaders = profitable.slice(0, 2);
  const largestLoss = losses[0];

  return (
    <aside className="analysis-takeaway">
      <span className="analysis-takeaway__icon" aria-hidden="true">
        <PrologueMark height={28} className="analysis-takeaway__mark" />
      </span>
      <div>
        <strong>Key takeaway</strong>
        {leaders.length ? (
          <p>
            {leaders.map((row) => row.label).join(" and ")} {leaders.length === 1 ? "is" : "are"}{" "}
            the strongest profit contributor{leaders.length === 1 ? "" : "s"}, generating{" "}
            {compactCurrency(leaders.reduce((sum, row) => sum + (row.profit ?? 0), 0))} combined.
          </p>
        ) : (
          <p>No operational group currently reports positive projected profit.</p>
        )}
        {largestLoss ? (
          <p>
            {largestLoss.label} is the largest loss position at{" "}
            {compactCurrency(largestLoss.profit ?? 0)}.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function ProjectPerformanceDetails({ projects }: { projects: ProjectReportRow[] }) {
  // Highest profit first; missing profit last; ties broken by project number for a stable order.
  const sorted = [...projects].sort(
    (a, b) =>
      compareNullableDescending(
        numericProjectValue(a.forecastProfit),
        numericProjectValue(b.forecastProfit),
      ) || compareProjectIdentity(a, b),
  );

  return (
    <div className="table-wrap project-performance-table-wrap">
      <table className="data-table project-performance-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client</th>
            <th>{REPORT_LABELS.forecastMargin}</th>
            <th>{REPORT_LABELS.projectedProfit}</th>
            <th>Logged hours</th>
            <th>{REPORT_LABELS.hoursUsed}</th>
            <th>Task completion</th>
            <th>Data Issues</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((project) => {
            const effortPercent = hoursUsedPercent(
              project.loggedMinutes,
              project.canonicalEstimatedMinutes,
            );
            const profitValue = numericProjectValue(project.forecastProfit);
            const tone =
              profitValue === null
                ? "missing"
                : profitValue < 0
                  ? "loss"
                  : project.isProvisional
                    ? "provisional"
                    : "profit";
            return (
              <tr key={project.id}>
                <td>
                  <Link className="project-link" href={`/projects/${project.id}`}>
                    <strong>
                      {project.projectNumber ? `${project.projectNumber} \u00b7 ` : ""}
                      {project.name.replace(`${project.projectNumber} - `, "")}
                    </strong>
                  </Link>
                </td>
                <td>{project.companyName ?? "\u2014"}</td>
                <td>
                  <MarginBadge
                    value={project.forecastMarginPercent}
                    provisional={project.isProvisional}
                  />
                  {project.isProvisional ? (
                    <small className="table-subvalue table-subvalue--warning">Ceiling</small>
                  ) : (
                    <small className="table-subvalue">Forecast</small>
                  )}
                </td>
                <td className={`operational-breakdown__${tone}`}>
                  {money(project.forecastProfit)}
                </td>

                <td>{hours(project.loggedMinutes)}</td>
                <td>{formatHoursUsed(effortPercent)}</td>
                <td>{percent(project.progressPercent)}</td>
                <td>
                  {project.dataQualityIssueCount ? (
                    <Link
                      className="issue-count issue-count--warning issue-count--link"
                      href={`/teamwork-issues?project=${project.id}&scope=DATA_ISSUES`}
                      aria-label={`View ${project.dataQualityIssueCount} data issues for ${project.name}`}
                    >
                      {project.dataQualityIssueCount}
                    </Link>
                  ) : (
                    <span className="issue-count">0</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!sorted.length ? (
            <tr>
              <td className="empty-state" colSpan={8}>
                No projects are available in this report.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioAnalysisDisclosure({
  rows,
  projects = [],
  showProjectAttention = true,
}: {
  rows: ProfitabilityRow[];
  projects?: ProjectReportRow[];
  showProjectAttention?: boolean;
}) {
  return (
    <section className="additional-data-views" aria-labelledby="additional-data-title">
      <div className="additional-data-views__heading">
        <div>
          <p className="eyebrow">Decision support</p>
          <h3 id="additional-data-title">Company Insights & Attention</h3>
        </div>
        <span>
          Open a focused view to investigate profit drivers, risk, and project-level performance.
        </span>
      </div>

      <details className="analysis-disclosure analysis-disclosure--single" open>
        <summary>
          <span>
            <strong>Profit Drivers & Loss Exposure</strong>
            <small>
              See which operational groups are creating value and which require attention.
            </small>
          </span>
          <i aria-hidden="true" />
        </summary>
        <div className="analysis-disclosure__content analysis-disclosure__content--takeaway">
          <section className="analysis-card analysis-card--chart">
            <DivergingProfitChart rows={rows} />
          </section>
          <AnalysisTakeaway rows={rows} />
        </div>
      </details>

      <details className="analysis-disclosure analysis-disclosure--single">
        <summary>
          <span>
            <strong>Operational Group Summary</strong>
            <small>
              Review fee, forecast cost, projected profit, forecast margin, and project count.
            </small>
          </span>
          <i aria-hidden="true" />
        </summary>
        <div className="analysis-disclosure__content analysis-disclosure__content--single">
          <section className="analysis-card">
            <OperationalBreakdown rows={rows} />
          </section>
        </div>
      </details>

      {showProjectAttention ? (
        <details className="analysis-disclosure analysis-disclosure--single">
          <summary>
            <span>
              <strong>Project Attention Register</strong>
              <small>
                Review project-level profitability, effort consumption, health, and data quality.
              </small>
            </span>
            <i aria-hidden="true" />
          </summary>
          <div className="analysis-disclosure__content analysis-disclosure__content--single">
            <section className="analysis-card analysis-card--table">
              <ProjectPerformanceDetails projects={projects} />
            </section>
          </div>
        </details>
      ) : null}
    </section>
  );
}

export function CostPerformanceChart({
  rows,
  emptyMessage = "No operational group cost data is available.",
}: {
  rows: Array<{
    label: string;
    target: number | null;
    targetCoverage: "COMPLETE" | "PARTIAL" | "MISSING" | "NOT_EXPECTED";
    actual: number | null;
    forecast: number | null;
    progressPercent: number | null;
  }>;
  emptyMessage?: string;
}) {
  if (!rows.length) return <div className="chart-empty">{emptyMessage}</div>;

  const hasCompleteTarget = rows.some(
    (row) => row.targetCoverage === "COMPLETE" && finite(row.target) && row.target > 0,
  );

  return (
    <div
      className="cost-performance-chart"
      role="group"
      aria-label="Operational group current costs, estimated remaining costs, forecast cost, and planned cost target"
    >
      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="chart-swatch chart-tone--navy" />
          {REPORT_LABELS.currentCosts}
        </span>
        <span>
          <i className="chart-swatch chart-tone--amber" />
          {REPORT_LABELS.estimatedRemainingCosts}
        </span>
        {hasCompleteTarget ? (
          <>
            <span>
              <i className="chart-swatch cost-performance__headroom-key" />
              Target headroom
            </span>
            <span>
              <i className="chart-swatch cost-performance__overrun-key" />
              Above target
            </span>
            <span>
              <i className="cost-performance__target-key" />
              Planned target
            </span>
          </>
        ) : null}
      </div>

      <div className="cost-performance__rows">
        {rows.map((row) => {
          const actualKnown = finite(row.actual);
          const forecastKnown = finite(row.forecast);

          const actual = actualKnown ? Math.max(row.actual ?? 0, 0) : 0;
          const forecast = forecastKnown ? Math.max(row.forecast ?? actual, actual) : actual;
          const remainingKnown = actualKnown && forecastKnown;
          const remaining = remainingKnown ? Math.max(forecast - actual, 0) : 0;

          const knownTarget = finite(row.target) && row.target > 0 ? row.target : null;
          const targetComparable = row.targetCoverage === "COMPLETE" && knownTarget !== null;
          const partialTarget = row.targetCoverage === "PARTIAL" && knownTarget !== null;
          const displayedTarget = targetComparable || partialTarget ? knownTarget : null;
          const isComplete = finite(row.progressPercent) && row.progressPercent >= 100;

          const scale =
            targetComparable && knownTarget !== null
              ? Math.max(knownTarget * 1.12, forecast * 1.03, actual * 1.03, 1)
              : Math.max(forecast, actual, 1);

          const actualWithinTarget =
            targetComparable && knownTarget !== null ? Math.min(actual, knownTarget) : actual;

          const forecastWithinTarget =
            targetComparable && knownTarget !== null ? Math.min(forecast, knownTarget) : forecast;

          const remainingWithinTarget = Math.max(forecastWithinTarget - actualWithinTarget, 0);

          const actualWidth = (actualWithinTarget / scale) * 100;
          const remainingLeft = (actualWithinTarget / scale) * 100;
          const remainingWidth = (remainingWithinTarget / scale) * 100;

          const targetPosition =
            targetComparable && knownTarget !== null ? (knownTarget / scale) * 100 : null;

          const headroom =
            targetComparable && knownTarget !== null ? Math.max(knownTarget - forecast, 0) : 0;
          const headroomLeft = (forecast / scale) * 100;
          const headroomWidth = (headroom / scale) * 100;

          const overrun =
            targetComparable && knownTarget !== null ? Math.max(forecast - knownTarget, 0) : 0;
          const overrunLeft =
            targetComparable && knownTarget !== null ? (knownTarget / scale) * 100 : 0;
          const overrunWidth = (overrun / scale) * 100;

          const variance =
            targetComparable && knownTarget !== null && forecastKnown
              ? knownTarget - forecast
              : null;

          let status = "No planned target";
          let statusTone: "neutral" | "favorable" | "unfavorable" = "neutral";

          if (row.targetCoverage === "PARTIAL") {
            status = "Planned target incomplete";
          }

          if (targetComparable && knownTarget !== null) {
            if (!forecastKnown) {
              status = "Forecast cost missing";
            }

            if (!isComplete && actualKnown && actual > knownTarget) {
              status = "Already " + compactCurrency(actual - knownTarget) + " over target";
              statusTone = "unfavorable";
            } else if (forecastKnown && variance !== null && variance > 0.005) {
              status = isComplete
                ? "Came in " + compactCurrency(variance) + " under target"
                : "Forecast " + compactCurrency(variance) + " under target";
              statusTone = "favorable";
            } else if (forecastKnown && variance !== null && variance < -0.005) {
              status = isComplete
                ? "Came in " + compactCurrency(Math.abs(variance)) + " over target"
                : "Forecast " + compactCurrency(Math.abs(variance)) + " over target";
              statusTone = "unfavorable";
            } else if (forecastKnown && variance !== null) {
              status = isComplete ? "Came in on target" : "Forecast on target";
              statusTone = "favorable";
            }
          }

          return (
            <div className="cost-performance__row" key={row.label}>
              <div className="cost-performance__heading">
                <strong>{row.label}</strong>
                <span
                  className={"cost-performance__status cost-performance__status--" + statusTone}
                >
                  {status}
                </span>
              </div>

              <div className="cost-performance__track" aria-hidden="true">
                {headroom > 0 ? (
                  <span
                    className="cost-performance__headroom"
                    style={
                      {
                        "--cost-left": String(headroomLeft) + "%",
                        "--cost-width": String(headroomWidth) + "%",
                      } as CSSProperties
                    }
                  />
                ) : null}

                <span
                  className="cost-performance__actual"
                  style={
                    {
                      "--cost-width": String(actualWidth) + "%",
                    } as CSSProperties
                  }
                />

                {remainingWidth > 0 ? (
                  <span
                    className="cost-performance__remaining"
                    style={
                      {
                        "--cost-left": String(remainingLeft) + "%",
                        "--cost-width": String(remainingWidth) + "%",
                      } as CSSProperties
                    }
                  />
                ) : null}

                {overrun > 0 ? (
                  <span
                    className="cost-performance__overrun"
                    style={
                      {
                        "--cost-left": String(overrunLeft) + "%",
                        "--cost-width": String(overrunWidth) + "%",
                      } as CSSProperties
                    }
                  />
                ) : null}

                {targetPosition !== null ? (
                  <span
                    className="cost-performance__target"
                    style={
                      {
                        "--target-position": String(targetPosition) + "%",
                      } as CSSProperties
                    }
                  />
                ) : null}
              </div>

              <div className="cost-performance__values">
                <span>
                  {REPORT_LABELS.currentCosts}
                  <strong>{actualKnown ? compactCurrency(actual) : MISSING}</strong>
                </span>

                <span>
                  {REPORT_LABELS.estimatedRemainingCosts}
                  <strong>{remainingKnown ? compactCurrency(remaining) : MISSING}</strong>
                </span>

                <span>
                  {REPORT_LABELS.forecastCost}
                  <strong>{forecastKnown ? compactCurrency(forecast) : MISSING}</strong>
                </span>

                <span>
                  {partialTarget ? "Known target" : "Target"}
                  <strong>
                    {displayedTarget !== null
                      ? compactCurrency(displayedTarget)
                      : row.targetCoverage === "NOT_EXPECTED"
                        ? "None"
                        : MISSING}
                  </strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
