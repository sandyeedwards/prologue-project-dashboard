import type { CSSProperties } from "react";

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function currency(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectFinancialPosition({
  revenue,
  actualCost,
  remainingCost,
  forecastProfit,
  provisional = false,
}: {
  revenue: number | null;
  actualCost: number | null;
  remainingCost: number | null;
  forecastProfit: number | null;
  provisional?: boolean;
}) {
  const knownRevenue = finite(revenue) ? Math.max(revenue, 0) : 0;
  const knownActual = finite(actualCost) ? Math.max(actualCost, 0) : 0;
  const knownRemaining = finite(remainingCost) ? Math.max(remainingCost, 0) : 0;
  const forecastCost = knownActual + knownRemaining;
  const profit = finite(forecastProfit) ? forecastProfit : knownRevenue - forecastCost;
  const overrun = Math.max(forecastCost - knownRevenue, 0);
  const scale = Math.max(knownRevenue, forecastCost, 1);
  const revenueWidth = (knownRevenue / scale) * 100;
  const actualWidth = (Math.min(knownActual, knownRevenue) / scale) * 100;
  const remainingInside = Math.min(knownRemaining, Math.max(knownRevenue - knownActual, 0));
  const remainingWidth = (remainingInside / scale) * 100;
  const overrunWidth = (overrun / scale) * 100;
  const style = {
    "--project-financial-revenue": `${revenueWidth}%`,
    "--project-financial-actual": `${actualWidth}%`,
    "--project-financial-remaining-left": `${actualWidth}%`,
    "--project-financial-remaining": `${remainingWidth}%`,
    "--project-financial-overrun-left": `${revenueWidth}%`,
    "--project-financial-overrun": `${overrunWidth}%`,
  } as CSSProperties;
  const margin = knownRevenue > 0 ? (profit / knownRevenue) * 100 : null;

  if (!knownRevenue && !knownActual && !knownRemaining) {
    return (
      <div className="chart-empty">
        No complete financial position is available for this project.
      </div>
    );
  }

  return (
    <div
      className="project-financial-position"
      role="img"
      aria-label={`Project financial position. Revenue ${currency(revenue)}. Actual cost ${currency(actualCost)}. Remaining work ${currency(remainingCost)}. Forecast ${profit < 0 ? "loss" : "profit"} ${currency(profit)}.`}
    >
      <div className="project-financial-position__summary">
        <div>
          <span>Actual Cost to Date</span>
          <strong>{currency(actualCost)}</strong>
        </div>
        <div>
          <span>Costed Remaining Work</span>
          <strong>{currency(remainingCost)}</strong>
        </div>
        <div
          className={
            profit < 0 ? "project-financial-position__loss" : "project-financial-position__profit"
          }
        >
          <span>{profit < 0 ? "Forecast Loss" : "Unspent Revenue / Forecasted Profit"}</span>
          <strong>{currency(profit)}</strong>
        </div>
        <div>
          <span>{provisional ? "Margin Ceiling" : "Forecast Margin"}</span>
          <strong>{margin === null ? "Missing" : `${margin.toFixed(1)}%`}</strong>
        </div>
      </div>
      <div className="project-financial-position__scale" style={style} aria-hidden="true">
        <span className="project-financial-position__revenue" />
        <span className="project-financial-position__actual" />
        <span className="project-financial-position__remaining" />
        {overrun > 0 ? <span className="project-financial-position__overrun" /> : null}
        <i className="project-financial-position__revenue-threshold" />
      </div>
      <div className="project-financial-position__labels">
        <span>
          Revenue baseline <strong>{currency(revenue)}</strong>
        </span>
        <span>
          Forecast cost <strong>{currency(forecastCost)}</strong>
        </span>
      </div>
      <p>
        {provisional
          ? "Forecast values are based on currently costed inputs and may increase as missing assignments, rates, or expenses are resolved."
          : "The composition bar shows how much revenue has been consumed, how much cost remains, and the financial outcome at completion."}
      </p>
    </div>
  );
}
