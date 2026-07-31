/**
 * Teamwork's project-budget monetary fields are returned in the currency's
 * minor unit. For USD, 12000000 represents $120,000.00. Percentage fields
 * such as budgetProfitMargin are not minor-unit values and must not use this
 * conversion.
 */
export function teamworkBudgetMoney(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value / 100;
}

export type TeamworkExpenseSource = "LEGACY" | "BUDGET";

/**
 * Expense values use different units across Teamwork endpoints:
 *
 * - `/expenses.json` returns currency-unit decimals such as 1950.00.
 * - `/projects/api/v3/projects/budgets/:id/expenses.json` returns minor units,
 *   where 195000 represents $1,950.00.
 *
 * The source must therefore travel with each expense until it is normalized.
 */
export function teamworkExpenseMoney(
  value: number | null,
  source: TeamworkExpenseSource,
): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return source === "BUDGET" ? value / 100 : value;
}
