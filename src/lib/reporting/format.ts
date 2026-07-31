export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Missing";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Missing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

export function percent(value: string | number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === "") return "Missing";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "Missing";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(parsed)}%`;
}

export function hours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "Missing";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
}

export function dateLabel(value: string | Date | null | undefined): string {
  if (!value) return "Not set";
  const date =
    value instanceof Date
      ? value
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
