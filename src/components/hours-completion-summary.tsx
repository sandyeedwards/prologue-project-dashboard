import type { CSSProperties } from "react";

type HoursSummaryRow = {
  label: string;
  detail?: string;
  values: Record<string, number | null>;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatHours(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} h`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function HoursCompletionSummary({
  rows,
  emptyMessage = "No effort data is available.",
}: {
  rows: HoursSummaryRow[];
  emptyMessage?: string;
}) {
  const normalized = rows
    .map((row) => {
      const estimated = finite(row.values.estimated)
        ? Math.max(row.values.estimated ?? 0, 0)
        : null;
      const logged = finite(row.values.logged) ? Math.max(row.values.logged ?? 0, 0) : null;
      const percent =
        estimated && estimated > 0 && logged !== null ? (logged / estimated) * 100 : null;
      const overrunPercent = percent !== null ? Math.max(percent - 100, 0) : 0;
      const tone =
        percent === null
          ? "unknown"
          : overrunPercent > 0
            ? "over"
            : percent >= 90
              ? "near"
              : "on-track";
      return {
        ...row,
        estimated,
        logged,
        percent,
        overrunPercent,
        tone,
      };
    })
    .filter((row) => row.estimated !== null || row.logged !== null);

  if (!normalized.length) return <div className="chart-empty">{emptyMessage}</div>;

  const highestPercent = Math.max(
    100,
    ...normalized.map((row) =>
      row.percent !== null && Number.isFinite(row.percent) ? row.percent : 0,
    ),
  );
  const scaleStep = highestPercent <= 300 ? 25 : highestPercent <= 600 ? 50 : 100;
  const displayMaximum = Math.max(100, Math.ceil(highestPercent / scaleStep) * scaleStep);
  const targetWidth = (100 / displayMaximum) * 100;

  return (
    <div
      className="hours-completion"
      role="img"
      aria-label="Logged hours compared with estimated hours on a shared percentage scale"
    >
      <div className="chart-legend hours-completion__legend" aria-hidden="true">
        <span>
          <i className="chart-swatch hours-completion__swatch hours-completion__swatch--track" />
          Estimated hours
        </span>
        <span>
          <i className="chart-swatch hours-completion__swatch hours-completion__swatch--fill" />
          Logged progress
        </span>
        <span>
          <i className="chart-swatch hours-completion__swatch hours-completion__swatch--overrun" />
          Above estimate
        </span>
      </div>

      <div className="hours-completion__rows">
        {normalized.map((row) => {
          const visiblePercent =
            row.percent === null ? 0 : Math.max(0, Math.min(row.percent, displayMaximum));
          const withinEstimatePercent = Math.min(visiblePercent, 100);
          const overrunVisiblePercent = Math.max(visiblePercent - 100, 0);
          const style = {
            "--hours-estimate-width": `${targetWidth}%`,
            "--hours-width": `${(withinEstimatePercent / displayMaximum) * 100}%`,
            "--hours-target-left": `${targetWidth}%`,
            "--hours-overrun-left": `${targetWidth}%`,
            "--hours-overrun-width": `${(overrunVisiblePercent / displayMaximum) * 100}%`,
          } as CSSProperties;
          const statusText =
            row.percent === null
              ? "No estimate"
              : row.percent > 100
                ? "Over estimate"
                : "Of estimate";

          return (
            <div className="hours-completion__row" key={row.label}>
              <div className="hours-completion__meta">
                <strong>{row.label}</strong>
                {row.detail ? <small>{row.detail}</small> : null}
              </div>

              <div className="hours-completion__progress">
                <div
                  className={`hours-completion__track hours-completion__track--${row.tone}`}
                  style={style}
                >
                  <span className="hours-completion__estimate-range" aria-hidden="true" />
                  <span className="hours-completion__fill" />
                  <span className="hours-completion__target" aria-hidden="true" />
                  {row.overrunPercent > 0 ? (
                    <span className="hours-completion__overrun" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="hours-completion__stats">
                  <span>{formatHours(row.logged)} logged</span>
                  <span>{formatHours(row.estimated)} est.</span>
                </div>
              </div>

              <div className={`hours-completion__badge hours-completion__badge--${row.tone}`}>
                <strong>{formatPercent(row.percent)}</strong>
                <small>{statusText}</small>
              </div>
            </div>
          );
        })}
      </div>

      <p className="hours-completion__note">
        The chart uses one shared 1:1 percentage scale. The estimate marker is 100%; red extends
        proportionally beyond it when logged hours exceed the estimate.
      </p>
    </div>
  );
}
