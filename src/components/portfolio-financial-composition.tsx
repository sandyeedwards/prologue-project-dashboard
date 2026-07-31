"use client";

import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import type { ProfitabilityRow } from "@/components/profitability-chart-types";

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fullCurrency(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

function formatMargin(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

type ResolvedRow = {
  revenue: number;
  actual: number;
  remaining: number;
  forecastCost: number;
  profit: number;
  margin: number | null;
};

function resolveRow(row: ProfitabilityRow): ResolvedRow {
  const revenue = finite(row.revenue) ? Math.max(row.revenue, 0) : 0;
  const actual = finite(row.actualCost) ? Math.max(row.actualCost, 0) : 0;
  const remaining = finite(row.remainingCost)
    ? Math.max(row.remainingCost, 0)
    : finite(row.cost)
      ? Math.max(row.cost - actual, 0)
      : 0;
  const forecastCost = finite(row.cost) ? Math.max(row.cost, 0) : actual + remaining;
  const profit = finite(row.profit) ? row.profit : revenue - forecastCost;
  const margin = finite(row.margin) ? row.margin : revenue > 0 ? (profit / revenue) * 100 : null;
  return { revenue, actual, remaining, forecastCost, profit, margin };
}

function ariaLabel(row: ProfitabilityRow, values: ResolvedRow): string {
  return [
    row.label,
    row.detail,
    `Allocated revenue ${fullCurrency(values.revenue)}.`,
    `Actual cost to date ${fullCurrency(values.actual)}.`,
    `Costed remaining work ${fullCurrency(values.remaining)}.`,
    `${values.profit < 0 ? "Forecast loss" : "Forecast profit"} ${fullCurrency(values.profit)}.`,
    `Forecast margin ${formatMargin(values.margin)}.`,
  ].filter(Boolean).join(" ");
}

function CompositionRow({
  row,
  maximumOverrunRatio,
  hero = false,
}: {
  row: ProfitabilityRow;
  maximumOverrunRatio: number;
  hero?: boolean;
}) {
  const tooltipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const values = resolveRow(row);
  const revenueBoundary = maximumOverrunRatio > 0
    ? Math.max(62, 100 / (1 + Math.min(maximumOverrunRatio, 0.6)))
    : 100;
  const revenue = values.revenue;
  const actualRatio = revenue > 0 ? values.actual / revenue : 0;
  const remainingRatio = revenue > 0 ? values.remaining / revenue : 0;
  const actualInsideRatio = Math.min(Math.max(actualRatio, 0), 1);
  const remainingInsideRatio = Math.min(Math.max(remainingRatio, 0), Math.max(1 - actualInsideRatio, 0));
  const profit = Math.max(revenue - values.forecastCost, 0);
  const loss = Math.max(values.forecastCost - revenue, 0);
  const profitRatio = revenue > 0 ? profit / revenue : 0;
  const overrunRatio = revenue > 0 ? loss / revenue : loss > 0 ? maximumOverrunRatio : 0;
  const overrunWidth = maximumOverrunRatio > 0
    ? Math.min((overrunRatio / maximumOverrunRatio) * (100 - revenueBoundary), 100 - revenueBoundary)
    : 0;
  const style = {
    "--portfolio-actual-width": `${actualInsideRatio * revenueBoundary}%`,
    "--portfolio-remaining-left": `${actualInsideRatio * revenueBoundary}%`,
    "--portfolio-remaining-width": `${remainingInsideRatio * revenueBoundary}%`,
    "--portfolio-profit-left": `${Math.min((values.forecastCost / Math.max(revenue, 1)), 1) * revenueBoundary}%`,
    "--portfolio-profit-width": `${profitRatio * revenueBoundary}%`,
    "--portfolio-revenue-boundary": `${revenueBoundary}%`,
    "--portfolio-loss-width": `${overrunWidth}%`,
  } as CSSProperties;

  const positionTooltip = (clientX: number, clientY: number) => {
    const container = plotRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const width = Math.min(360, Math.max(bounds.width - 16, 0));
    const height = 280;
    const gap = 14;
    let x = pointerX + gap;
    let y = pointerY + gap;
    if (x + width > bounds.width - 8) x = pointerX - width - gap;
    if (y + height > bounds.height + 220) y = pointerY - height - gap;
    x = Math.max(8, Math.min(x, Math.max(bounds.width - width - 8, 8)));
    y = Math.max(-210, Math.min(y, bounds.height - 8));
    setTooltip({ x, y });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    positionTooltip(event.clientX, event.clientY);
  };

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    positionTooltip(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  };

  return (
    <div className={`portfolio-composition__row${hero ? " portfolio-composition__row--hero" : ""}`}>
      <div className="portfolio-composition__identity">
        <strong>{row.label}</strong>
        {row.detail ? <small>{row.detail}</small> : null}
      </div>

      {hero ? (
        <div className="portfolio-composition__hero-metrics" aria-hidden="true">
          <span><small>Actual Cost to Date</small><strong>{compactCurrency(values.actual)}</strong></span>
          <span><small>Costed Remaining Work</small><strong>{compactCurrency(values.remaining)}</strong></span>
          <span className={values.profit < 0 ? "is-loss" : "is-profit"}><small>{values.profit < 0 ? "Forecast Loss" : "Forecasted Profit"}</small><strong>{compactCurrency(values.profit)}</strong></span>
          <span><small>Forecast Margin</small><strong>{formatMargin(values.margin)}</strong></span>
        </div>
      ) : null}

      <div className="portfolio-composition__plot" ref={plotRef}>
        <div
          className="portfolio-composition__track"
          style={style}
          role="img"
          tabIndex={0}
          aria-label={ariaLabel(row, values)}
          aria-describedby={tooltip ? tooltipId : undefined}
          onPointerEnter={onPointerMove}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setTooltip(null)}
          onFocus={onFocus}
          onBlur={() => setTooltip(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTooltip(null);
          }}
        >
          <span className="portfolio-composition__actual" />
          {remainingInsideRatio > 0 ? <span className="portfolio-composition__remaining" /> : null}
          {profit > 0 ? <span className="portfolio-composition__profit" /> : null}
          {loss > 0 ? <span className="portfolio-composition__loss" /> : null}
        </div>
        <div className="portfolio-composition__meta">
          <span>Revenue <strong>{fullCurrency(values.revenue)}</strong></span>
          <span>Forecast cost <strong>{fullCurrency(values.forecastCost)}</strong></span>
        </div>

        {tooltip ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="portfolio-composition__tooltip"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <header>
              <strong>{row.label}</strong>
              {row.detail ? <span>{row.detail}</span> : null}
            </header>
            <dl>
              <div><dt><i className="is-revenue" />Allocated revenue</dt><dd>{fullCurrency(values.revenue)}</dd></div>
              <div><dt><i className="is-actual" />Actual cost to date</dt><dd>{fullCurrency(values.actual)}</dd></div>
              <div><dt><i className="is-remaining" />Costed remaining work</dt><dd>{fullCurrency(values.remaining)}</dd></div>
              <div className={values.profit < 0 ? "is-loss" : "is-profit"}><dt><i />{values.profit < 0 ? "Forecast loss" : "Forecasted profit"}</dt><dd>{fullCurrency(values.profit)}</dd></div>
            </dl>
            <footer><span>Forecast margin</span><strong>{formatMargin(values.margin)}</strong></footer>
          </div>
        ) : null}
      </div>

      {!hero ? (
        <div className={`portfolio-composition__outcome${values.profit < 0 ? " is-loss" : " is-profit"}`}>
          <strong>{compactCurrency(values.profit)}</strong>
          <small>{values.profit < 0 ? "Forecast loss" : "Forecasted profit"}</small>
          <span>{formatMargin(values.margin)} margin</span>
        </div>
      ) : null}
    </div>
  );
}

export function PortfolioFinancialComposition({
  rows,
  variant = "groups",
  emptyMessage = "No complete financial position is available.",
}: {
  rows: ProfitabilityRow[];
  variant?: "total" | "groups";
  emptyMessage?: string;
}) {
  const available = rows.filter((row) => finite(row.revenue) || finite(row.actualCost) || finite(row.cost));
  if (!available.length) return <div className="chart-empty">{emptyMessage}</div>;

  const maximumOverrunRatio = Math.max(
    0,
    ...available.map((row) => {
      const values = resolveRow(row);
      if (values.revenue <= 0) return values.forecastCost > 0 ? 1 : 0;
      return Math.max(values.forecastCost / values.revenue - 1, 0);
    }),
  );

  return (
    <div className={`portfolio-composition portfolio-composition--${variant}`}>
      <div className="portfolio-composition__legend" aria-hidden="true">
        <span><i className="is-actual" />Actual Cost to Date</span>
        <span><i className="is-remaining" />Costed Remaining Work</span>
        <span><i className="is-profit" />Unspent Revenue / Forecasted Profit</span>
        <span><i className="is-loss" />Cost Above Revenue</span>
      </div>
      <div className="portfolio-composition__rows">
        {available.map((row) => (
          <CompositionRow
            key={row.label}
            row={row}
            maximumOverrunRatio={maximumOverrunRatio}
            hero={variant === "total"}
          />
        ))}
      </div>
    </div>
  );
}
