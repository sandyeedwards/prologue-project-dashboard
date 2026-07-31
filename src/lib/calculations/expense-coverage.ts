import type { Coverage } from "./types";

export function resolveExpenseCoverage({
  hasOutsourcedTask,
  expenseValues,
}: {
  hasOutsourcedTask: boolean;
  expenseValues: Array<number | null>;
}): Coverage {
  if (expenseValues.length === 0) return hasOutsourcedTask ? "MISSING" : "NOT_EXPECTED";
  const known = expenseValues.filter((value): value is number => value !== null).length;
  if (known === 0) return "MISSING";
  if (known === expenseValues.length) return "COMPLETE";
  return "PARTIAL";
}
