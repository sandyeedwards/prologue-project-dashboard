export type ProfitabilityRow = {
  label: string;
  detail?: string;
  revenue: number | null;
  cost: number | null;
  actualCost?: number | null;
  remainingCost?: number | null;
  /** Outsourced modeling vendor bills inside the cost (actual cost, never estimated). */
  outsourcedCost?: number | null;
  /** Admin: cost with no share of the fee. Shown as cost only, never as a loss. */
  costOnly?: boolean;
  profit: number | null;
  margin?: number | null;
  projectCount?: number;
  /** True when any included project's forecast is provisional; profit is then never green. */
  provisional?: boolean;
};
