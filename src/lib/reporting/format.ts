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

export const BUSINESS_TIME_ZONE = "America/New_York";

/** The calendar date (YYYY-MM-DD) in Eastern time, which is the business day. */
export function easternIsoDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isUtcMidnight(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

/**
 * Formats a date for display. Plain dates (YYYY-MM-DD, or a database date that
 * arrives as UTC midnight) keep their calendar day; timestamps are shown on the
 * Eastern business day, whatever the server's own time zone is.
 */
export function dateLabel(value: string | Date | null | undefined): string {
  if (!value) return "Not set";
  const plainDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = value instanceof Date ? value : new Date(plainDate ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: plainDate || isUtcMidnight(date) ? "UTC" : BUSINESS_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function reportingTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "Not run";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}
