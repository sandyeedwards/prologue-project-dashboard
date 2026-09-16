"use client";

import { useState } from "react";

import type { HostingReportRow, HostingView } from "@/lib/hosting/reporting";

const HEIGHT = 330;
const MARGIN = { top: 28, right: 24, bottom: 54, left: 70 };

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

function fullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const power = 10 ** exponent;
  const fraction = value / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

export function HostingFinancialChart({
  rows,
  view,
}: {
  rows: HostingReportRow[];
  view: HostingView;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!rows.length) {
    return <div className="chart-empty">No hosting periods are available for this range.</div>;
  }

  const points = rows.map((row) => ({
    ...row,
    displayedRevenue:
      view === "ivion" ? row.ivionRevenue : view === "benaco" ? row.benacoRevenue : row.revenue,
    displayedIvionCost: view === "benaco" ? 0 : row.ivionCost,
    displayedBenacoCost: view === "ivion" ? 0 : row.benacoCost,
    displayedNet:
      view === "ivion" ? row.ivionNet : view === "benaco" ? row.benacoNet : row.netProfit,
  }));
  const width = Math.max(820, points.length * 52 + MARGIN.left + MARGIN.right);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = points.flatMap((point) => [
    point.displayedRevenue,
    point.displayedIvionCost + point.displayedBenacoCost,
    point.displayedNet,
  ]);
  const rawMinimum = Math.min(0, ...values);
  const rawMaximum = Math.max(1, ...values);
  const step = niceStep(Math.max((rawMaximum - rawMinimum) / 5, 1));
  const minimum = Math.floor(rawMinimum / step) * step;
  const maximum = Math.max(step, Math.ceil(rawMaximum / step) * step);
  const y = (value: number) =>
    MARGIN.top + ((maximum - value) / Math.max(maximum - minimum, 1)) * plotHeight;
  const zeroY = y(0);
  const slot = plotWidth / points.length;
  const barWidth = Math.min(14, Math.max(5, slot * 0.3));
  const x = (index: number) => MARGIN.left + slot * (index + 0.5);
  const yTicks = Array.from(
    { length: Math.round((maximum - minimum) / step) + 1 },
    (_, index) => minimum + index * step,
  );
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));
  const netPath = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.displayedNet).toFixed(2)}`,
    )
    .join(" ");
  const firstForecastIndex = points.findIndex((point) => point.forecast);
  const hovered = hoveredIndex === null ? null : points[hoveredIndex];
  const tooltipWidth = 230;
  const tooltipX =
    hoveredIndex === null
      ? 0
      : Math.min(
          width - MARGIN.right - tooltipWidth,
          Math.max(MARGIN.left, x(hoveredIndex) - tooltipWidth / 2),
        );

  return (
    <div className="hosting-chart" role="region" aria-label="Hosting financial performance chart">
      <div className="hosting-chart__legend" aria-hidden="true">
        <span>
          <i className="hosting-chart-key hosting-chart-key--revenue" />
          Paid revenue
        </span>
        {view !== "benaco" ? (
          <span>
            <i className="hosting-chart-key hosting-chart-key--ivion" />
            IVION platform
          </span>
        ) : null}
        {view !== "ivion" ? (
          <span>
            <i className="hosting-chart-key hosting-chart-key--pano" />
            Benaco pano + subscription
          </span>
        ) : null}
        <span>
          <i className="hosting-chart-key hosting-chart-key--net" />
          Net revenue
        </span>
        {firstForecastIndex >= 0 ? (
          <span>
            <i className="hosting-chart-key hosting-chart-key--forecast" />
            Forecast
          </span>
        ) : null}
      </div>
      <div className="hosting-chart__scroller">
        <svg
          className="hosting-chart__svg"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-labelledby="hosting-chart-title hosting-chart-description"
          style={{ minWidth: `${width}px` }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <title id="hosting-chart-title">
            Hosting paid revenue, direct costs, and net revenue
          </title>
          <desc id="hosting-chart-description">
            Revenue and stacked direct cost bars by period, with a net revenue line. Hover or focus
            a period to see exact values.
          </desc>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "hosting-chart__zero" : "hosting-chart__grid"}
              />
              <text
                x={MARGIN.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="hosting-chart__axis-label"
              >
                {compactCurrency(tick)}
              </text>
            </g>
          ))}
          {firstForecastIndex > 0 ? (
            <g>
              <line
                x1={x(firstForecastIndex) - slot / 2}
                x2={x(firstForecastIndex) - slot / 2}
                y1={MARGIN.top - 6}
                y2={HEIGHT - MARGIN.bottom + 8}
                className="hosting-chart__forecast-divider"
              />
              <text
                x={x(firstForecastIndex) - slot / 2 + 7}
                y={MARGIN.top - 11}
                className="hosting-chart__forecast-label"
              >
                Forecast
              </text>
            </g>
          ) : null}
          {points.map((point, index) => {
            const center = x(index);
            const opacity = point.forecast ? 0.48 : 1;
            const revenueY = y(Math.max(point.displayedRevenue, 0));
            const ivionTop = y(point.displayedIvionCost);
            const benacoTop = y(point.displayedIvionCost + point.displayedBenacoCost);

            return (
              <g key={point.period} opacity={opacity}>
                <rect
                  x={center - barWidth - 2}
                  y={revenueY}
                  width={barWidth}
                  height={Math.max(zeroY - revenueY, 0)}
                  rx="2"
                  className="hosting-chart__bar hosting-chart__bar--revenue"
                />
                {point.displayedIvionCost > 0 ? (
                  <rect
                    x={center + 2}
                    y={ivionTop}
                    width={barWidth}
                    height={Math.max(zeroY - ivionTop, 0)}
                    className="hosting-chart__bar hosting-chart__bar--ivion"
                  />
                ) : null}
                {point.displayedBenacoCost > 0 ? (
                  <rect
                    x={center + 2}
                    y={benacoTop}
                    width={barWidth}
                    height={Math.max(ivionTop - benacoTop, 0)}
                    className="hosting-chart__bar hosting-chart__bar--pano"
                  />
                ) : null}
                {index % labelEvery === 0 || index === points.length - 1 ? (
                  <text
                    x={center}
                    y={HEIGHT - MARGIN.bottom + 22}
                    textAnchor="middle"
                    className="hosting-chart__period-label"
                  >
                    {point.period}
                  </text>
                ) : null}
                <rect
                  x={center - slot / 2}
                  y={MARGIN.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${point.period}: paid revenue ${fullCurrency(point.displayedRevenue)}, direct costs ${fullCurrency(point.displayedIvionCost + point.displayedBenacoCost)}, net revenue ${fullCurrency(point.displayedNet)}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
          <path d={netPath} className="hosting-chart__net-line" />
          {points.map((point, index) => (
            <circle
              key={`${point.period}-net`}
              cx={x(index)}
              cy={y(point.displayedNet)}
              r={point.forecast ? 2.5 : 3.5}
              className="hosting-chart__net-point"
              opacity={point.forecast ? 0.55 : 1}
            />
          ))}
          {hovered ? (
            <g className="hosting-chart__tooltip" pointerEvents="none">
              <rect x={tooltipX} y={36} width={tooltipWidth} height={118} rx={8} />
              <text x={tooltipX + 13} y={57} className="hosting-chart__tooltip-title">
                {hovered.period} · {hovered.forecast ? "Forecast" : "Actual"}
              </text>
              <text x={tooltipX + 13} y={79}>
                Paid revenue
              </text>
              <text x={tooltipX + tooltipWidth - 13} y={79} textAnchor="end">
                {fullCurrency(hovered.displayedRevenue)}
              </text>
              {view !== "benaco" ? (
                <>
                  <text x={tooltipX + 13} y={99}>
                    IVION platform
                  </text>
                  <text x={tooltipX + tooltipWidth - 13} y={99} textAnchor="end">
                    {fullCurrency(hovered.displayedIvionCost)}
                  </text>
                </>
              ) : null}
              {view !== "ivion" ? (
                <>
                  <text x={tooltipX + 13} y={119}>
                    Benaco pano + subscription
                  </text>
                  <text x={tooltipX + tooltipWidth - 13} y={119} textAnchor="end">
                    {fullCurrency(hovered.displayedBenacoCost)}
                  </text>
                </>
              ) : null}
              <text x={tooltipX + 13} y={141} className="hosting-chart__tooltip-net">
                Net revenue
              </text>
              <text
                x={tooltipX + tooltipWidth - 13}
                y={141}
                textAnchor="end"
                className="hosting-chart__tooltip-net"
              >
                {fullCurrency(hovered.displayedNet)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <p className="hosting-chart__note">
        Hover or focus a period to see its exact revenue, cost, and net values.
      </p>
    </div>
  );
}
