import { getSqlClient } from "@/db/client";
import { currentTimeReportingDate } from "./time-reporting-rules";
import { payPeriod, csvCell } from "./pay-period";

export type PayrollRow = {
  teamwork_id: string;
  person_id: string | null;
  employee_name: string;
  employee_teamwork_id: string | null;
  project_id: string;
  project_name: string;
  task_name: string;
  logged_date: string;
  minutes: number;
  description: string | null;
  is_pto: boolean;
  is_billable: boolean;
  lock_on: string | null;
  baseline: boolean;
  changed_after_lock: boolean;
};

export async function getPayrollReport(params: URLSearchParams) {
  const period = payPeriod(params.get("date") || undefined);
  const sql = getSqlClient();
  await sql`select refresh_payroll_pto()`;
  const all = await sql<PayrollRow[]>`
    select * from payroll_export_time
    where logged_date between ${period.startDate}::date and ${period.endDate}::date
    order by employee_name, logged_date, teamwork_id
  `;
  const employee = params.get("employee") || "";
  const ptoOnly = params.get("type") === "pto";
  const project = ptoOnly ? "" : params.get("project") || "";
  const rows = all.filter(
    (row) =>
      (!employee || row.person_id === employee) &&
      (!project || row.project_id === project) &&
      (!ptoOnly || row.is_pto),
  );
  const today = currentTimeReportingDate();
  return { period, rows, all, today, employee, project, ptoOnly };
}

export function payrollStatus(row: PayrollRow, today: string) {
  if (!row.is_pto) return "Live time";
  if (row.lock_on && row.lock_on <= today) {
    return row.changed_after_lock
      ? "Locked - source change requires review"
      : row.baseline
        ? "Locked - initial baseline"
        : "Locked";
  }
  return `Editable until ${row.lock_on}`;
}

export function payrollCsv(
  rows: PayrollRow[],
  _today: string,
  period: { startDate: string; endDate: string },
) {
  const headers = [
    "Employee Name",
    "Source Employee ID",
    "Work date",
    "Hours",
    "Minutes",
    "Earnings Code",
    "Project",
    "Task",
    "Description",
    "Source Entry ID",
    "Period Start",
    "Period End",
  ];
  return (
    "\uFEFF" +
    [
      headers,
      ...rows.map((row) => [
        row.employee_name,
        row.employee_teamwork_id,
        row.logged_date,
        (row.minutes / 60).toFixed(4),
        row.minutes,
        row.is_pto ? "PTO" : row.is_billable ? "REGULAR" : "NON-BILLABLE",
        row.project_name,
        row.task_name,
        row.description,
        row.teamwork_id,
        period.startDate,
        period.endDate,
      ]),
    ]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\r\n")
  );
}
