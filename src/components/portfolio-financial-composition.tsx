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
import {
  profitabilityPlotComplete,
  profitLabel,
  profitTone,
  resolveProfitabilityRow,
  type ResolvedProfitabilityRow,
} from "@/lib/reporting/forecast-position";
import { MISSING, REPORT_LABELS as L } from "@/lib/reporting/labels";

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fullCurrency(value: number | null | undefined): string {
  if (!finite(value)) return MISSING;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number | null | undefined): string {
  if (!finite(value)) return MISSING;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

function formatMargin(value: number | null | undefined): string {
  if (!finite(value)) return MISSING;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

type ResolvedRow = ResolvedProfitabilityRow;
const resolveRow = resolveProfitabilityRow;

// A missing value is shown as "Missing", never as $0.
function shown(value: number, known: boolean): string {
  return known ? fullCurrency(value) : MISSING;
}

function ariaLabel(row: ProfitabilityRow, values: ResolvedRow): string {
  return [
    row.label,
    row.detail,
    `${L.fee} ${shown(values.revenue, values.known.revenue)}.`,
    `${L.currentCosts} ${shown(values.actual, values.known.actual)}.`,
    `${L.estimatedRemainingCosts} ${shown(values.remaining, values.known.remaining)}.`,
    `${profitLabel(row, values)} ${shown(values.profit, values.known.profit)}.`,
    `${L.forecastMargin} ${formatMargin(values.margin)}.`,
    row.provisional ? "Provisional: missing inputs may increase costs." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function CompositionRow({
  row,
  maximumOverrunRatio,
  hero = false,
  showHeroMetrics = true,
}: {
  row: ProfitabilityRow;
  maximumOverrunRatio: number;
  hero?: boolean;
  showHeroMetrics?: boolean;
}) {
  const tooltipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const values = resolveRow(row);
  const revenueBoundary = maximumOverrunRatio > 0 ? 94 : 100;
  // Without a real revenue and forecast cost there is nothing truthful to draw.
  const complete = profitabilityPlotComplete(values);
  const revenue = complete ? values.revenue : 0;
  const actualRatio = revenue > 0 ? values.actual / revenue : 0;
  const remainingRatio = revenue > 0 ? values.remaining / revenue : 0;
  const actualInsideRatio = Math.min(Math.max(actualRatio, 0), 1);
  const remainingInsideRatio = Math.min(
    Math.max(remainingRatio, 0),
    Math.max(1 - actualInsideRatio, 0),
  );
  const profit = complete ? Math.max(revenue - values.forecastCost, 0) : 0;
  const loss = complete ? Math.max(values.forecastCost - revenue, 0) : 0;
  const profitRatio = revenue > 0 ? profit / revenue : 0;
  const overrunRatio = revenue > 0 ? loss / revenue : loss > 0 ? maximumOverrunRatio : 0;
  const overrunWidth =
    maximumOverrunRatio > 0
      ? Math.min(
          (overrunRatio / maximumOverrunRatio) * (100 - revenueBoundary),
          100 - revenueBoundary,
        )
      : 0;
  const style = {
    "--portfolio-actual-width": `${actualInsideRatio * revenueBoundary}%`,
    "--portfolio-remaining-left": `${actualInsideRatio * revenueBoundary}%`,
    "--portfolio-remaining-width": `${remainingInsideRatio * revenueBoundary}%`,
    "--portfolio-profit-left": `${Math.min(values.forecastCost / Math.max(revenue, 1), 1) * revenueBoundary}%`,
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
    <div
      className={`portfolio-composition__row${hero ? " portfolio-composition__row--hero" : ""}${hero && !showHeroMetrics ? " portfolio-composition__row--compact-hero" : ""}`}
    >
      <div className="portfolio-composition__identity">
        <strong>{row.label}</strong>
        {row.detail ? <small>{row.detail}</small> : null}
      </div>

      {hero && showHeroMetrics ? (
        <div className="portfolio-composition__hero-metrics" aria-hidden="true">
          <span>
            <small>{L.currentCosts}</small>
            <strong>{shown(values.actual, values.known.actual)}</strong>
          </span>
          <span>
            <small>{L.estimatedRemainingCosts}</small>
            <strong>{shown(values.remaining, values.known.remaining)}</strong>
          </span>
          <span className={profitTone(row, values)}>
            <small>{profitLabel(row, values)}</small>
            <strong>{shown(values.profit, values.known.profit)}</strong>
          </span>
          <span>
            <small>{L.forecastMargin}</small>
            <strong>{formatMargin(values.margin)}</strong>
          </span>
        </div>
      ) : null}

      <div className="portfolio-composition__plot" ref={plotRef}>
        <div
          className={`portfolio-composition__track${row.provisional ? " is-provisional" : ""}`}
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
          <span>
            {L.fee} <strong>{shown(values.revenue, values.known.revenue)}</strong>
          </span>
          <span>
            {L.forecastCost}{" "}
            <strong>{shown(values.forecastCost, values.known.forecastCost)}</strong>
          </span>
          {row.provisional ? (
            <span className="portfolio-composition__flag">
              Provisional: missing inputs may increase costs
            </span>
          ) : null}
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
              <div>
                <dt>
                  <i className="is-revenue" />
                  {L.fee}
                </dt>
                <dd>{shown(values.revenue, values.known.revenue)}</dd>
              </div>
              <div>
                <dt>
                  <i className="is-actual" />
                  {L.currentCosts}
                </dt>
                <dd>{shown(values.actual, values.known.actual)}</dd>
              </div>
              <div>
                <dt>
                  <i className="is-remaining" />
                  {L.estimatedRemainingCosts}
                </dt>
                <dd>{shown(values.remaining, values.known.remaining)}</dd>
              </div>
              <div className={profitTone(row, values)}>
                <dt>
                  <i />
                  {profitLabel(row, values)}
                </dt>
                <dd>{shown(values.profit, values.known.profit)}</dd>
              </div>
            </dl>
            <footer>
              <span>{L.forecastMargin}</span>
              <strong>{formatMargin(values.margin)}</strong>
            </footer>
          </div>
        ) : null}
      </div>

      {!hero ? (
        <div className={`portfolio-composition__outcome ${profitTone(row, values)}`}>
          <strong>{values.known.profit ? compactCurrency(values.profit) : MISSING}</strong>
          <small>{profitLabel(row, values)}</small>
          <span>{formatMargin(values.margin)} margin</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin: cost with no share of the fee. Drawn on the same scale as the largest group fee so its
 * size reads against delivery work, and never coloured as a loss.
 */
function CostOnlyRow({ row, scale }: { row: ProfitabilityRow; scale: number }) {
  const values = resolveRow(row);
  const width = (value: number) => `${Math.min(Math.max(value / Math.max(scale, 1), 0), 1) * 100}%`;
  const style = {
    "--portfolio-actual-width": width(values.actual),
    "--portfolio-remaining-left": width(values.actual),
    "--portfolio-remaining-width": width(values.remaining),
    "--portfolio-revenue-boundary": "100%",
  } as CSSProperties;
  return (
    <div className="portfolio-composition__row portfolio-composition__row--cost-only">
      <div className="portfolio-composition__identity">
        <strong>{row.label}</strong>
        {row.detail ? <small>{row.detail}</small> : null}
      </div>
      <div className="portfolio-composition__plot">
        <div
          className="portfolio-composition__track portfolio-composition__track--cost-only"
          style={style}
          role="img"
          aria-label={`${row.label}. Cost only, no share of the fee. ${L.currentCosts} ${shown(values.actual, values.known.actual)}. ${L.estimatedRemainingCosts} ${shown(values.remaining, values.known.remaining)}.`}
        >
          <span className="portfolio-composition__actual" />
          {values.remaining > 0 ? <span className="portfolio-composition__remaining" /> : null}
        </div>
        <div className="portfolio-composition__meta">
          <span>No share of the fee: the admin fee is profit</span>
          <span>
            {L.forecastCost}{" "}
            <strong>{shown(values.forecastCost, values.known.forecastCost)}</strong>
          </span>
        </div>
      </div>
      <div className="portfolio-composition__outcome is-cost">
        <strong>
          {values.known.forecastCost ? compactCurrency(values.forecastCost) : MISSING}
        </strong>
        <small>Admin cost</small>
        <span>Cost only</span>
      </div>
    </div>
  );
}

export function PortfolioFinancialComposition({
  rows,
  variant = "groups",
  showHeroMetrics = true,
  emptyMessage = "No complete financial position is available.",
}: {
  rows: ProfitabilityRow[];
  variant?: "total" | "groups";
  showHeroMetrics?: boolean;
  emptyMessage?: string;
}) {
  const available = rows.filter(
    (row) => finite(row.revenue) || finite(row.actualCost) || finite(row.cost),
  );
  if (!available.length) return <div className="chart-empty">{emptyMessage}</div>;

  const scale = Math.max(
    1,
    ...available.filter((row) => !row.costOnly).map((row) => resolveRow(row).revenue),
  );
  const maximumOverrunRatio = Math.max(
    0,
    ...available
      .filter((row) => !row.costOnly)
      .map((row) => {
        const values = resolveRow(row);
        if (!profitabilityPlotComplete(values)) return 0;
        if (values.revenue <= 0) return values.forecastCost > 0 ? 1 : 0;
        return Math.max(values.forecastCost / values.revenue - 1, 0);
      }),
  );

  return (
    <div className={`portfolio-composition portfolio-composition--${variant}`}>
      <div className="portfolio-composition__legend" aria-hidden="true">
        <span>
          <i className="is-actual" />
          {L.currentCosts}
        </span>
        <span>
          <i className="is-remaining" />
          {L.estimatedRemainingCosts}
        </span>
        <span>
          <i className="is-profit" />
          {L.projectedProfit}
        </span>
        <span>
          <i className="is-loss" />
          {L.projectedLoss}
        </span>
      </div>
      <div className="portfolio-composition__rows">
        {available.map((row) =>
          row.costOnly ? (
            <CostOnlyRow key={row.label} row={row} scale={scale} />
          ) : (
            <CompositionRow
              key={row.label}
              row={row}
              maximumOverrunRatio={maximumOverrunRatio}
              hero={variant === "total"}
              showHeroMetrics={showHeroMetrics}
            />
          ),
        )}
      </div>
      <p className="portfolio-composition__note">
        Estimated remaining costs include internal labor only. Recorded vendor expenses are included
        in current costs; outsourced modeling task estimates are excluded from remaining work.
      </p>
    </div>
  );
}
