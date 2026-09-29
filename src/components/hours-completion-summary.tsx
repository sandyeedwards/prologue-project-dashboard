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

export function compressedHoursScalePercent(value: number, maximum: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(maximum) || maximum <= 0) return 0;

  const normalized = Math.min(value / maximum, 1);
  return Math.sqrt(normalized) * 100;
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
      const estimatedValue = finite(row.values.estimated)
        ? Math.max(row.values.estimated ?? 0, 0)
        : null;
      const estimated = estimatedValue !== null && estimatedValue > 0 ? estimatedValue : null;
      const logged = finite(row.values.logged) ? Math.max(row.values.logged ?? 0, 0) : null;
      const percent = estimated !== null && logged !== null ? (logged / estimated) * 100 : null;
      const overrunHours =
        estimated !== null && logged !== null ? Math.max(logged - estimated, 0) : 0;
      const tone =
        estimated === null || logged === null
          ? "unknown"
          : overrunHours > 0
            ? "over"
            : percent !== null && percent >= 90
              ? "near"
              : "on-track";

      return {
        ...row,
        estimated,
        logged,
        percent,
        overrunHours,
        tone,
      };
    })
    .filter((row) => row.estimated !== null || row.logged !== null);

  if (!normalized.length) {
    return <div className="chart-empty">{emptyMessage}</div>;
  }

  const sharedHoursMaximum = Math.max(
    1,
    ...normalized.map((row) => Math.max(row.estimated ?? 0, row.logged ?? 0)),
  );

  return (
    <div
      className="hours-completion"
      role="img"
      aria-label="Logged hours compared with estimated hours on a compressed shared hours scale"
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
          const estimateWidth =
            row.estimated === null
              ? 0
              : compressedHoursScalePercent(row.estimated, sharedHoursMaximum);

          const loggedTotalWidth =
            row.logged === null ? 0 : compressedHoursScalePercent(row.logged, sharedHoursMaximum);

          const loggedWidth =
            row.estimated === null ? loggedTotalWidth : Math.min(loggedTotalWidth, estimateWidth);

          const overrunWidth =
            row.estimated !== null && row.logged !== null
              ? Math.max(loggedTotalWidth - estimateWidth, 0)
              : 0;

          const style = {
            "--hours-estimate-width": String(estimateWidth) + "%",
            "--hours-width": String(loggedWidth) + "%",
            "--hours-target-left": String(estimateWidth) + "%",
            "--hours-overrun-left": String(estimateWidth) + "%",
            "--hours-overrun-width": String(overrunWidth) + "%",
          } as CSSProperties;

          const statusText =
            row.logged === null
              ? "Logged hours missing"
              : row.percent !== null && row.percent > 100
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
                  className={"hours-completion__track hours-completion__track--" + row.tone}
                  style={style}
                >
                  {row.estimated !== null ? (
                    <>
                      <span className="hours-completion__estimate-range" aria-hidden="true" />
                      <span className="hours-completion__target" aria-hidden="true" />
                    </>
                  ) : null}

                  <span className="hours-completion__fill" />

                  {row.overrunHours > 0 ? (
                    <span className="hours-completion__overrun" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="hours-completion__stats">
                  <span>{formatHours(row.logged)} logged</span>
                  <span>
                    {row.estimated === null ? "No estimate" : formatHours(row.estimated) + " est."}
                  </span>
                </div>
              </div>

              <div className={"hours-completion__badge hours-completion__badge--" + row.tone}>
                {row.estimated === null ? (
                  <>
                    <strong>No estimate</strong>
                    <small>{"Logged " + formatHours(row.logged)}</small>
                  </>
                ) : (
                  <>
                    <strong>{formatPercent(row.percent)}</strong>
                    <small>{statusText}</small>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="hours-completion__note">
        Bar lengths use a compressed shared hours scale (square-root) so smaller groups remain
        readable while larger workloads still appear longer. Blue shows logged hours within the
        estimate; red extends beyond the estimate when logged work is over plan. Rows without an
        estimate show logged hours without a percentage target.
      </p>
    </div>
  );
}
