import type { CSSProperties } from "react";

type OutcomeRow = {
  label: string;
  detail?: string;
  values: Record<string, number | null>;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPercent(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function ProjectOutcomeSummary({
  rows,
  emptyMessage = "No project outcome data is available.",
}: {
  rows: OutcomeRow[];
  emptyMessage?: string;
}) {
  const available = rows.filter(
    (row) => finite(row.values.margin) || finite(row.values.progress),
  );

  if (!available.length) return <div className="chart-empty">{emptyMessage}</div>;

  return (
    <div
      className="project-outcome-summary"
      role="img"
      aria-label="Forecast margin and task completion by project"
    >
      <div className="project-outcome-summary__header" aria-hidden="true">
        <span>Project</span>
        <span>Forecast margin</span>
        <span>Task completion</span>
      </div>
      <div className="project-outcome-summary__rows">
        {available.map((row) => {
          const margin = finite(row.values.margin) ? row.values.margin : null;
          const progress = finite(row.values.progress) ? row.values.progress : null;
          const progressWidth = progress === null ? 0 : Math.max(0, Math.min(progress, 100));
          const style = { "--outcome-progress": `${progressWidth}%` } as CSSProperties;
          const marginTone = margin === null ? "unknown" : margin < 0 ? "loss" : "profit";

          return (
            <div className="project-outcome-summary__row" key={row.label}>
              <div className="project-outcome-summary__project">
                <strong>{row.label}</strong>
                {row.detail ? <small>{row.detail}</small> : null}
              </div>
              <div
                className={`project-outcome-summary__margin project-outcome-summary__margin--${marginTone}`}
              >
                <strong>{formatPercent(margin)}</strong>
                <small>{margin !== null && margin < 0 ? "Forecast loss" : "Margin / ceiling"}</small>
              </div>
              <div className="project-outcome-summary__completion">
                <div className="project-outcome-summary__track" style={style}>
                  <span />
                </div>
                <div>
                  <strong>{formatPercent(progress)}</strong>
                  <small>Tasks complete</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
