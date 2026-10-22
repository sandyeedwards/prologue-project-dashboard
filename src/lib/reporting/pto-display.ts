export const PTO_DAY_MINUTES = 8 * 60;

function decimal(value: number, maximumFractionDigits: number): string {
  const normalized = Math.abs(value) < 0.000_001 ? 0 : value;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(normalized);
}

export function ptoDays(minutes: number): number {
  return minutes / PTO_DAY_MINUTES;
}

export function ptoDaysLabel(minutes: number): string {
  return `${decimal(ptoDays(minutes), 2)}d`;
}

export function ptoDaysLongLabel(minutes: number): string {
  const days = ptoDays(minutes);
  return `${decimal(days, 2)} day${Math.abs(days) === 1 ? "" : "s"}`;
}

export function ptoHoursLabel(minutes: number): string {
  return `${decimal(minutes / 60, 2)}h`;
}
