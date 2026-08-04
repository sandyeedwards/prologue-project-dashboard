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

function niceAxisStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const power = 10 ** exponent;
  const fraction = value / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
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

type TooltipState = {
  row: ProfitabilityRow;
  x: number;
  y: number;
};

function tooltipLabel(row: ProfitabilityRow, revenueLabel: string): string {
  const actual = finite(row.actualCost) ? row.actualCost : null;
  const remaining = finite(row.remainingCost)
    ? row.remainingCost
    : finite(row.cost) && actual !== null
      ? Math.max(row.cost - actual, 0)
      : null;
  const items = [
    `${row.label}.`,
    finite(row.revenue)
      ? `${revenueLabel}: ${fullCurrency(row.revenue)}.`
      : `${revenueLabel}: missing.`,
    finite(row.cost)
      ? `Forecast cost at completion: ${fullCurrency(row.cost)}.`
      : "Forecast cost at completion: missing.",
    actual !== null ? `Actual cost to date: ${fullCurrency(actual)}.` : null,
    remaining !== null ? `Costed remaining work: ${fullCurrency(remaining)}.` : null,
    finite(row.profit)
      ? `${row.profit < 0 ? "Forecast loss" : "Forecast profit"}: ${fullCurrency(row.profit)}.`
      : "Forecast profit: missing.",
    finite(row.margin) ? `Margin: ${row.margin.toFixed(1)} percent.` : "Margin: missing.",
  ];
  return items.filter(Boolean).join(" ");
}

export function ProfitabilityBridgeChart({
  rows,
  revenueLabel = "Client fee",
  emptyMessage = "No complete financial positions are available.",
}: {
  rows: ProfitabilityRow[];
  revenueLabel?: string;
  emptyMessage?: string;
}) {
  const tooltipId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const availableRows = rows.filter(
    (row) => finite(row.revenue) || finite(row.cost) || finite(row.profit),
  );

  if (!availableRows.length) return <div className="chart-empty">{emptyMessage}</div>;

  const maximumRevenue = Math.max(
    ...availableRows.map((row) => (finite(row.revenue) ? Math.max(row.revenue, 0) : 0)),
    1,
  );
  const maximumCost = Math.max(
    ...availableRows.map((row) => (finite(row.cost) ? Math.max(row.cost, 0) : 0)),
    1,
  );
  const maximumLoss = Math.max(
    ...availableRows.map((row) =>
      finite(row.cost) && finite(row.revenue) ? Math.max(row.cost - row.revenue, 0) : 0,
    ),
    0,
  );
  const tickStep = niceAxisStep(Math.max((maximumRevenue + maximumLoss) / 3, maximumCost / 2, 1));
  const positiveMaximum = Math.max(
    tickStep * 2,
    Math.ceil((maximumRevenue + maximumLoss) / tickStep) * tickStep,
  );
  const negativeMaximum = Math.max(tickStep * 2, Math.ceil(maximumCost / tickStep) * tickStep);
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
  const tickSpacing = 54;
  const topPadding = 28;
  const upperHeight = positiveTickCount * tickSpacing;
  const lowerHeight = negativeTickCount * tickSpacing;
  const baseline = topPadding + upperHeight;
  const chartHeight = baseline + lowerHeight + 78;
  const columnWidth = 58;
  const gap = 54;
  const left = 76;
  const right = 26;
  const chartWidth = left + availableRows.length * (columnWidth + gap) + right;
  const valueScale = tickSpacing / tickStep;

  const positionTooltip = (row: ProfitabilityRow, clientX: number, clientY: number) => {
    const plot = plotRef.current;
    if (!plot) return;
    const bounds = plot.getBoundingClientRect();
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const gapFromPointer = 14;
    const tooltipWidth = Math.min(292, Math.max(bounds.width - 16, 0));
    const tooltipHeight = Math.min(246, Math.max(bounds.height - 16, 0));
    let x = pointerX + gapFromPointer;
    let y = pointerY + gapFromPointer;

    if (x + tooltipWidth > bounds.width - 8) x = pointerX - tooltipWidth - gapFromPointer;
    if (y + tooltipHeight > bounds.height - 8) y = pointerY - tooltipHeight - gapFromPointer;

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
      bounds.top + Math.min(bounds.height / 2, 80),
    );
  };

  const tooltipRow = tooltip?.row ?? null;
  const tooltipRevenue =
    tooltipRow && finite(tooltipRow.revenue) ? Math.max(tooltipRow.revenue, 0) : null;
  const tooltipCost = tooltipRow && finite(tooltipRow.cost) ? Math.max(tooltipRow.cost, 0) : null;
  const tooltipActual =
    tooltipRow && finite(tooltipRow.actualCost) ? Math.max(tooltipRow.actualCost, 0) : null;
  const tooltipRemaining =
    tooltipRow && finite(tooltipRow.remainingCost)
      ? Math.max(tooltipRow.remainingCost, 0)
      : tooltipCost !== null && tooltipActual !== null
        ? Math.max(tooltipCost - tooltipActual, 0)
        : null;
  const tooltipProfit =
    tooltipRow && finite(tooltipRow.profit)
      ? tooltipRow.profit
      : tooltipRevenue !== null && tooltipCost !== null
        ? tooltipRevenue - tooltipCost
        : null;
  const tooltipMargin =
    tooltipRow && finite(tooltipRow.margin)
      ? tooltipRow.margin
      : tooltipRevenue !== null && tooltipRevenue > 0 && tooltipProfit !== null
        ? (tooltipProfit / tooltipRevenue) * 100
        : null;

  return (
    <div
      className="profitability-bridge"
      role="group"
      aria-label="Allocated revenue, forecast cost at completion, forecast profit or loss, and a mirrored forecast-cost comparison by operational group"
    >
      <div className="chart-legend profitability-bridge__legend" aria-hidden="true">
        <span>
          <i className="chart-swatch profitability-bridge__swatch profitability-bridge__swatch--profit" />
          Forecast profit
        </span>
        <span>
          <i className="chart-swatch profitability-bridge__swatch profitability-bridge__swatch--included" />
          Forecast cost at completion
        </span>
        <span>
          <i className="chart-swatch profitability-bridge__swatch profitability-bridge__swatch--revenue" />
          {revenueLabel} total
        </span>
        <span>
          <i className="chart-swatch profitability-bridge__swatch profitability-bridge__swatch--deduction" />
          Forecast-cost mirror (&lt; $0)
        </span>
      </div>
      <div className="profitability-bridge__plot" ref={plotRef}>
        <div className="profitability-bridge__scroll" onScroll={() => setTooltip(null)}>
          <svg
            className="profitability-bridge__svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ minWidth: `${Math.max(chartWidth, 720)}px` } as CSSProperties}
          >
            <line
              x1={left - 12}
              x2={left - 12}
              y1={topPadding}
              y2={baseline + lowerHeight}
              className="profitability-bridge__axis"
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
                    className="profitability-bridge__grid"
                  />
                  <text
                    x={left - 20}
                    y={y + 4}
                    textAnchor="end"
                    className="profitability-bridge__axis-label"
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
                    className="profitability-bridge__grid"
                  />
                  <text
                    x={left - 20}
                    y={y + 4}
                    textAnchor="end"
                    className="profitability-bridge__axis-label"
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
              className="profitability-bridge__zero"
            />
            <text
              x={left - 20}
              y={baseline + 4}
              textAnchor="end"
              className="profitability-bridge__axis-label"
            >
              $0
            </text>
            {availableRows.map((row, index) => {
              const x = left + index * (columnWidth + gap);
              const revenue = finite(row.revenue) ? Math.max(row.revenue, 0) : 0;
              const cost = finite(row.cost) ? Math.max(row.cost, 0) : 0;
              const calculatedProfit = finite(row.profit) ? row.profit : revenue - cost;
              const positiveProfit = Math.max(calculatedProfit, 0);
              const loss = Math.max(-calculatedProfit, 0);
              const revenueHeight = revenue * valueScale;
              const includedCostHeight = Math.min(cost, revenue) * valueScale;
              const profitHeight = Math.min(positiveProfit, revenue) * valueScale;
              const deductionHeight = cost * valueScale;
              const revenueY = baseline - revenueHeight;
              const includedCostY = baseline - includedCostHeight;
              const profitY = includedCostY - profitHeight;
              const lossCapHeight = loss > 0 ? Math.min(Math.max(loss * valueScale, 4), 12) : 0;
              const hitY = revenueHeight > 0 ? revenueY - lossCapHeight : baseline - lossCapHeight;
              const hitBottom = baseline + Math.max(deductionHeight + 2, 4);
              const hitHeight = Math.max(hitBottom - hitY, 8);
              return (
                <g className="profitability-bridge__group" key={`${row.label}-${index}`}>
                  {includedCostHeight > 0 ? (
                    <rect
                      x={x}
                      y={includedCostY}
                      width={columnWidth}
                      height={includedCostHeight}
                      className="profitability-bridge__included-cost"
                    />
                  ) : null}
                  {profitHeight > 0 ? (
                    <rect
                      x={x}
                      y={profitY}
                      width={columnWidth}
                      height={profitHeight}
                      className="profitability-bridge__profit"
                    />
                  ) : null}
                  {revenueHeight > 0 ? (
                    <rect
                      x={x}
                      y={revenueY}
                      width={columnWidth}
                      height={revenueHeight}
                      className="profitability-bridge__revenue"
                    />
                  ) : null}
                  {lossCapHeight > 0 ? (
                    <rect
                      x={x}
                      y={revenueY - lossCapHeight}
                      width={columnWidth}
                      height={lossCapHeight}
                      className="profitability-bridge__loss-cap"
                    />
                  ) : null}
                  {deductionHeight > 0 ? (
                    <rect
                      x={x}
                      y={baseline + 2}
                      width={columnWidth}
                      height={deductionHeight}
                      className="profitability-bridge__cost"
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={hitY}
                    width={columnWidth}
                    height={hitHeight}
                    className="profitability-bridge__hit"
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
                    x={x + columnWidth / 2}
                    y={baseline + lowerHeight + 34}
                    textAnchor="middle"
                    className="profitability-bridge__category"
                  >
                    {row.label.length > 17 ? `${row.label.slice(0, 16)}…` : row.label}
                  </text>
                  {row.detail ? (
                    <text
                      x={x + columnWidth / 2}
                      y={baseline + lowerHeight + 51}
                      textAnchor="middle"
                      className="profitability-bridge__detail"
                    >
                      {row.detail.length > 22 ? `${row.detail.slice(0, 21)}…` : row.detail}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
        {tooltip && tooltipRow ? (
          <div
            className="profitability-bridge__tooltip"
            id={tooltipId}
            role="tooltip"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className="profitability-bridge__tooltip-header">
              <strong>{tooltipRow.label}</strong>
              {tooltipRow.detail ? <span>{tooltipRow.detail}</span> : null}
            </div>
            <dl>
              <div>
                <dt>
                  <i className="profitability-bridge__tooltip-key profitability-bridge__tooltip-key--revenue" />
                  {revenueLabel}
                </dt>
                <dd>{fullCurrency(tooltipRevenue)}</dd>
              </div>
              <div>
                <dt>
                  <i className="profitability-bridge__tooltip-key profitability-bridge__tooltip-key--included" />
                  Forecast cost at completion
                </dt>
                <dd>{fullCurrency(tooltipCost)}</dd>
              </div>
              {tooltipActual !== null ? (
                <div className="profitability-bridge__tooltip-subrow">
                  <dt>Actual cost to date</dt>
                  <dd>{fullCurrency(tooltipActual)}</dd>
                </div>
              ) : null}
              {tooltipRemaining !== null ? (
                <div className="profitability-bridge__tooltip-subrow">
                  <dt>Costed remaining work</dt>
                  <dd>{fullCurrency(tooltipRemaining)}</dd>
                </div>
              ) : null}
              <div>
                <dt>
                  <i
                    className={`profitability-bridge__tooltip-key ${tooltipProfit !== null && tooltipProfit < 0 ? "profitability-bridge__tooltip-key--loss" : "profitability-bridge__tooltip-key--profit"}`}
                  />
                  {tooltipProfit !== null && tooltipProfit < 0
                    ? "Forecast loss"
                    : "Forecast profit"}
                </dt>
                <dd>{fullCurrency(tooltipProfit)}</dd>
              </div>
            </dl>
            <div className="profitability-bridge__tooltip-footer">
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
      <p className="profitability-bridge__note">
        The outlined bar is allocated revenue. Inside it, amber is forecast cost at completion and
        green is forecast profit. Forecast cost equals actual cost to date plus costed remaining
        work. The pale amber bar below $0 mirrors the same forecast cost for comparison and is not
        counted twice.
      </p>
    </div>
  );
}
