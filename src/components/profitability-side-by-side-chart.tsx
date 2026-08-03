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

function compactAxisCurrency(value: number): string {
  if (value === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function signedCompactCurrency(value: number): string {
  const absolute = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: Math.abs(value) >= 100000 ? 0 : 1,
  }).format(Math.abs(value));
  if (value === 0) return "$0";
  return `${value < 0 ? "−" : "+"}${absolute}`;
}

function niceAxisStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const power = 10 ** exponent;
  const fraction = value / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

function rowActualCost(row: ProfitabilityRow): number | null {
  return finite(row.actualCost) ? Math.max(row.actualCost, 0) : null;
}

function rowRemainingCost(row: ProfitabilityRow): number | null {
  if (finite(row.remainingCost)) return Math.max(row.remainingCost, 0);
  const actual = rowActualCost(row);
  return finite(row.cost) && actual !== null ? Math.max(row.cost - actual, 0) : null;
}

function tooltipLabel(row: ProfitabilityRow, revenueLabel: string): string {
  const actual = rowActualCost(row);
  const remaining = rowRemainingCost(row);
  const profit = finite(row.profit)
    ? row.profit
    : finite(row.revenue) && finite(row.cost)
      ? row.revenue - row.cost
      : null;
  const items = [
    `${row.label}.`,
    finite(row.revenue)
      ? `${revenueLabel}: ${fullCurrency(row.revenue)}.`
      : `${revenueLabel}: missing.`,
    actual !== null
      ? `Actual cost to date: ${fullCurrency(actual)}.`
      : "Actual cost to date: missing.",
    remaining !== null
      ? `Costed remaining work: ${fullCurrency(remaining)}.`
      : "Costed remaining work: missing.",
    profit !== null
      ? `${profit < 0 ? "Forecast loss" : "Forecast profit"}: ${fullCurrency(profit)}.`
      : "Forecast profit: missing.",
    finite(row.margin) ? `Margin: ${row.margin.toFixed(1)} percent.` : "Margin: missing.",
  ];
  return items.join(" ");
}

type TooltipState = {
  row: ProfitabilityRow;
  x: number;
  y: number;
};

export function ProfitabilitySideBySideChart({
  rows,
  revenueLabel = "Allocated revenue",
  emptyMessage = "No complete financial positions are available.",
  ariaLabel = "Side-by-side allocated revenue, actual cost to date, costed remaining work, and forecast profit or loss markers",
  expandToFill = false,
}: {
  rows: ProfitabilityRow[];
  revenueLabel?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  expandToFill?: boolean;
}) {
  const tooltipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const availableRows = rows.filter(
    (row) => finite(row.revenue) || finite(row.cost) || finite(row.profit),
  );

  if (!availableRows.length) return <div className="chart-empty">{emptyMessage}</div>;

  const values = availableRows.map((row) => {
    const revenue = finite(row.revenue) ? Math.max(row.revenue, 0) : 0;
    const cost = finite(row.cost) ? Math.max(row.cost, 0) : 0;
    const profit = finite(row.profit) ? row.profit : revenue - cost;
    return { revenue, cost, profit };
  });
  const maximumPositive = Math.max(
    ...values.flatMap(({ revenue, cost, profit }) => [revenue, cost, Math.max(profit, 0)]),
    1,
  );
  const maximumLoss = Math.max(...values.map(({ profit }) => Math.max(-profit, 0)), 0);
  const tickStep = niceAxisStep(Math.max(maximumPositive / 4, maximumLoss / 2, 1));
  const positiveMaximum = Math.max(tickStep * 4, Math.ceil(maximumPositive / tickStep) * tickStep);
  const negativeMaximum =
    maximumLoss > 0 ? Math.max(tickStep, Math.ceil(maximumLoss / tickStep) * tickStep) : 0;
  const positiveTickCount = Math.round(positiveMaximum / tickStep);
  const negativeTickCount = Math.round(negativeMaximum / tickStep);
  const positiveTicks = Array.from(
    { length: positiveTickCount + 1 },
    (_, index) => index * tickStep,
  );
  const negativeTicks = Array.from(
    { length: negativeTickCount + 1 },
    (_, index) => index * tickStep,
  );

  const expandedLayout = expandToFill;
  const singleRowExpanded = expandedLayout && availableRows.length === 1;
  const tickSpacing = singleRowExpanded ? 74 : expandedLayout ? 62 : 50;
  const topPadding = singleRowExpanded ? 18 : expandedLayout ? 20 : 24;
  const upperHeight = positiveTickCount * tickSpacing;
  const lowerHeight = negativeTickCount * tickSpacing;
  const baseline = topPadding + upperHeight;
  const chartHeight = baseline + lowerHeight + (singleRowExpanded ? 60 : expandedLayout ? 94 : 76);
  const left = 72;
  const right = 22;
  const minimumChartWidth = singleRowExpanded ? 700 : 760;
  const naturalSlotWidth =
    availableRows.length === 1 ? (singleRowExpanded ? 360 : 260) : expandedLayout ? 134 : 124;
  const chartWidth = Math.max(
    minimumChartWidth,
    left + right + availableRows.length * naturalSlotWidth,
  );
  const plotWidth = chartWidth - left - right;
  const slotWidth = plotWidth / availableRows.length;
  const barWidth =
    availableRows.length === 1
      ? singleRowExpanded
        ? 102
        : 92
      : expandedLayout
        ? Math.min(48, slotWidth * 0.36)
        : Math.min(40, slotWidth * 0.32);
  const barGap = availableRows.length === 1 ? 18 : Math.max(8, slotWidth * 0.055);
  const valueScale = tickSpacing / tickStep;

  const positionTooltip = (row: ProfitabilityRow, clientX: number, clientY: number) => {
    const plot = plotRef.current;
    if (!plot) return;
    const bounds = plot.getBoundingClientRect();
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const pointerGap = 14;
    const tooltipWidth = Math.min(368, Math.max(bounds.width - 16, 0));
    const tooltipHeight = Math.min(320, Math.max(bounds.height - 16, 0));
    let x = pointerX + pointerGap;
    let y = pointerY + pointerGap;

    if (x + tooltipWidth > bounds.width - 8) x = pointerX - tooltipWidth - pointerGap;
    if (y + tooltipHeight > bounds.height - 8) y = pointerY - tooltipHeight - pointerGap;

    x = Math.max(8, Math.min(x, Math.max(bounds.width - tooltipWidth - 8, 8)));
    y = Math.max(8, Math.min(y, Math.max(bounds.height - tooltipHeight - 8, 8)));
    setTooltip({ row, x, y });
  };

  const handlePointerMove = (row: ProfitabilityRow, event: PointerEvent<SVGRectElement>) => {
    positionTooltip(row, event.clientX, event.clientY);
  };

  const handleFocus = (row: ProfitabilityRow, event: FocusEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    positionTooltip(
      row,
      bounds.left + bounds.width / 2,
      bounds.top + Math.min(bounds.height / 2, 90),
    );
  };

  const tooltipRow = tooltip?.row ?? null;
  const tooltipRevenue =
    tooltipRow && finite(tooltipRow.revenue) ? Math.max(tooltipRow.revenue, 0) : null;
  const tooltipActual = tooltipRow ? rowActualCost(tooltipRow) : null;
  const tooltipRemaining = tooltipRow ? rowRemainingCost(tooltipRow) : null;
  const tooltipProfit =
    tooltipRow && finite(tooltipRow.profit)
      ? tooltipRow.profit
      : tooltipRevenue !== null && tooltipRow && finite(tooltipRow.cost)
        ? tooltipRevenue - Math.max(tooltipRow.cost, 0)
        : null;
  const tooltipMargin =
    tooltipRow && finite(tooltipRow.margin)
      ? tooltipRow.margin
      : tooltipRevenue !== null && tooltipRevenue > 0 && tooltipProfit !== null
        ? (tooltipProfit / tooltipRevenue) * 100
        : null;

  return (
    <div className="profitability-side-by-side" role="group" aria-label={ariaLabel}>
      <div className="chart-legend profitability-side-by-side__legend" aria-hidden="true">
        <span>
          <i className="chart-swatch profitability-side-by-side__swatch profitability-side-by-side__swatch--revenue" />
          {revenueLabel}
        </span>
        <span>
          <i className="chart-swatch profitability-side-by-side__swatch profitability-side-by-side__swatch--actual" />
          Actual cost to date
        </span>
        <span>
          <i className="chart-swatch profitability-side-by-side__swatch profitability-side-by-side__swatch--remaining" />
          Costed remaining work
        </span>
        <span>
          <i className="profitability-side-by-side__marker-key profitability-side-by-side__marker-key--profit" />
          Forecast profit
        </span>
        <span>
          <i className="profitability-side-by-side__marker-key profitability-side-by-side__marker-key--loss" />
          Forecast loss
        </span>
      </div>

      <div className="profitability-side-by-side__plot" ref={plotRef}>
        <div className="profitability-side-by-side__scroll" onScroll={() => setTooltip(null)}>
          <svg
            className="profitability-side-by-side__svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMidYMin meet"
            style={{ minWidth: `${chartWidth}px` } as CSSProperties}
          >
            <line
              x1={left - 12}
              x2={left - 12}
              y1={topPadding}
              y2={baseline + lowerHeight}
              className="profitability-side-by-side__axis"
            />
            {positiveTicks.slice(1).map((value) => {
              const y = baseline - value * valueScale;
              return (
                <g key={`positive-${value}`}>
                  <line
                    x1={left - 12}
                    x2={chartWidth - right}
                    y1={y}
                    y2={y}
                    className="profitability-side-by-side__grid"
                  />
                  <text
                    x={left - 20}
                    y={y + 4}
                    textAnchor="end"
                    className="profitability-side-by-side__axis-label"
                  >
                    {compactAxisCurrency(value)}
                  </text>
                </g>
              );
            })}
            {negativeTicks.slice(1).map((value) => {
              const y = baseline + value * valueScale;
              return (
                <g key={`negative-${value}`}>
                  <line
                    x1={left - 12}
                    x2={chartWidth - right}
                    y1={y}
                    y2={y}
                    className="profitability-side-by-side__grid"
                  />
                  <text
                    x={left - 20}
                    y={y + 4}
                    textAnchor="end"
                    className="profitability-side-by-side__axis-label"
                  >
                    -{compactAxisCurrency(value)}
                  </text>
                </g>
              );
            })}
            <line
              x1={left - 12}
              x2={chartWidth - right}
              y1={baseline}
              y2={baseline}
              className="profitability-side-by-side__zero"
            />
            <text
              x={left - 20}
              y={baseline + 4}
              textAnchor="end"
              className="profitability-side-by-side__axis-label"
            >
              $0
            </text>

            {availableRows.map((row, index) => {
              const center = left + slotWidth * (index + 0.5);
              const revenueX = center - barGap / 2 - barWidth;
              const costX = center + barGap / 2;
              const revenue = finite(row.revenue) ? Math.max(row.revenue, 0) : 0;
              const cost = finite(row.cost) ? Math.max(row.cost, 0) : 0;
              const profit = finite(row.profit) ? row.profit : revenue - cost;
              const actual = rowActualCost(row);
              const remaining = rowRemainingCost(row);
              const compositionKnown = actual !== null && remaining !== null;
              const actualSegment = compositionKnown ? Math.min(actual, cost) : 0;
              const remainingSegment = compositionKnown
                ? Math.max(Math.min(remaining, cost - actualSegment), 0)
                : 0;
              const unassignedSegment = Math.max(cost - actualSegment - remainingSegment, 0);
              const revenueHeight = revenue * valueScale;
              const costHeight = cost * valueScale;
              const actualHeight = actualSegment * valueScale;
              const remainingHeight = remainingSegment * valueScale;
              const unassignedHeight = unassignedSegment * valueScale;
              const revenueY = baseline - revenueHeight;
              const costTop = baseline - costHeight;
              const markerY =
                profit >= 0 ? baseline - profit * valueScale : baseline + -profit * valueScale;
              const markerClass =
                profit < 0
                  ? "profitability-side-by-side__marker--loss"
                  : "profitability-side-by-side__marker--profit";
              const profitLabel = signedCompactCurrency(profit);
              const labelWidth = Math.max(54, profitLabel.length * 6.4 + 14);
              const labelHeight = 18;
              const preferredLabelY = profit >= 0 ? markerY - 26 : markerY + 10;
              const labelY = Math.max(
                topPadding + 4,
                Math.min(preferredLabelY, baseline + lowerHeight - labelHeight - 8),
              );
              const labelX = center - labelWidth / 2;
              const groupTop = Math.min(revenueY, costTop, markerY, labelY) - 10;
              const groupBottom = Math.max(baseline, markerY) + 10;
              const hitWidth = Math.min(slotWidth - 10, barWidth * 2 + barGap + 34);
              const markerStart = revenueX + barWidth / 2 - 8;
              const markerEnd = costX + barWidth / 2 + 8;

              return (
                <g className="profitability-side-by-side__group" key={`${row.label}-${index}`}>
                  {revenueHeight > 0 ? (
                    <rect
                      x={revenueX}
                      y={revenueY}
                      width={barWidth}
                      height={revenueHeight}
                      rx={4}
                      className="profitability-side-by-side__revenue"
                    />
                  ) : null}

                  {compositionKnown ? (
                    <>
                      {actualHeight > 0 ? (
                        <rect
                          x={costX}
                          y={baseline - actualHeight}
                          width={barWidth}
                          height={actualHeight}
                          rx={4}
                          className="profitability-side-by-side__actual"
                        />
                      ) : null}
                      {remainingHeight > 0 ? (
                        <rect
                          x={costX}
                          y={baseline - actualHeight - remainingHeight}
                          width={barWidth}
                          height={remainingHeight}
                          rx={4}
                          className="profitability-side-by-side__remaining"
                        />
                      ) : null}
                      {unassignedHeight > 0 ? (
                        <rect
                          x={costX}
                          y={costTop}
                          width={barWidth}
                          height={unassignedHeight}
                          rx={4}
                          className="profitability-side-by-side__forecast-unknown"
                        />
                      ) : null}
                    </>
                  ) : costHeight > 0 ? (
                    <rect
                      x={costX}
                      y={costTop}
                      width={barWidth}
                      height={costHeight}
                      rx={4}
                      className="profitability-side-by-side__forecast-unknown"
                    />
                  ) : null}

                  <g className={`profitability-side-by-side__marker ${markerClass}`}>
                    <line x1={markerStart} x2={markerEnd} y1={markerY} y2={markerY} />
                    <circle cx={center} cy={markerY} r={4.5} />
                  </g>
                  <g
                    className={`profitability-side-by-side__value-pill ${profit < 0 ? "profitability-side-by-side__value-pill--loss" : "profitability-side-by-side__value-pill--profit"}`}
                    aria-hidden="true"
                  >
                    <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx={9} />
                    <text x={center} y={labelY + 12} textAnchor="middle">
                      {profitLabel}
                    </text>
                  </g>

                  <rect
                    x={center - hitWidth / 2}
                    y={groupTop}
                    width={hitWidth}
                    height={Math.max(groupBottom - groupTop, 18)}
                    className="profitability-side-by-side__hit"
                    tabIndex={0}
                    aria-label={tooltipLabel(row, revenueLabel)}
                    aria-describedby={tooltipRow === row ? tooltipId : undefined}
                    onPointerEnter={(event) => handlePointerMove(row, event)}
                    onPointerMove={(event) => handlePointerMove(row, event)}
                    onPointerLeave={() => setTooltip(null)}
                    onFocus={(event) => handleFocus(row, event)}
                    onBlur={() => setTooltip(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setTooltip(null);
                    }}
                  />

                  <text
                    x={center}
                    y={baseline + lowerHeight + 31}
                    textAnchor="middle"
                    className="profitability-side-by-side__category"
                  >
                    {row.label.length > 19 ? `${row.label.slice(0, 18)}…` : row.label}
                  </text>
                  {row.detail ? (
                    <text
                      x={center}
                      y={baseline + lowerHeight + 48}
                      textAnchor="middle"
                      className="profitability-side-by-side__detail"
                    >
                      {row.detail.length > 28 ? `${row.detail.slice(0, 27)}…` : row.detail}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        {tooltip && tooltipRow ? (
          <div
            className="profitability-side-by-side__tooltip"
            id={tooltipId}
            role="tooltip"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className="profitability-side-by-side__tooltip-header">
              <strong>{tooltipRow.label}</strong>
              {tooltipRow.detail ? <span>{tooltipRow.detail}</span> : null}
            </div>
            <dl>
              <div>
                <dt>
                  <i className="profitability-side-by-side__tooltip-key profitability-side-by-side__tooltip-key--revenue" />
                  {revenueLabel}
                </dt>
                <dd>{fullCurrency(tooltipRevenue)}</dd>
              </div>
              <div>
                <dt>
                  <i className="profitability-side-by-side__tooltip-key profitability-side-by-side__tooltip-key--actual" />
                  Actual cost to date
                </dt>
                <dd>{fullCurrency(tooltipActual)}</dd>
              </div>
              <div>
                <dt>
                  <i className="profitability-side-by-side__tooltip-key profitability-side-by-side__tooltip-key--remaining" />
                  Costed remaining work
                </dt>
                <dd>{fullCurrency(tooltipRemaining)}</dd>
              </div>
              <div>
                <dt>
                  <i
                    className={`profitability-side-by-side__tooltip-key ${tooltipProfit !== null && tooltipProfit < 0 ? "profitability-side-by-side__tooltip-key--loss" : "profitability-side-by-side__tooltip-key--profit"}`}
                  />
                  {tooltipProfit !== null && tooltipProfit < 0
                    ? "Forecast loss"
                    : "Forecast profit"}
                </dt>
                <dd>{fullCurrency(tooltipProfit)}</dd>
              </div>
            </dl>
            <div className="profitability-side-by-side__tooltip-footer">
              <span>
                {tooltipMargin === null
                  ? "Margin unavailable"
                  : `${tooltipMargin.toFixed(1)}% margin`}
              </span>
              {tooltipRow.projectCount !== undefined ? (
                <span>
                  {tooltipRow.projectCount} project{tooltipRow.projectCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <p className="profitability-side-by-side__note">
        Blue shows allocated revenue. The adjacent cost bar stacks actual cost to date and costed
        remaining work. The green or red marker and value pill show the resulting forecast profit or
        loss. Hover or focus a group to see exact values.
      </p>
    </div>
  );
}
