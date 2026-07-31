export type ProfitabilityRow = {
  label: string;
  detail?: string;
  revenue: number | null;
  cost: number | null;
  actualCost?: number | null;
  remainingCost?: number | null;
  profit: number | null;
  margin?: number | null;
  projectCount?: number;
};
