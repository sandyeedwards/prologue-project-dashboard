"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type {
  HistoricalProfitPoint,
  HistoricalProfitSeries,
} from "@/components/historical-profit-chart-types";

type RangeId = "LIFE" | "30D" | "3M" | "6M" | "1Y" | "CUSTOM";

type RangeOption = {
  id: RangeId;
  label: string;
  days?: number;
  months?: number;
  years?: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { id: "30D", label: "30 days", days: 30 },
  { id: "3M", label: "3 months", months: 3 },
  { id: "6M", label: "6 months", months: 6 },
  { id: "1Y", label: "1 year", years: 1 },
  { id: "LIFE", label: "Unlimited" },
  { id: "CUSTOM", label: "Custom" },
];

const WIDTH = 980;
const HEIGHT = 470;
const MARGIN = { top: 28, right: 28, bottom: 64, left: 82 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORICAL_RANGE_SYNC_EVENT = "prologue:historical-range-sync";
const HISTORICAL_RANGE_CHANGE_EVENT = "prologue:historical-range-change";
const DRAG_THRESHOLD_PX = 5;

type HistoricalRangeChangeDetail = {
  from: string;
  to: string;
  source: string;
};

function fullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number): string {
  if (value === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function dateTime(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftDays(value: string, days: number): string {
  return isoDate(new Date(dateTime(value) + days * DAY_MS));
}

function subtractCalendarMonths(value: string, months: number): string {
  const source = new Date(`${value}T00:00:00Z`);
  const originalDay = source.getUTCDate();
  source.setUTCDate(1);
  source.setUTCMonth(source.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0),
  ).getUTCDate();
  source.setUTCDate(Math.min(originalDay, lastDay));
  return isoDate(source);
}

function subtractCalendarYears(value: string, years: number): string {
  const source = new Date(`${value}T00:00:00Z`);
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  source.setUTCDate(1);
  source.setUTCFullYear(source.getUTCFullYear() - years);
  const lastDay = new Date(Date.UTC(source.getUTCFullYear(), month + 1, 0)).getUTCDate();
  source.setUTCMonth(month);
  source.setUTCDate(Math.min(day, lastDay));
  return isoDate(source);
}

function formatDate(value: string, includeYear = true): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const power = 10 ** exponent;
  const fraction = value / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
}

function zeroPoint(date: string): HistoricalProfitPoint {
  return {
    date,
    grossRevenue: 0,
    actualCostToDate: 0,
    anticipatedCostToDate: 0,
    netProfitToDate: 0,
    forecastNetProfitToDate: 0,
    projectCount: 0,
    completedProjectCount: 0,
    grossRevenueKnownCount: 0,
    forecastCostKnownCount: 0,
    forecastProfitKnownCount: 0,
    costCoverageCompleteCount: 0,
    costCoveragePartialCount: 0,
    provisionalProjectCount: 0,
    costedTimeEntryCount: 0,
    costedExpenseCount: 0,
    missingCostRecordCount: 0,
    fallbackDatedLaborCount: 0,
    fallbackDatedExpenseCount: 0,
  };
}

function pointAtOrBefore(points: HistoricalProfitPoint[], date: string): HistoricalProfitPoint {
  const target = dateTime(date);
  let result: HistoricalProfitPoint | null = null;
  for (const point of points) {
    if (dateTime(point.date) > target) break;
    result = point;
  }
  return result ? { ...result, date } : zeroPoint(date);
}

function rangeBounds(
  points: HistoricalProfitPoint[],
  range: RangeId,
  customRange: { from: string; to: string } | null,
): { from: string; to: string } | null {
  if (!points.length) return null;
  const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const latestDataDate = sorted[sorted.length - 1].date;
  const earliestEventDate = sorted[0].date;
  const option = RANGE_OPTIONS.find((item) => item.id === range) ?? RANGE_OPTIONS[0];
  const to = option.id === "CUSTOM" && customRange ? customRange.to : latestDataDate;
  const from =
    option.id === "CUSTOM" && customRange
      ? customRange.from
      : option.id === "LIFE" || option.id === "CUSTOM"
        ? shiftDays(earliestEventDate, -1)
        : option.months
          ? subtractCalendarMonths(to, option.months)
          : option.years
            ? subtractCalendarYears(to, option.years)
            : shiftDays(to, -(option.days ?? 30));
  return { from, to };
}

function visibleRangePoints(
  points: HistoricalProfitPoint[],
  range: RangeId,
  customRange: { from: string; to: string } | null,
): HistoricalProfitPoint[] {
  if (!points.length) return [];
  const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const bounds = rangeBounds(sorted, range, customRange);
  if (!bounds) return [];
  const startDate = bounds.from;
  const endDate = bounds.to;

  const visible: HistoricalProfitPoint[] = [pointAtOrBefore(sorted, startDate)];
  for (const point of sorted) {
    if (point.date > startDate && point.date < endDate) visible.push(point);
  }
  const endingPoint = pointAtOrBefore(sorted, endDate);
  if (visible[visible.length - 1]?.date === endDate) {
    visible[visible.length - 1] = endingPoint;
  } else {
    visible.push(endingPoint);
  }
  return visible;
}

function stepLinePath(
  points: HistoricalProfitPoint[],
  value: (point: HistoricalProfitPoint) => number,
  x: (point: HistoricalProfitPoint) => number,
  y: (value: number) => number,
): string {
  if (!points.length) return "";
  let path = `M${x(points[0]).toFixed(2)},${y(value(points[0])).toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    path += ` H${x(point).toFixed(2)} V${y(value(point)).toFixed(2)}`;
  }
  return path;
}

function stepAreaPath(
  points: HistoricalProfitPoint[],
  value: (point: HistoricalProfitPoint) => number,
  x: (point: HistoricalProfitPoint) => number,
  y: (value: number) => number,
  baselineY: number,
): string {
  if (!points.length) return "";
  let path = `M${x(points[0]).toFixed(2)},${baselineY.toFixed(2)} V${y(value(points[0])).toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    path += ` H${x(point).toFixed(2)} V${y(value(point)).toFixed(2)}`;
  }
  path += ` V${baselineY.toFixed(2)} H${x(points[0]).toFixed(2)} Z`;
  return path;
}

function evenlySpacedDates(startDate: string, endDate: string, count: number): string[] {
  const start = dateTime(startDate);
  const end = dateTime(endDate);
  if (count <= 1 || start === end) return [startDate];
  return Array.from({ length: count }, (_, index) =>
    isoDate(new Date(start + ((end - start) * index) / (count - 1))),
  );
}

export function HistoricalRevenueProfitChart({
  series,
  initialDateRange,
}: {
  series: HistoricalProfitSeries[];
  initialDateRange?: { from?: string; to?: string };
}) {
  const initialCustomRange =
    initialDateRange?.from && initialDateRange?.to
      ? { from: initialDateRange.from, to: initialDateRange.to }
      : null;
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const pointerDownXRef = useRef<number | null>(null);
  const pointerDownDateRef = useRef<string | null>(null);
  const pointerDraggedRef = useRef(false);
  const anchorExistedOnPointerDownRef = useRef(false);
  const [range, setRange] = useState<RangeId>(initialCustomRange ? "CUSTOM" : "LIFE");
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(
    initialCustomRange,
  );
  const [customPrompt, setCustomPrompt] = useState("");
  const [zoomAnchorDate, setZoomAnchorDate] = useState<string | null>(null);
  const [zoomCurrentDate, setZoomCurrentDate] = useState<string | null>(null);
  const [zoomMessage, setZoomMessage] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const selectedSeries =
    series.find((item) => item.projectType === "All project types") ?? series[0] ?? null;

  const allPoints = useMemo(() => selectedSeries?.points ?? [], [selectedSeries]);
  const availableStartDate = allPoints.length ? shiftDays(allPoints[0].date, -1) : "";
  const availableEndDate = allPoints.length ? allPoints[allPoints.length - 1].date : "";

  useEffect(() => {
    const handleExternalRangeChange = (event: Event) => {
      const detail = (event as CustomEvent<HistoricalRangeChangeDetail>).detail;
      if (!detail || !["user", "initial"].includes(detail.source)) return;
      if (!detail.from || !detail.to) {
        setCustomPrompt("Enter both Project date fields above to apply a custom historical range.");
        return;
      }
      if (detail.to < detail.from) {
        setCustomPrompt("The Project date through value cannot be earlier than Project date from.");
        return;
      }
      if (
        (availableStartDate && detail.from < availableStartDate) ||
        (availableEndDate && detail.to > availableEndDate)
      ) {
        setCustomPrompt(
          `Choose dates between ${formatDate(availableStartDate)} and ${formatDate(availableEndDate)}.`,
        );
        return;
      }
      setCustomRange({ from: detail.from, to: detail.to });
      setRange("CUSTOM");
      setCustomPrompt("");
      pointerDownXRef.current = null;
      pointerDownDateRef.current = null;
      pointerDraggedRef.current = false;
      anchorExistedOnPointerDownRef.current = false;
      setZoomAnchorDate(null);
      setZoomCurrentDate(null);
      setZoomMessage("");
      setHoveredIndex(null);
      setTooltipPosition(null);
    };

    window.addEventListener(HISTORICAL_RANGE_CHANGE_EVENT, handleExternalRangeChange);
    return () =>
      window.removeEventListener(HISTORICAL_RANGE_CHANGE_EVENT, handleExternalRangeChange);
  }, [availableEndDate, availableStartDate]);

  const visiblePoints = useMemo(
    () => visibleRangePoints(allPoints, range, customRange),
    [allPoints, customRange, range],
  );

  const model = useMemo(() => {
    if (!visiblePoints.length) return null;
    const values = visiblePoints.flatMap((point) => [
      point.grossRevenue,
      point.actualCostToDate,
      point.anticipatedCostToDate,
      point.netProfitToDate,
      point.forecastNetProfitToDate,
    ]);
    const rawMinimum = Math.min(0, ...values);
    const rawMaximum = Math.max(1, ...values);
    const step = niceStep(Math.max((rawMaximum - rawMinimum) / 5, 1));
    let minimum = Math.floor(rawMinimum / step) * step;
    let maximum = Math.ceil(rawMaximum / step) * step;
    if (maximum === minimum) maximum = minimum + step;
    if (minimum > 0) minimum = 0;

    const firstTime = dateTime(visiblePoints[0].date);
    const lastTime = dateTime(visiblePoints[visiblePoints.length - 1].date);
    const timeSpan = Math.max(lastTime - firstTime, 1);
    const x = (point: HistoricalProfitPoint) =>
      MARGIN.left + ((dateTime(point.date) - firstTime) / timeSpan) * PLOT_WIDTH;
    const xForDate = (date: string) =>
      MARGIN.left + ((dateTime(date) - firstTime) / timeSpan) * PLOT_WIDTH;
    const y = (value: number) =>
      MARGIN.top + ((maximum - value) / (maximum - minimum)) * PLOT_HEIGHT;

    const tickCount = Math.max(1, Math.round((maximum - minimum) / step));
    const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => minimum + index * step);
    const xTickDates = evenlySpacedDates(
      visiblePoints[0].date,
      visiblePoints[visiblePoints.length - 1].date,
      6,
    );

    return {
      x,
      xForDate,
      y,
      yTicks,
      xTickDates,
      grossPath: stepLinePath(visiblePoints, (point) => point.grossRevenue, x, y),
      costPath: stepLinePath(visiblePoints, (point) => point.actualCostToDate, x, y),
      anticipatedCostPath: stepLinePath(
        visiblePoints,
        (point) => point.anticipatedCostToDate,
        x,
        y,
      ),
      netPath: stepLinePath(visiblePoints, (point) => point.netProfitToDate, x, y),
      forecastNetPath: stepLinePath(visiblePoints, (point) => point.forecastNetProfitToDate, x, y),
      grossAreaPath: stepAreaPath(visiblePoints, (point) => point.grossRevenue, x, y, y(0)),
      netAreaPath: stepAreaPath(visiblePoints, (point) => point.netProfitToDate, x, y, y(0)),
    };
  }, [visiblePoints]);

  if (!series.length) {
    return (
      <div className="historical-profit-chart historical-profit-chart--empty">
        <div className="chart-empty">
          No project financial history is available for the current portfolio selection.
        </div>
      </div>
    );
  }

  const hoveredPoint =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < visiblePoints.length
      ? visiblePoints[hoveredIndex]
      : null;

  const positionTooltip = (clientX: number, clientY: number) => {
    const container = plotRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const tooltipWidth = Math.min(372, Math.max(bounds.width - 20, 0));
    const tooltipHeight = Math.min(390, Math.max(bounds.height - 20, 0));
    const gap = 16;
    let x = pointerX + gap;
    let y = pointerY + gap;

    if (x + tooltipWidth > bounds.width - 8) x = pointerX - tooltipWidth - gap;
    if (y + tooltipHeight > bounds.height - 8) y = pointerY - tooltipHeight - gap;

    x = Math.max(8, Math.min(x, Math.max(bounds.width - tooltipWidth - 8, 8)));
    y = Math.max(8, Math.min(y, Math.max(bounds.height - tooltipHeight - 8, 8)));
    setTooltipPosition({ x, y });
  };

  const positionTooltipForPoint = (point: HistoricalProfitPoint) => {
    if (!model || !plotRef.current) return;
    const bounds = plotRef.current.getBoundingClientRect();
    const x = (model.x(point) / WIDTH) * bounds.width;
    const y = (model.y(point.forecastNetProfitToDate) / HEIGHT) * bounds.height;
    positionTooltip(bounds.left + x, bounds.top + y);
  };

  const inspectPoint = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, visiblePoints.length - 1));
    setHoveredIndex(boundedIndex);
    positionTooltipForPoint(visiblePoints[boundedIndex]);
  };

  const clearInspection = () => {
    setHoveredIndex(null);
    setTooltipPosition(null);
  };

  const cancelZoomSelection = () => {
    pointerDownXRef.current = null;
    pointerDownDateRef.current = null;
    pointerDraggedRef.current = false;
    anchorExistedOnPointerDownRef.current = false;
    setZoomAnchorDate(null);
    setZoomCurrentDate(null);
    setZoomMessage("");
  };

  const syncExternalDateFields = (
    from: string,
    to: string,
    source: "preset" | "unlimited" | "zoom" | "reset" | "custom",
    focus = false,
  ) => {
    window.dispatchEvent(
      new CustomEvent(HISTORICAL_RANGE_SYNC_EVENT, {
        detail: { from, to, source, focus },
      }),
    );
  };

  const readExternalDateFields = () => {
    const target = document.querySelector<HTMLElement>('[data-historical-range-target="true"]');
    return {
      from: target?.querySelector<HTMLInputElement>('input[name="dateFrom"]')?.value ?? "",
      to: target?.querySelector<HTMLInputElement>('input[name="dateTo"]')?.value ?? "",
    };
  };

  const dateFromPointer = (event: PointerEvent<SVGRectElement>): string | null => {
    if (!visiblePoints.length || !svgRef.current) return null;
    const bounds = svgRef.current.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const clampedX = Math.max(MARGIN.left, Math.min(svgX, MARGIN.left + PLOT_WIDTH));
    const ratio = (clampedX - MARGIN.left) / PLOT_WIDTH;
    const firstTime = dateTime(visiblePoints[0].date);
    const lastTime = dateTime(visiblePoints[visiblePoints.length - 1].date);
    return isoDate(new Date(firstTime + (lastTime - firstTime) * ratio));
  };

  const applyZoomRange = (firstDate: string, secondDate: string) => {
    const from = firstDate < secondDate ? firstDate : secondDate;
    const to = firstDate < secondDate ? secondDate : firstDate;
    if (from === to) {
      pointerDownXRef.current = null;
      pointerDownDateRef.current = null;
      pointerDraggedRef.current = false;
      anchorExistedOnPointerDownRef.current = false;
      setZoomAnchorDate(from);
      setZoomCurrentDate(from);
      setZoomMessage("Choose a different ending date, or drag across a wider period.");
      return;
    }

    setCustomRange({ from, to });
    setRange("CUSTOM");
    setCustomPrompt("");
    syncExternalDateFields(from, to, "zoom");
    setZoomAnchorDate(null);
    setZoomCurrentDate(null);
    setZoomMessage(`Custom range applied: ${formatDate(from)} through ${formatDate(to)}.`);
    pointerDownXRef.current = null;
    pointerDownDateRef.current = null;
    pointerDraggedRef.current = false;
    anchorExistedOnPointerDownRef.current = false;
    clearInspection();
  };

  const setNearestPoint = (event: PointerEvent<SVGRectElement>) => {
    if (!model || !visiblePoints.length || !svgRef.current) return;
    const bounds = svgRef.current.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    let nearest = 0;
    let distance = Infinity;
    visiblePoints.forEach((point, index) => {
      const nextDistance = Math.abs(model.x(point) - svgX);
      if (nextDistance < distance) {
        nearest = index;
        distance = nextDistance;
      }
    });
    setHoveredIndex(nearest);
    positionTooltip(event.clientX, event.clientY);

    if (
      pointerDownXRef.current !== null &&
      Math.abs(event.clientX - pointerDownXRef.current) >= DRAG_THRESHOLD_PX
    ) {
      pointerDraggedRef.current = true;
    }

    if (zoomAnchorDate || pointerDownDateRef.current) {
      const pointerDate = dateFromPointer(event);
      if (pointerDate) setZoomCurrentDate(pointerDate);
    }
  };

  const handlePointerDown = (event: PointerEvent<SVGRectElement>) => {
    if (event.button !== 0) return;
    const pointerDate = dateFromPointer(event);
    if (!pointerDate) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDownXRef.current = event.clientX;
    pointerDownDateRef.current = pointerDate;
    pointerDraggedRef.current = false;
    anchorExistedOnPointerDownRef.current = Boolean(zoomAnchorDate);

    if (zoomAnchorDate) {
      setZoomCurrentDate(pointerDate);
    } else {
      setZoomAnchorDate(pointerDate);
      setZoomCurrentDate(pointerDate);
      setZoomMessage(
        `Range start set to ${formatDate(pointerDate)}. Drag and release, or move and click again, to zoom.`,
      );
    }
    setNearestPoint(event);
  };

  const handlePointerUp = (event: PointerEvent<SVGRectElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const pointerDate = dateFromPointer(event);
    const pointerStartDate = pointerDownDateRef.current;
    if (!pointerDate || !pointerStartDate) return;

    const existingAnchor = anchorExistedOnPointerDownRef.current ? zoomAnchorDate : null;
    if (existingAnchor) {
      applyZoomRange(existingAnchor, pointerDate);
      return;
    }
    if (pointerDraggedRef.current) {
      applyZoomRange(pointerStartDate, pointerDate);
      return;
    }

    pointerDownXRef.current = null;
    pointerDownDateRef.current = null;
    pointerDraggedRef.current = false;
    anchorExistedOnPointerDownRef.current = false;
    setZoomAnchorDate(pointerStartDate);
    setZoomCurrentDate(pointerStartDate);
    setZoomMessage(
      `Range start set to ${formatDate(pointerStartDate)}. Move left or right, then click again to zoom.`,
    );
  };

  const handleRangeSelection = (option: RangeOption) => {
    cancelZoomSelection();
    clearInspection();

    if (option.id === "CUSTOM") {
      const external = readExternalDateFields();
      setRange("CUSTOM");
      syncExternalDateFields(external.from, external.to, "custom", true);
      if (
        external.from &&
        external.to &&
        external.to >= external.from &&
        (!availableStartDate || external.from >= availableStartDate) &&
        (!availableEndDate || external.to <= availableEndDate)
      ) {
        setCustomRange(external);
        setCustomPrompt(
          "Adjust the highlighted Project date fields above to refine this custom range.",
        );
      } else {
        setCustomPrompt(
          "Enter Project date from and Project date through above. The fields are highlighted for a custom historical range.",
        );
      }
      return;
    }

    if (option.id === "LIFE") {
      setRange("LIFE");
      setCustomRange(null);
      setCustomPrompt("");
      syncExternalDateFields("", "", "unlimited");
      return;
    }

    const bounds = rangeBounds(allPoints, option.id, null);
    setRange(option.id);
    setCustomPrompt("");
    if (bounds) syncExternalDateFields(bounds.from, bounds.to, "preset");
  };

  const resetHistoricalView = () => {
    cancelZoomSelection();
    clearInspection();
    setRange("LIFE");
    setCustomRange(null);
    setCustomPrompt("");
    syncExternalDateFields("", "", "reset");
  };

  const moveByKeyboard = (event: KeyboardEvent<SVGRectElement>) => {
    if (!visiblePoints.length) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      if (zoomAnchorDate) cancelZoomSelection();
      clearInspection();
      return;
    }
    if (event.key === "Home") {
      inspectPoint(0);
      return;
    }
    if (event.key === "End") {
      inspectPoint(visiblePoints.length - 1);
      return;
    }
    const start = hoveredIndex ?? visiblePoints.length - 1;
    inspectPoint(event.key === "ArrowLeft" ? start - 1 : start + 1);
  };

  const dateRangeCrossesYears =
    visiblePoints.length > 1 &&
    visiblePoints[0].date.slice(0, 4) !== visiblePoints[visiblePoints.length - 1].date.slice(0, 4);
  const zoomSelection =
    zoomAnchorDate && zoomCurrentDate
      ? {
          from: zoomAnchorDate < zoomCurrentDate ? zoomAnchorDate : zoomCurrentDate,
          to: zoomAnchorDate < zoomCurrentDate ? zoomCurrentDate : zoomAnchorDate,
        }
      : null;

  return (
    <div className="historical-profit-chart">
      <div className="historical-profit-chart__controls">
        <div className="historical-profit-chart__ranges" role="group" aria-label="Historical range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                range === option.id
                  ? "historical-profit-chart__range historical-profit-chart__range--active"
                  : "historical-profit-chart__range"
              }
              aria-pressed={range === option.id}
              onClick={() => handleRangeSelection(option)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className="historical-profit-chart__range historical-profit-chart__range--reset"
            onClick={resetHistoricalView}
          >
            Reset range
          </button>
        </div>
      </div>

      {customPrompt ? (
        <p className="historical-profit-chart__custom-prompt" role="status">
          {customPrompt}
        </p>
      ) : null}

      <p className="historical-profit-chart__zoom-help">
        Press and drag across the graph to zoom, or click once to set a starting point and click
        again to finish. Press Escape to cancel.
      </p>
      {zoomMessage ? (
        <p className="historical-profit-chart__zoom-status" aria-live="polite">
          {zoomMessage}
        </p>
      ) : null}

      <div className="chart-legend historical-profit-chart__legend" aria-hidden="true">
        <span>
          <i className="historical-profit-chart__legend-line historical-profit-chart__legend-line--gross" />
          Gross revenue
        </span>
        <span>
          <i className="historical-profit-chart__legend-line historical-profit-chart__legend-line--cost" />
          Actual cost to date
        </span>
        <span>
          <i className="historical-profit-chart__legend-line historical-profit-chart__legend-line--anticipated" />
          Anticipated cost to date
        </span>
        <span>
          <i className="historical-profit-chart__legend-line historical-profit-chart__legend-line--net" />
          Net profit to date
        </span>
        <span>
          <i className="historical-profit-chart__legend-line historical-profit-chart__legend-line--forecast-net" />
          Forecasted net profit
        </span>
      </div>

      {model && visiblePoints.length ? (
        <div className="historical-profit-chart__plot" ref={plotRef}>
          <svg
            ref={svgRef}
            className="historical-profit-chart__svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Filtered portfolio gross revenue, actual cost to date, anticipated cost, net profit to date, and forecasted net profit from ${formatDate(visiblePoints[0].date)} through ${formatDate(visiblePoints[visiblePoints.length - 1].date)}`}
          >
            {model.yTicks.map((value) => {
              const y = model.y(value);
              return (
                <g key={value}>
                  <line
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y}
                    y2={y}
                    className={
                      value === 0
                        ? "historical-profit-chart__zero"
                        : "historical-profit-chart__grid"
                    }
                  />
                  <text
                    x={MARGIN.left - 14}
                    y={y + 4}
                    textAnchor="end"
                    className="historical-profit-chart__axis-label"
                  >
                    {compactCurrency(value)}
                  </text>
                </g>
              );
            })}

            {model.xTickDates.map((date) => {
              const x = model.xForDate(date);
              return (
                <g key={date}>
                  <line
                    x1={x}
                    x2={x}
                    y1={MARGIN.top}
                    y2={HEIGHT - MARGIN.bottom}
                    className="historical-profit-chart__vertical-grid"
                  />
                  <text
                    x={x}
                    y={HEIGHT - 30}
                    textAnchor="middle"
                    className="historical-profit-chart__axis-label"
                  >
                    {formatDate(date, dateRangeCrossesYears)}
                  </text>
                </g>
              );
            })}

            <path
              d={model.grossAreaPath}
              className="historical-profit-chart__area historical-profit-chart__area--gross"
            />
            <path
              d={model.netAreaPath}
              className="historical-profit-chart__area historical-profit-chart__area--net"
            />
            <path
              d={model.grossPath}
              className="historical-profit-chart__line historical-profit-chart__line--gross"
            />
            <path
              d={model.costPath}
              className="historical-profit-chart__line historical-profit-chart__line--cost"
            />
            <path
              d={model.anticipatedCostPath}
              className="historical-profit-chart__line historical-profit-chart__line--anticipated"
            />
            <path
              d={model.netPath}
              className="historical-profit-chart__line historical-profit-chart__line--net"
            />
            <path
              d={model.forecastNetPath}
              className="historical-profit-chart__line historical-profit-chart__line--forecast-net"
            />

            <circle
              cx={model.x(visiblePoints[visiblePoints.length - 1])}
              cy={model.y(visiblePoints[visiblePoints.length - 1].grossRevenue)}
              r={4.5}
              className="historical-profit-chart__point historical-profit-chart__point--gross"
            />
            <circle
              cx={model.x(visiblePoints[visiblePoints.length - 1])}
              cy={model.y(visiblePoints[visiblePoints.length - 1].actualCostToDate)}
              r={4.5}
              className="historical-profit-chart__point historical-profit-chart__point--cost"
            />
            <circle
              cx={model.x(visiblePoints[visiblePoints.length - 1])}
              cy={model.y(visiblePoints[visiblePoints.length - 1].anticipatedCostToDate)}
              r={4.5}
              className="historical-profit-chart__point historical-profit-chart__point--anticipated"
            />
            <circle
              cx={model.x(visiblePoints[visiblePoints.length - 1])}
              cy={model.y(visiblePoints[visiblePoints.length - 1].netProfitToDate)}
              r={4.5}
              className="historical-profit-chart__point historical-profit-chart__point--net"
            />
            <circle
              cx={model.x(visiblePoints[visiblePoints.length - 1])}
              cy={model.y(visiblePoints[visiblePoints.length - 1].forecastNetProfitToDate)}
              r={4.5}
              className="historical-profit-chart__point historical-profit-chart__point--forecast-net"
            />

            {zoomSelection ? (
              <g className="historical-profit-chart__selection" aria-hidden="true">
                <rect
                  x={model.xForDate(zoomSelection.from)}
                  y={MARGIN.top}
                  width={Math.max(
                    model.xForDate(zoomSelection.to) - model.xForDate(zoomSelection.from),
                    2,
                  )}
                  height={PLOT_HEIGHT}
                  className="historical-profit-chart__selection-fill"
                />
                <line
                  x1={model.xForDate(zoomSelection.from)}
                  x2={model.xForDate(zoomSelection.from)}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="historical-profit-chart__selection-edge"
                />
                <line
                  x1={model.xForDate(zoomSelection.to)}
                  x2={model.xForDate(zoomSelection.to)}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="historical-profit-chart__selection-edge"
                />
                <text
                  x={model.xForDate(zoomSelection.from) + 5}
                  y={MARGIN.top + 16}
                  className="historical-profit-chart__selection-label"
                >
                  {formatDate(zoomSelection.from)}
                </text>
                <text
                  x={model.xForDate(zoomSelection.to) - 5}
                  y={MARGIN.top + 16}
                  textAnchor="end"
                  className="historical-profit-chart__selection-label"
                >
                  {formatDate(zoomSelection.to)}
                </text>
              </g>
            ) : null}

            {hoveredPoint && hoveredIndex !== null ? (
              <g aria-hidden="true">
                <line
                  x1={model.x(hoveredPoint)}
                  x2={model.x(hoveredPoint)}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="historical-profit-chart__hover-line"
                />
                <circle
                  cx={model.x(hoveredPoint)}
                  cy={model.y(hoveredPoint.grossRevenue)}
                  r={5.5}
                  className="historical-profit-chart__point historical-profit-chart__point--gross"
                />
                <circle
                  cx={model.x(hoveredPoint)}
                  cy={model.y(hoveredPoint.actualCostToDate)}
                  r={5.5}
                  className="historical-profit-chart__point historical-profit-chart__point--cost"
                />
                <circle
                  cx={model.x(hoveredPoint)}
                  cy={model.y(hoveredPoint.anticipatedCostToDate)}
                  r={5.5}
                  className="historical-profit-chart__point historical-profit-chart__point--anticipated"
                />
                <circle
                  cx={model.x(hoveredPoint)}
                  cy={model.y(hoveredPoint.netProfitToDate)}
                  r={5.5}
                  className="historical-profit-chart__point historical-profit-chart__point--net"
                />
                <circle
                  cx={model.x(hoveredPoint)}
                  cy={model.y(hoveredPoint.forecastNetProfitToDate)}
                  r={5.5}
                  className="historical-profit-chart__point historical-profit-chart__point--forecast-net"
                />
              </g>
            ) : null}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={PLOT_WIDTH}
              height={PLOT_HEIGHT}
              className={
                zoomAnchorDate
                  ? "historical-profit-chart__hit historical-profit-chart__hit--selecting"
                  : "historical-profit-chart__hit"
              }
              tabIndex={0}
              aria-label="Use the pointer or left and right arrow keys to inspect historical values. Press and drag, or click twice, to select and zoom into a date range."
              onPointerEnter={setNearestPoint}
              onPointerDown={handlePointerDown}
              onPointerMove={setNearestPoint}
              onPointerLeave={() => {
                clearInspection();
              }}
              onPointerUp={handlePointerUp}
              onPointerCancel={cancelZoomSelection}
              onFocus={() => inspectPoint(visiblePoints.length - 1)}
              onBlur={clearInspection}
              onKeyDown={moveByKeyboard}
            />
          </svg>

          {hoveredPoint && tooltipPosition ? (
            <div
              className="historical-profit-chart__tooltip"
              role="tooltip"
              style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}
            >
              <div className="historical-profit-chart__tooltip-header">
                <strong>{formatDate(hoveredPoint.date)}</strong>
                <span>Filtered portfolio</span>
              </div>
              <dl>
                <div>
                  <dt>
                    <i className="historical-profit-chart__tooltip-key historical-profit-chart__tooltip-key--gross" />
                    Gross revenue
                  </dt>
                  <dd>{fullCurrency(hoveredPoint.grossRevenue)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="historical-profit-chart__tooltip-key historical-profit-chart__tooltip-key--cost" />
                    Actual cost to date
                  </dt>
                  <dd>{fullCurrency(hoveredPoint.actualCostToDate)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="historical-profit-chart__tooltip-key historical-profit-chart__tooltip-key--anticipated" />
                    Anticipated cost to date
                  </dt>
                  <dd>{fullCurrency(hoveredPoint.anticipatedCostToDate)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="historical-profit-chart__tooltip-key historical-profit-chart__tooltip-key--net" />
                    Net profit to date
                  </dt>
                  <dd>{fullCurrency(hoveredPoint.netProfitToDate)}</dd>
                </div>
                <div className="historical-profit-chart__tooltip-total">
                  <dt>
                    <i className="historical-profit-chart__tooltip-key historical-profit-chart__tooltip-key--forecast-net" />
                    Forecasted net profit
                  </dt>
                  <dd>{fullCurrency(hoveredPoint.forecastNetProfitToDate)}</dd>
                </div>
              </dl>
              <div className="historical-profit-chart__tooltip-footer">
                <span>{hoveredPoint.projectCount} started</span>
                <span>{hoveredPoint.completedProjectCount} actually completed</span>
                <span>Revenue known for {hoveredPoint.grossRevenueKnownCount}</span>
                <span>Forecast cost known for {hoveredPoint.forecastCostKnownCount}</span>
                <span>Forecast profit known for {hoveredPoint.forecastProfitKnownCount}</span>
                <span>
                  Cost coverage: {hoveredPoint.costCoverageCompleteCount} complete ·{" "}
                  {hoveredPoint.costCoveragePartialCount} partial/missing
                </span>
                <span>
                  {hoveredPoint.costedTimeEntryCount} costed time entr
                  {hoveredPoint.costedTimeEntryCount === 1 ? "y" : "ies"}
                </span>
                <span>
                  {hoveredPoint.costedExpenseCount} costed expense
                  {hoveredPoint.costedExpenseCount === 1 ? "" : "s"}
                </span>
                {hoveredPoint.missingCostRecordCount ? (
                  <span>
                    {hoveredPoint.missingCostRecordCount} source record
                    {hoveredPoint.missingCostRecordCount === 1 ? "" : "s"} missing cost
                  </span>
                ) : null}
                {hoveredPoint.fallbackDatedLaborCount ? (
                  <span>
                    {hoveredPoint.fallbackDatedLaborCount} labor entr
                    {hoveredPoint.fallbackDatedLaborCount === 1 ? "y" : "ies"} assigned to project
                    start because the source date was missing or invalid
                  </span>
                ) : null}
                {hoveredPoint.fallbackDatedExpenseCount ? (
                  <span>
                    {hoveredPoint.fallbackDatedExpenseCount} expense
                    {hoveredPoint.fallbackDatedExpenseCount === 1 ? "" : "s"} dated by import
                    timestamp or project start
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="chart-empty">No project history is available for this date range.</div>
      )}

      {selectedSeries && Math.abs(selectedSeries.reconciliationDifference) > 0.05 ? (
        <p className="historical-profit-chart__integrity-warning" role="alert">
          Source transaction costs differ from the latest project-metric total by{" "}
          {fullCurrency(selectedSeries.reconciliationDifference)}. Run the calculation refresh and
          verification commands before relying on this historical result.
        </p>
      ) : null}
      <p className="historical-profit-chart__note">
        Gross revenue is recognized on each project start date. Actual labor cost is recognized on
        each valid Teamwork time-entry date using the historical cost total, or logged hours
        multiplied by the historical cost rate when a total is unavailable. Invalid legacy dates
        such as 1970 are excluded and reassigned to the project start date until the next Teamwork
        refresh repairs them. Expenses are recognized on their expense date; expenses without one
        use their import date or project start and are identified in the tooltip. Net profit to date
        equals gross revenue minus actual cost. Anticipated cost and forecasted net profit use the
        latest project forecast for every project started by the selected date; they are current
        projections arranged by project start date, not archived historical forecast snapshots.
      </p>
    </div>
  );
}
