import { firstValue, isRecord } from "./fields";

const MIN_TEAMWORK_DATE = "2000-01-01";

const NESTED_DATE_PATHS = [
  "timeLogged",
  "date",
  "dateTime",
  "datetime",
  "value",
  "iso",
  "utc",
  "timestamp",
  "dateCreated",
  "createdAt",
] as const;

function validCalendarDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized) return null;
  return normalized >= MIN_TEAMWORK_DATE ? normalized : null;
}

function compactCalendarDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return match ? validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

/**
 * Normalizes Teamwork calendar-date values without shifting a logged date across
 * time zones. V3 time entries expose the logged date as `timeLogged`, while
 * older payloads and nested relationship shapes can use several date wrappers.
 */
export function teamworkDateText(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return null;
    const normalized = value.toISOString().slice(0, 10);
    return normalized >= MIN_TEAMWORK_DATE ? normalized : null;
  }

  if (typeof value === "bigint") return teamworkDateText(Number(value));

  if (typeof value === "number" && Number.isFinite(value)) {
    const integerText = Number.isInteger(value) ? String(value) : "";
    const compact = compactCalendarDate(integerText);
    if (compact) return compact;

    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    if (Number.isNaN(parsed.valueOf())) return null;
    const normalized = parsed.toISOString().slice(0, 10);
    return normalized >= MIN_TEAMWORK_DATE ? normalized : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const compact = compactCalendarDate(trimmed);
    if (compact) return compact;

    const calendarPrefix = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(trimmed);
    if (calendarPrefix) {
      return validCalendarDate(
        Number(calendarPrefix[1]),
        Number(calendarPrefix[2]),
        Number(calendarPrefix[3]),
      );
    }

    if (/^\d{10,13}$/.test(trimmed)) {
      return teamworkDateText(Number(trimmed));
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.valueOf())) return null;
    const normalized = parsed.toISOString().slice(0, 10);
    return normalized >= MIN_TEAMWORK_DATE ? normalized : null;
  }

  if (isRecord(value)) {
    const nested = firstValue(value, NESTED_DATE_PATHS);
    if (nested !== undefined && nested !== value) return teamworkDateText(nested);
  }

  return null;
}
