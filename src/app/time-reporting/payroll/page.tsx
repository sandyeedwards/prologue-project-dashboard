import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PayrollFilters } from "@/components/payroll-filters";
import { requireRole } from "@/lib/auth/session";
import { getPayrollReport, payrollStatus } from "@/lib/reporting/payroll-data";
import { payPeriod, PTO_LOCK_DAYS } from "@/lib/reporting/pay-period";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireRole("ADMIN", "/time-reporting/payroll");
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["date", "type", "employee", "project"]) {
    const value = raw[key];
    if (typeof value === "string") params.set(key, value);
  }
  let invalidDate = false;
  try {
    payPeriod(params.get("date") || undefined);
  } catch {
    params.delete("date");
    invalidDate = true;
  }
  const report = await getPayrollReport(params);
  params.set("date", report.period.startDate);
  if (report.ptoOnly) params.delete("project");
  const employees = [...new Map(report.all.map((r) => [r.person_id, r.employee_name])).entries()];
  const projects = [...new Map(report.all.map((r) => [r.project_id, r.project_name])).entries()];
  const hours = report.rows.reduce((sum, row) => sum + row.minutes, 0) / 60;
  const changes = report.rows.filter((row) => row.changed_after_lock).length;
  const csv = `/api/payroll/export?${params.toString()}`;
  const pdf = `${csv}&format=pdf`;
  return (
    <AppShell user={user} contentTone="portfolio">
      <main className="shell shell--wide payroll-page">
        <header className="report-titlebar">
          <div>
            <p className="eyebrow">Payroll administration</p>
            <h1>Pay-period time exports</h1>
            <p>
              {report.period.startDate} through {report.period.endDate} · 1st–15th / 16th–month end
            </p>
          </div>
          <Link href="/time-reporting" className="button button--secondary">
            Back to Time Reporting
          </Link>
        </header>
        {invalidDate ? <p role="alert">Invalid date; showing the current pay period.</p> : null}
        <PayrollFilters
          date={report.period.startDate}
          ptoOnly={report.ptoOnly}
          employee={report.employee}
          project={report.project}
          employees={employees}
          projects={projects}
        />
        <section className="notice">
          <strong>
            {hours.toFixed(2)} hours · {report.rows.length} entries
          </strong>
          <p>
            PTO locks {PTO_LOCK_DAYS} days after its work date. Locked hours are preserved when
            Teamwork changes. Other time remains live. Old entries first captured by this feature
            are labeled “initial baseline”.
          </p>
          <p>
            {changes} locked entries have source changes requiring review. Deletions can only be
            flagged once received by the sync.
          </p>
          <p>
            CSV contains exact minutes and Teamwork employee IDs. It is a general payroll export;
            ADP import mapping still requires your administrator’s template.
          </p>
          <div className="payroll-actions">
            {report.rows.length ? (
              <>
                <a className="button" href={pdf}>
                  Download PDF
                </a>
                <a className="button button--secondary" href={csv}>
                  Download CSV
                </a>
              </>
            ) : (
              <span className="payroll-export-empty" role="status">
                There is no {report.ptoOnly ? "PTO " : ""}time to export for this pay period.
              </span>
            )}
          </div>
        </section>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work date</th>
                <th>Project / task</th>
                <th>Type</th>
                <th>Hours</th>
                <th>Payroll status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.teamwork_id}>
                  <td>{row.employee_name}</td>
                  <td>{row.logged_date}</td>
                  <td>
                    {row.project_name}
                    <br />
                    <small>{row.task_name}</small>
                  </td>
                  <td>{row.is_pto ? "PTO" : "Time"}</td>
                  <td>{(row.minutes / 60).toFixed(2)}</td>
                  <td>{payrollStatus(row, report.today)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.rows.length ? (
            <p className="empty-panel">No time entries match these filters.</p>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
