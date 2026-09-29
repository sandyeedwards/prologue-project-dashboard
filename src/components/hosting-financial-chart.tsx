"use client";

import { useState, type MouseEvent } from "react";

import type { HostingReportRow, HostingView } from "@/lib/hosting/reporting";

const HEIGHT = 360;
const MARGIN = { top: 34, right: 30, bottom: 58, left: 76 };

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

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function marginLabel(net: number, revenue: number): string {
  if (!revenue) return "Not available";
  return `${((net / revenue) * 100).toFixed(1)}%`;
}

export function HostingFinancialChart({
  rows,
  view,
}: {
  rows: HostingReportRow[];
  view: HostingView;
}) {
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);

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
  const width = Math.max(940, points.length * 66 + MARGIN.left + MARGIN.right);
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
  const barWidth = Math.min(17, Math.max(7, slot * 0.28));
  const x = (index: number) => MARGIN.left + slot * (index + 0.5);
  const yTicks = Array.from(
    { length: Math.round((maximum - minimum) / step) + 1 },
    (_, index) => minimum + index * step,
  );
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));
  const firstForecastIndex = points.findIndex((point) => point.forecast);
  const hoveredPoint = hovered === null ? null : points[hovered.index];
  const highestNetIndex = points.reduce(
    (best, point, index) => (point.displayedNet > points[best].displayedNet ? index : best),
    0,
  );
  const lowestNetIndex = points.reduce(
    (worst, point, index) => (point.displayedNet < points[worst].displayedNet ? index : worst),
    0,
  );
  const firstNegativeIndex = points.findIndex((point) => point.displayedNet < 0);
  const annotationLabels = new Map<number, string[]>();
  const addAnnotation = (index: number, label: string) => {
    if (index < 0) return;
    annotationLabels.set(index, [...(annotationLabels.get(index) ?? []), label]);
  };
  addAnnotation(highestNetIndex, "Highest net");
  if (firstNegativeIndex >= 0) addAnnotation(firstNegativeIndex, "First negative");
  if (lowestNetIndex !== highestNetIndex) addAnnotation(lowestNetIndex, "Lowest net");
  addAnnotation(points.length - 1, "Latest");

  const tooltipRows = hoveredPoint
    ? [
        {
          label: "Paid revenue",
          value: fullCurrency(hoveredPoint.displayedRevenue),
          tone: "revenue",
        },
        ...(view !== "benaco"
          ? [
              {
                label: "Direct cost – IVION",
                value: fullCurrency(hoveredPoint.displayedIvionCost),
                tone: "ivion",
              },
            ]
          : []),
        ...(view !== "ivion"
          ? [
              {
                label: "Direct cost – Benaco + subscription",
                value: fullCurrency(hoveredPoint.displayedBenacoCost),
                tone: "pano",
              },
            ]
          : []),
        ...(view === "combined"
          ? [
              {
                label: "Total direct costs",
                value: fullCurrency(
                  hoveredPoint.displayedIvionCost + hoveredPoint.displayedBenacoCost,
                ),
                tone: "cost",
              },
            ]
          : []),
        {
          label: "Net revenue",
          value: fullCurrency(hoveredPoint.displayedNet),
          tone: hoveredPoint.displayedNet < 0 ? "negative-net" : "net",
        },
        {
          label: "Net margin",
          value: marginLabel(hoveredPoint.displayedNet, hoveredPoint.displayedRevenue),
          tone: "margin",
        },
      ]
    : [];
  const tooltipWidth = 330;
  const tooltipHeight = 48 + tooltipRows.length * 20;
  const tooltipX = hovered
    ? hovered.x + 14 + tooltipWidth <= width - MARGIN.right
      ? Math.max(MARGIN.left, hovered.x + 14)
      : Math.max(MARGIN.left, hovered.x - tooltipWidth - 14)
    : 0;
  const tooltipY = hovered
    ? Math.min(
        HEIGHT - MARGIN.bottom - tooltipHeight,
        Math.max(MARGIN.top, hovered.y - tooltipHeight / 2),
      )
    : 0;
  const inspectAtPointer = (event: MouseEvent<SVGRectElement>, index: number) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const bounds = svg.getBoundingClientRect();
    setHovered({
      index,
      x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * width,
      y: ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * HEIGHT,
    });
  };

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
            Direct Cost – IVION
          </span>
        ) : null}
        {view !== "ivion" ? (
          <span>
            <i className="hosting-chart-key hosting-chart-key--pano" />
            Direct Cost – Benaco + Subscription
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
          onMouseLeave={() => setHovered(null)}
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
                  aria-label={`${periodLabel(point.period)}: paid revenue ${fullCurrency(point.displayedRevenue)}, IVION platform cost ${fullCurrency(point.displayedIvionCost)}, Benaco and subscription cost ${fullCurrency(point.displayedBenacoCost)}, total direct costs ${fullCurrency(point.displayedIvionCost + point.displayedBenacoCost)}, net revenue ${fullCurrency(point.displayedNet)}, net margin ${marginLabel(point.displayedNet, point.displayedRevenue)}`}
                  onMouseEnter={(event) => inspectAtPointer(event, index)}
                  onMouseMove={(event) => inspectAtPointer(event, index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onFocus={() => setHovered({ index, x: center, y: y(point.displayedNet) })}
                  onBlur={() => setHovered(null)}
                />
              </g>
            );
          })}
          {points.slice(1).flatMap((point, index) => {
            const previous = points[index];
            const startX = x(index);
            const endX = x(index + 1);
            const startY = y(previous.displayedNet);
            const endY = y(point.displayedNet);
            if (
              previous.displayedNet !== 0 &&
              point.displayedNet !== 0 &&
              Math.sign(previous.displayedNet) !== Math.sign(point.displayedNet)
            ) {
              const ratio =
                Math.abs(previous.displayedNet) /
                (Math.abs(previous.displayedNet) + Math.abs(point.displayedNet));
              const crossX = startX + (endX - startX) * ratio;
              return [
                <path
                  key={`${point.period}-segment-before-zero`}
                  d={`M${startX.toFixed(2)},${startY.toFixed(2)} L${crossX.toFixed(2)},${zeroY.toFixed(2)}`}
                  className={
                    previous.displayedNet < 0
                      ? "hosting-chart__net-line hosting-chart__net-line--negative"
                      : "hosting-chart__net-line"
                  }
                />,
                <path
                  key={`${point.period}-segment-after-zero`}
                  d={`M${crossX.toFixed(2)},${zeroY.toFixed(2)} L${endX.toFixed(2)},${endY.toFixed(2)}`}
                  className={
                    point.displayedNet < 0
                      ? "hosting-chart__net-line hosting-chart__net-line--negative"
                      : "hosting-chart__net-line"
                  }
                />,
              ];
            }
            return [
              <path
                key={`${point.period}-segment`}
                d={`M${startX.toFixed(2)},${startY.toFixed(2)} L${endX.toFixed(2)},${endY.toFixed(2)}`}
                className={
                  point.displayedNet < 0
                    ? "hosting-chart__net-line hosting-chart__net-line--negative"
                    : "hosting-chart__net-line"
                }
              />,
            ];
          })}
          {points.map((point, index) => (
            <circle
              key={`${point.period}-net`}
              cx={x(index)}
              cy={y(point.displayedNet)}
              r={point.forecast ? 2.5 : 3.5}
              className={
                point.displayedNet < 0
                  ? "hosting-chart__net-point hosting-chart__net-point--negative"
                  : "hosting-chart__net-point"
              }
              opacity={point.forecast ? 0.55 : 1}
            />
          ))}
          {[...annotationLabels.entries()].map(([index, labels]) => {
            const point = points[index];
            const isNegative = point.displayedNet < 0;
            const labelY = Math.min(
              HEIGHT - MARGIN.bottom - 7,
              Math.max(MARGIN.top + 10, y(point.displayedNet) + (isNegative ? 18 : -11)),
            );
            return (
              <text
                key={`${point.period}-annotation`}
                x={x(index)}
                y={labelY}
                textAnchor={index >= points.length - 2 ? "end" : "middle"}
                className={`hosting-chart__annotation${isNegative ? " hosting-chart__annotation--negative" : ""}`}
              >
                {labels.join(" · ")}
              </text>
            );
          })}
          {hoveredPoint && hovered ? (
            <g className="hosting-chart__tooltip" pointerEvents="none">
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={MARGIN.top}
                y2={HEIGHT - MARGIN.bottom}
                className="hosting-chart__cursor-line"
              />
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx={8} />
              <text x={tooltipX + 16} y={tooltipY + 23} className="hosting-chart__tooltip-title">
                {periodLabel(hoveredPoint.period)} · {hoveredPoint.forecast ? "Forecast" : "Actual"}
              </text>
              <line
                x1={tooltipX + 16}
                x2={tooltipX + tooltipWidth - 16}
                y1={tooltipY + 34}
                y2={tooltipY + 34}
                className="hosting-chart__tooltip-divider"
              />
              {tooltipRows.map((row, index) => {
                const rowY = tooltipY + 55 + index * 20;
                return (
                  <g key={row.label}>
                    <circle
                      cx={tooltipX + 20}
                      cy={rowY}
                      r={3.5}
                      className={`hosting-chart__tooltip-key hosting-chart__tooltip-key--${row.tone}`}
                    />
                    <text
                      x={tooltipX + 32}
                      y={rowY + 4}
                      className={
                        row.tone.includes("net") ? "hosting-chart__tooltip-net" : undefined
                      }
                    >
                      {row.label}
                    </text>
                    <text
                      x={tooltipX + tooltipWidth - 16}
                      y={rowY + 4}
                      textAnchor="end"
                      className={`hosting-chart__tooltip-value${row.tone.includes("net") ? " hosting-chart__tooltip-net" : ""}`}
                    >
                      {row.value}
                    </text>
                  </g>
                );
              })}
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
