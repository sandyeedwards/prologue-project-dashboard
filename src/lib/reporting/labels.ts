import type { ProfitabilityRow } from "@/components/profitability-chart-types";
import {
  profitabilityPlotComplete,
  resolveProfitabilityRow,
  type ProfitTone,
} from "@/lib/reporting/forecast-position";
import { marginTone } from "@/lib/reporting/margin-status";

/**
 * One vocabulary for reporting, taken from Company Overview. Use these instead of writing
 * labels inline so the same figure reads the same way on every page.
 */
export const REPORT_LABELS = {
  fee: "Fee",
  currentCosts: "Current Costs",
  estimatedRemainingCosts: "Estimated Remaining Costs",
  forecastCost: "Forecast Cost",
  projectedProfit: "Projected Profit",
  projectedLoss: "Projected Loss",
  knownProjectedProfit: "Known Projected Profit",
  forecastMargin: "Forecast Margin",
  marginCeiling: "Margin Ceiling",
  profitToDate: "Profit to date",
  marginToDate: "margin to date",
  /** All logged hours (planned and unplanned) divided by estimated hours. */
  hoursUsed: "Hours used",
  /** Only hours logged against estimated (planned) tasks, divided by estimated hours. */
  plannedHoursUsed: "Planned hours used",
  missing: "Missing",
  provisional: "Provisional",
} as const;

/** The one word for a value we do not have. Never shown as zero. */
export const MISSING = REPORT_LABELS.missing;

/** "Projected Loss" for a known negative profit, otherwise "Projected Profit". */
export function projectedProfitLabel(profit: number | null | undefined): string {
  return typeof profit === "number" && Number.isFinite(profit) && profit < 0
    ? REPORT_LABELS.projectedLoss
    : REPORT_LABELS.projectedProfit;
}

/**
 * Hours used = all logged hours (including unplanned) ÷ estimated hours, as a percentage.
 * Null when there is no estimate to compare against.
 */
export function hoursUsedPercent(
  loggedMinutes: number | null | undefined,
  estimatedMinutes: number | null | undefined,
): number | null {
  if (typeof loggedMinutes !== "number" || !Number.isFinite(loggedMinutes)) return null;
  if (typeof estimatedMinutes !== "number" || !Number.isFinite(estimatedMinutes)) return null;
  if (estimatedMinutes <= 0) return null;
  return (loggedMinutes / estimatedMinutes) * 100;
}

/** Hours-used percentages always show one decimal place. */
export function formatHoursUsed(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : MISSING;
}

export type MarginBand = "green" | "provisional" | "yellow" | "red" | "neutral";

/**
 * Margin band for counting projects. A provisional margin that would be "strong" is only a
 * ceiling, so it gets its own provisional band rather than the confirmed (green) one.
 */
export function marginBand(
  value: string | number | null | undefined,
  provisional: boolean,
): MarginBand {
  const tone = marginTone(value);
  return tone === "green" && provisional ? "provisional" : tone;
}

/** Descending numeric order with missing values always last. */
export function compareNullableDescending(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const aKnown = typeof a === "number" && Number.isFinite(a);
  const bKnown = typeof b === "number" && Number.isFinite(b);
  if (!aKnown || !bKnown) return aKnown === bKnown ? 0 : aKnown ? -1 : 1;
  return (b as number) - (a as number);
}

/** Stable tiebreak: project number (numeric-aware, missing last), then name. */
export function compareProjectIdentity(
  a: { projectNumber: string | null; name: string },
  b: { projectNumber: string | null; name: string },
): number {
  if (a.projectNumber !== b.projectNumber) {
    if (a.projectNumber === null) return 1;
    if (b.projectNumber === null) return -1;
    const byNumber = a.projectNumber.localeCompare(b.projectNumber, "en-US", { numeric: true });
    if (byNumber) return byNumber;
  }
  return a.name.localeCompare(b.name, "en-US");
}

export type ProfitabilityTotals = {
  /** Totals over the complete rows only; null when no row is complete. */
  revenue: number | null;
  cost: number | null;
  profit: number | null;
  margin: number | null;
  projects: number;
  includedCount: number;
  /** Rows left out because fee, forecast cost or profit is missing. */
  excludedCount: number;
  tone: ProfitTone;
};

/**
 * Totals a set of profitability rows over one consistent set: only rows whose fee, forecast
 * cost and profit are all known. Missing rows are counted, never added as zero, so revenue,
 * cost, profit and margin always describe the same rows.
 */
export function totalProfitabilityRows(rows: readonly ProfitabilityRow[]): ProfitabilityTotals {
  let revenue = 0,
    cost = 0,
    profit = 0,
    projects = 0,
    includedCount = 0,
    provisional = false;
  for (const row of rows) {
    const values = resolveProfitabilityRow(row);
    if (!profitabilityPlotComplete(values)) continue;
    includedCount += 1;
    revenue += values.revenue;
    cost += values.forecastCost;
    profit += values.profit;
    projects += row.projectCount ?? 0;
    if (row.provisional) provisional = true;
  }
  const excludedCount = rows.length - includedCount;
  if (!includedCount) {
    return {
      revenue: null,
      cost: null,
      profit: null,
      margin: null,
      projects: 0,
      includedCount,
      excludedCount,
      tone: "is-missing",
    };
  }
  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : null,
    projects,
    includedCount,
    excludedCount,
    tone: profit < 0 ? "is-loss" : provisional ? "is-provisional" : "is-profit",
  };
}
