import type { ProfitabilityRow } from "@/components/profitability-chart-types";

// Shared rules for showing a profit forecast without inventing numbers:
// a missing value stays missing (never $0), and a provisional result is never shown as a
// confirmed (green) profit.

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export type ResolvedProfitabilityRow = {
  revenue: number;
  actual: number;
  remaining: number;
  forecastCost: number;
  profit: number;
  margin: number | null;
  /** Which values come from real data. Unknown values are placeholders of 0 for layout only. */
  known: {
    revenue: boolean;
    actual: boolean;
    remaining: boolean;
    forecastCost: boolean;
    profit: boolean;
  };
};

export function resolveProfitabilityRow(row: ProfitabilityRow): ResolvedProfitabilityRow {
  const revenueKnown = finite(row.revenue);
  const actualKnown = finite(row.actualCost);
  const costKnown = finite(row.cost);
  const remainingGiven = finite(row.remainingCost);
  const revenue = revenueKnown ? Math.max(row.revenue as number, 0) : 0;
  const actual = actualKnown ? Math.max(row.actualCost as number, 0) : 0;
  const remainingKnown = remainingGiven || (costKnown && actualKnown);
  const remaining = remainingGiven
    ? Math.max(row.remainingCost as number, 0)
    : costKnown && actualKnown
      ? Math.max((row.cost as number) - actual, 0)
      : 0;
  const forecastCostKnown = costKnown || (actualKnown && remainingKnown);
  const forecastCost = costKnown ? Math.max(row.cost as number, 0) : actual + remaining;
  const profitKnown = finite(row.profit) || (revenueKnown && forecastCostKnown);
  const profit = finite(row.profit) ? row.profit : revenue - forecastCost;
  const margin = finite(row.margin)
    ? row.margin
    : profitKnown && revenueKnown && revenue > 0
      ? (profit / revenue) * 100
      : null;
  return {
    revenue,
    actual,
    remaining,
    forecastCost,
    profit,
    margin,
    known: {
      revenue: revenueKnown,
      actual: actualKnown,
      remaining: remainingKnown,
      forecastCost: forecastCostKnown,
      profit: profitKnown,
    },
  };
}

/** Bars are drawn only when revenue, forecast cost and profit are all real values. */
export function profitabilityPlotComplete(values: ResolvedProfitabilityRow): boolean {
  return values.known.revenue && values.known.forecastCost && values.known.profit;
}

export type ProfitTone = "is-loss" | "is-profit" | "is-provisional" | "is-missing";

export function profitTone(
  row: Pick<ProfitabilityRow, "provisional">,
  values: ResolvedProfitabilityRow,
): ProfitTone {
  if (!values.known.profit) return "is-missing";
  if (values.profit < 0) return "is-loss";
  return row.provisional ? "is-provisional" : "is-profit";
}

export function profitLabel(
  row: Pick<ProfitabilityRow, "provisional">,
  values: ResolvedProfitabilityRow,
): string {
  if (values.known.profit && values.profit < 0) return "Projected Loss";
  return row.provisional && values.known.profit ? "Known Projected Profit" : "Projected Profit";
}

export type ForecastProject = {
  clientFee: string | number | null;
  actualTotalCost: string | number | null;
  forecastCost: string | number | null;
  isProvisional: boolean;
};

export type CombinedForecast = {
  revenue: number;
  actualCost: number;
  remainingCost: number;
  forecastCost: number;
  profit: number;
  margin: number | null;
  includedCount: number;
  excludedCount: number;
  provisionalCount: number;
};

function amount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Combines project forecasts over one consistent set: only projects whose client fee, current
 * costs and forecast cost are all known. Revenue, costs, profit and margin then describe the
 * same projects, and the excluded projects are counted rather than added as zero.
 * Profit = client fee − forecast cost (the shared engine's definition).
 */
export function combineProjectForecasts(
  projects: readonly ForecastProject[],
): CombinedForecast | null {
  let revenue = 0,
    actualCost = 0,
    remainingCost = 0,
    forecastCost = 0,
    includedCount = 0,
    provisionalCount = 0;
  for (const project of projects) {
    const fee = amount(project.clientFee);
    const actual = amount(project.actualTotalCost);
    const cost = amount(project.forecastCost);
    if (fee === null || actual === null || cost === null) continue;
    includedCount += 1;
    revenue += fee;
    actualCost += actual;
    forecastCost += cost;
    remainingCost += Math.max(cost - actual, 0);
    if (project.isProvisional) provisionalCount += 1;
  }
  if (!includedCount) return null;
  const profit = revenue - forecastCost;
  return {
    revenue,
    actualCost,
    remainingCost,
    forecastCost,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : null,
    includedCount,
    excludedCount: projects.length - includedCount,
    provisionalCount,
  };
}
