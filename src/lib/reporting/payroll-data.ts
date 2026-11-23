import { getSqlClient } from "@/db/client";
import { isTimeReportingProjectName } from "@/lib/teamwork/project-inclusion";
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

/**
 * Same rule as the Time Reporting dashboard: time on any project other than Internal Operations
 * is billable; Teamwork's own billable flag is ignored. PTO lives in Internal Operations and is
 * never billable.
 */
export function isBillableTime(entry: { is_pto: boolean; project_name: string | null }) {
  return !entry.is_pto && !isTimeReportingProjectName(entry.project_name);
}

type PayrollDbRow = Omit<PayrollRow, "is_billable">;

export async function getPayrollReport(params: URLSearchParams) {
  const period = payPeriod(params.get("date") || undefined);
  const sql = getSqlClient();
  // PTO ledger refresh (refresh_payroll_pto) runs as part of every Teamwork sync, and the source
  // time only changes during a sync, so reads here never write. Dates are cast to text so
  // postgres.js returns plain YYYY-MM-DD strings, not Date objects. People filtering matches the
  // Time Reporting dashboard: entries need a person, and client users / service accounts are
  // excluded (inactive people stay so final pay periods still export).
  const dbRows = await sql<PayrollDbRow[]>`
    select
      p.teamwork_id::text as teamwork_id,
      p.person_id::text as person_id,
      p.employee_name,
      p.employee_teamwork_id::text as employee_teamwork_id,
      p.project_id::text as project_id,
      p.project_name,
      p.task_name,
      p.logged_date::text as logged_date,
      p.minutes,
      p.description,
      p.is_pto,
      p.lock_on::text as lock_on,
      p.baseline,
      p.changed_after_lock
    from payroll_export_time p
    join people person on person.id = p.person_id
    where p.logged_date between ${period.startDate}::date and ${period.endDate}::date
      and person.is_client_user = false
      and person.is_service_account = false
      and person.is_active = true
    order by p.employee_name, p.logged_date, p.teamwork_id
  `;
  const all: PayrollRow[] = dbRows.map((row) => ({ ...row, is_billable: isBillableTime(row) }));
  const syncRows = await sql<{ last_sync_at: Date | null }[]>`
    select max(last_sync_at) as last_sync_at
    from teamwork_connections
    where is_active = true
  `;
  const lastSyncAt = syncRows[0]?.last_sync_at ?? null;
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
  return { period, rows, all, today, employee, project, ptoOnly, lastSyncAt };
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
