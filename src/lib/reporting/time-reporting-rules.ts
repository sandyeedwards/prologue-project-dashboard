import { isTimeReportingProjectName } from "@/lib/teamwork/project-inclusion";

export const TIME_REPORTING_TIME_ZONE = "America/New_York";
export const DEFAULT_PTO_ALLOWANCE_MINUTES = 120 * 60;
export const EXPECTED_DAY_MINUTES = 8 * 60;
export const CLERICAL_WARNING_THRESHOLD = 0.1;

export const TIME_REPORTING_SOURCE_NAMES = {
  officeTime: "Office Time",
  outOfOffice: "Out Of Office",
  specialInitiatives: "Special Initiatives",
  pto: "PTO",
  clerical: "Clerical (routine tasks, day-to-day office tasks)",
} as const;

export const TIME_REPORTING_PRESETS = ["week", "month", "3m", "6m", "1y", "custom"] as const;

export type TimeReportingPreset = (typeof TIME_REPORTING_PRESETS)[number];

export type TimeReportingCategory =
  "BILLABLE" | "OFFICE_TIME" | "OUT_OF_OFFICE" | "SPECIAL_INITIATIVES" | "OTHER_NON_BILLABLE";

export type TimeReportingRange = {
  preset: TimeReportingPreset;
  startDate: string;
  endDate: string;
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;

  return dateOnly(parsed) === value ? parsed : null;
}

function shiftMonths(value: Date, amount: number): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();

  const target = new Date(Date.UTC(year, month + amount, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));

  return target;
}

function startOfMondayWeek(value: Date): Date {
  const result = new Date(value.valueOf());
  const day = result.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;

  result.setUTCDate(result.getUTCDate() - offset);

  return result;
}

export function currentTimeReportingDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_REPORTING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function normalizeTimeReportingPreset(
  value: string | null | undefined,
): TimeReportingPreset {
  return TIME_REPORTING_PRESETS.includes(value as TimeReportingPreset)
    ? (value as TimeReportingPreset)
    : "month";
}

export function resolveTimeReportingRange(
  input: {
    preset?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } = {},
  now = new Date(),
): TimeReportingRange {
  const preset = normalizeTimeReportingPreset(input.preset);
  const todayText = currentTimeReportingDate(now);
  const today = parseDateOnly(todayText);

  if (!today) {
    throw new Error("Could not resolve the current Time Reporting date.");
  }

  if (preset === "custom") {
    const customStart = parseDateOnly(input.startDate);
    const customEnd = parseDateOnly(input.endDate);

    if (customStart && customEnd && customStart.valueOf() <= customEnd.valueOf()) {
      return {
        preset,
        startDate: dateOnly(customStart),
        endDate: dateOnly(customEnd),
      };
    }

    return {
      preset: "month",
      startDate: `${todayText.slice(0, 7)}-01`,
      endDate: todayText,
    };
  }

  if (preset === "week") {
    return {
      preset,
      startDate: dateOnly(startOfMondayWeek(today)),
      endDate: todayText,
    };
  }

  if (preset === "month") {
    return {
      preset,
      startDate: `${todayText.slice(0, 7)}-01`,
      endDate: todayText,
    };
  }

  const monthsBack = preset === "3m" ? 3 : preset === "6m" ? 6 : 12;

  return {
    preset,
    startDate: dateOnly(shiftMonths(today, -monthsBack)),
    endDate: todayText,
  };
}

export function businessDaysBetween(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || start.valueOf() > end.valueOf()) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start.valueOf());

  while (cursor.valueOf() <= end.valueOf()) {
    const day = cursor.getUTCDay();

    if (day !== 0 && day !== 6) count += 1;

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

export function expectedMinutesForRange(
  range: Pick<TimeReportingRange, "startDate" | "endDate">,
  today = currentTimeReportingDate(),
): number {
  const effectiveEnd = range.endDate > today ? today : range.endDate;

  if (effectiveEnd < range.startDate) return 0;

  return businessDaysBetween(range.startDate, effectiveEnd) * EXPECTED_DAY_MINUTES;
}

function sourceKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function classifyTimeReportingEntry(input: {
  projectName: string | null | undefined;
  taskListName?: string | null;
}): TimeReportingCategory {
  if (!isTimeReportingProjectName(input.projectName)) {
    return "BILLABLE";
  }

  const taskList = sourceKey(input.taskListName);

  if (taskList === sourceKey(TIME_REPORTING_SOURCE_NAMES.officeTime)) {
    return "OFFICE_TIME";
  }

  if (taskList === sourceKey(TIME_REPORTING_SOURCE_NAMES.outOfOffice)) {
    return "OUT_OF_OFFICE";
  }

  if (taskList === sourceKey(TIME_REPORTING_SOURCE_NAMES.specialInitiatives)) {
    return "SPECIAL_INITIATIVES";
  }

  return "OTHER_NON_BILLABLE";
}

export function isPtoTime(input: {
  projectName: string | null | undefined;
  taskListName?: string | null;
  taskName?: string | null;
}): boolean {
  return (
    isTimeReportingProjectName(input.projectName) &&
    sourceKey(input.taskListName) === sourceKey(TIME_REPORTING_SOURCE_NAMES.outOfOffice) &&
    sourceKey(input.taskName) === sourceKey(TIME_REPORTING_SOURCE_NAMES.pto)
  );
}

export function isClericalTime(input: {
  projectName: string | null | undefined;
  taskListName?: string | null;
  taskName?: string | null;
}): boolean {
  return (
    isTimeReportingProjectName(input.projectName) &&
    sourceKey(input.taskListName) === sourceKey(TIME_REPORTING_SOURCE_NAMES.officeTime) &&
    sourceKey(input.taskName) === sourceKey(TIME_REPORTING_SOURCE_NAMES.clerical)
  );
}

export function clericalShare(
  clericalMinutes: number,
  totalMinutes: number,
): {
  ratio: number;
  percent: number;
  warning: boolean;
} {
  const ratio = totalMinutes > 0 ? clericalMinutes / totalMinutes : 0;

  return {
    ratio,
    percent: ratio * 100,
    warning: ratio > CLERICAL_WARNING_THRESHOLD,
  };
}
