import { currentTimeReportingDate } from "./time-reporting-rules";

export function payPeriod(date = currentTimeReportingDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid pay-period date");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid pay-period date");
  }
  const month = date.slice(0, 7);
  const second = parsed.getUTCDate() >= 15;
  const last = new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return {
    startDate: `${month}-${second ? "15" : "01"}`,
    endDate: `${month}-${second ? last : "14"}`,
  };
}

export function ptoLockDate(workDate: string) {
  payPeriod(workDate);
  const date = new Date(`${workDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
