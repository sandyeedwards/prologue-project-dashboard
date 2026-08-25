import Link from "next/link";
import type { ReactNode } from "react";
import {
  getProjectTypeFacets,
  type Coverage,
  type HealthBand,
  type ProjectReportRow,
} from "@/lib/reporting/dashboard-data";
import { hours, money } from "@/lib/reporting/format";
import { marginTone } from "@/lib/reporting/margin-status";

export function HealthBadge({ band, score }: { band: HealthBand; score: string | number | null }) {
  const parsed = score === null || score === "" ? null : Number(score);
  const label = parsed !== null && Number.isFinite(parsed) ? `${parsed.toFixed(2)}%` : "N/A";
  const healthName: Record<HealthBand, string> = {
    GREEN: "Healthy",
    AMBER: "At risk",
    RED: "Unhealthy",
    GRAY: "N/A",
  };
  return (
    <span
      className={`health-badge health-badge--${band.toLowerCase()}`}
      aria-label={`${healthName[band]} project health, ${label}`}
      title={`${healthName[band]} project health`}
    >
      {label}
    </span>
  );
}

export function MarginBadge({
  value,
  digits = 1,
}: {
  value: string | number | null | undefined;
  digits?: number;
}) {
  const tone = marginTone(value);
  const parsed = value === null || value === undefined || value === "" ? null : Number(value);
  const label = parsed !== null && Number.isFinite(parsed) ? `${parsed.toFixed(digits)}%` : "N/A";

  return (
    <span className={`margin-badge margin-badge--${tone}`} aria-label={`Margin ${label}`}>
      {label}
    </span>
  );
}

export function MarginText({
  value,
  digits = 1,
}: {
  value: string | number | null | undefined;
  digits?: number;
}) {
  const tone = marginTone(value);
  const parsed = value === null || value === undefined || value === "" ? null : Number(value);
  const label = parsed !== null && Number.isFinite(parsed) ? `${parsed.toFixed(digits)}%` : "N/A";

  return <span className={`margin-text margin-text--${tone}`}>{label}</span>;
}

export function CoverageBadge({ value }: { value: Coverage }) {
  return (
    <span className={`coverage-badge coverage-badge--${value.toLowerCase()}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  help,
  tone,
  accent,
  priority = "secondary",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  help?: ReactNode;
  tone?: string;
  accent?: "navy" | "gray" | "blue" | "amber" | "green" | "red" | "purple";
  priority?: "primary" | "secondary";
}) {
  return (
    <article
      className={`metric-card metric-card--${priority}${tone ? ` metric-card--${tone}` : ""}${accent ? ` metric-card--accent-${accent}` : ""}${help ? " metric-card--has-help" : ""}`}
    >
      <header className="metric-card__header">
        <span className="metric-card__indicator" aria-hidden="true" />
        <p className="metric-card__label">{label}</p>
      </header>
      <div className="metric-card__value">{value}</div>
      {detail ? <p className="metric-card__detail">{detail}</p> : null}
      {help ? (
        <span className="metric-card__help">
          <button
            className="metric-card__help-trigger"
            type="button"
            aria-label={`Information about ${label}`}
          >
            ?
          </button>
          <span className="metric-card__help-panel" role="tooltip">
            {help}
          </span>
        </span>
      ) : null}
    </article>
  );
}

export function ProvisionalNotice({ row }: { row: ProjectReportRow }) {
  if (!row.isProvisional) return null;
  const missing = [
    row.laborCoverage !== "COMPLETE" ? `labor ${row.laborCoverage.toLowerCase()}` : null,
    row.assignmentCoverage !== "COMPLETE"
      ? `assignments ${row.assignmentCoverage.toLowerCase()}`
      : null,
    row.taskListBudgetCoverage !== "COMPLETE" && row.taskListBudgetCoverage !== "NOT_EXPECTED"
      ? `task-list budgets ${row.taskListBudgetCoverage.toLowerCase()}`
      : null,
    row.expenseCoverage !== "COMPLETE" && row.expenseCoverage !== "NOT_EXPECTED"
      ? `expenses ${row.expenseCoverage.toLowerCase()}`
      : null,
  ].filter(Boolean);
  return (
    <div className="provisional-notice">
      <strong>Provisional financial result</strong>
      <span>
        Actual costs already returned by Teamwork are included. The forecast is labeled provisional
        because at least one input needed to price expected or remaining work is incomplete
        {missing.length ? `: ${missing.join(", ")}` : ""}. The known forecast cost is therefore a
        minimum and the displayed margin is a ceiling.
      </span>
    </div>
  );
}

function numericMoney(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function remainingCost(
  actual: string | number | null | undefined,
  forecast: string | number | null | undefined,
): number | null {
  const actualValue = numericMoney(actual);
  const forecastValue = numericMoney(forecast);
  if (actualValue === null || forecastValue === null) return null;
  return Math.max(forecastValue - actualValue, 0);
}

export function ProjectTable({
  rows,
  selectable = false,
  selectedProjectIds = [],
}: {
  rows: ProjectReportRow[];
  selectable?: boolean;
  selectedProjectIds?: string[];
}) {
  return (
    <div className="table-wrap report-table-wrap project-table-wrap">
      <table className="data-table project-table project-table--financial-first">
        <thead>
          <tr>
            {selectable ? <th aria-label="Select project">Select</th> : null}
            <th>Project</th>
            <th>Margin</th>
            <th>Actual Cost</th>
            <th>Remaining Work</th>
            <th>Forecasted Profit</th>
            <th>Hours</th>
            <th>Data Issues</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const remaining = remainingCost(row.actualTotalCost, row.forecastCost);
            const profitValue = numericMoney(row.forecastProfit);
            const profitTone = profitValue !== null && profitValue < 0 ? "loss" : "profit";
            const projectPrefix = row.projectNumber ? `${row.projectNumber} - ` : "";
            const projectName =
              projectPrefix && row.name.startsWith(projectPrefix)
                ? row.name.slice(projectPrefix.length)
                : row.name;
            return (
              <tr className="project-table__row" key={row.id}>
                {selectable ? (
                  <td>
                    <input
                      type="checkbox"
                      name="project"
                      value={row.id}
                      defaultChecked={selectedProjectIds.includes(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                ) : null}
                <td>
                  <Link className="project-link" href={`/projects/${row.id}`}>
                    <strong>
                      {row.projectNumber ? `${row.projectNumber} · ` : ""}
                      {projectName}
                    </strong>
                    <span>{row.companyName ?? "No client company"}</span>
                  </Link>
                  <div className="tag-row">
                    {getProjectTypeFacets(row).map((type) => (
                      <span className="tag" key={type}>
                        {type}
                      </span>
                    ))}
                    {row.archivedAt || row.status.toLowerCase() === "archived" ? (
                      <span className="tag">Archived</span>
                    ) : null}
                    {row.isProvisional ? (
                      <span className="tag tag--warning">Provisional</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <MarginBadge value={row.forecastMarginPercent} />
                  {row.isProvisional ? (
                    <small className="table-subvalue table-subvalue--warning">Ceiling</small>
                  ) : (
                    <small className="table-subvalue">Forecast</small>
                  )}
                </td>
                <td className="project-table__money">
                  <strong>{money(row.actualTotalCost)}</strong>
                  <small className="table-subvalue">Cost to date</small>
                </td>
                <td className="project-table__money">
                  <strong>{money(remaining)}</strong>
                  <small className="table-subvalue">Costed work</small>
                </td>
                <td className={`project-table__money project-table__money--${profitTone}`}>
                  <strong>{money(row.forecastProfit)}</strong>
                  <small className="table-subvalue">
                    {profitTone === "loss" ? "Forecast loss" : "Unspent revenue"}
                  </small>
                </td>
                <td>
                  {hours(row.loggedMinutes)}
                  <small className="table-subvalue">
                    of {hours(row.canonicalEstimatedMinutes)} est.
                  </small>
                </td>
                <td>
                  {row.dataQualityIssueCount ? (
                    <Link
                      className="issue-count issue-count--warning issue-count--link"
                      href={`/help/teamwork-issues?project=${row.id}&scope=DATA_ISSUES`}
                      aria-label={`View ${row.dataQualityIssueCount} data issues for ${row.name}`}
                    >
                      {row.dataQualityIssueCount}
                    </Link>
                  ) : (
                    <span className="issue-count">0</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length ? (
            <tr>
              <td colSpan={selectable ? 8 : 7} className="empty-state">
                No projects match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
