export function teamworkUserCostRate(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;

  return value / 100;
}
