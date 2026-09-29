import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/session";
import { getTimeReportingReport } from "@/lib/reporting/time-reporting-data";
import { updatePtoAllowance } from "./actions";

export const dynamic = "force-dynamic";

const PTO_DAY_MINUTES = 8 * 60;

function hoursLabel(minutes: number): string {
  const value = minutes / 60;

  return Number.isInteger(value) ? `${value.toFixed(0)}h` : `${value.toFixed(1)}h`;
}

function daysValue(minutes: number): number {
  return minutes / PTO_DAY_MINUTES;
}

function allowanceDaysInput(minutes: number): string {
  const days = minutes / PTO_DAY_MINUTES;

  return Number.isInteger(days) ? String(days) : days.toFixed(1);
}

export default async function AllPtoPage() {
  const session = await requireRole("ADMIN", "/time-reporting/pto/all");

  const report = await getTimeReportingReport();

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide time-reporting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Calendar year {report.ptoYear}</p>

            <h1>All PTO</h1>

            <p>
              Review PTO usage across the team and manage individual annual allowances directly from
              each employee card.
            </p>
          </div>
        </section>

        <nav className="time-reporting-subnav" aria-label="Time Reporting sections">
          <Link href="/time-reporting" className="time-reporting-subnav__item">
            <strong>Overview</strong>
            <span>Utilization &amp; employee time</span>
          </Link>

          <Link href="/time-reporting/pto" className="time-reporting-subnav__item">
            <strong>My PTO</strong>
            <span>My annual PTO balance</span>
          </Link>

          <Link
            href="/time-reporting/pto/all"
            className="time-reporting-subnav__item time-reporting-subnav__item--active"
          >
            <strong>All PTO</strong>
            <span>Balances &amp; allowances</span>
          </Link>
        </nav>

        <section className="pto-admin-heading">
          <div>
            <p className="eyebrow">Administrator view</p>
            <h2>Employee PTO Balances</h2>

            <p>
              The standard allowance is 120 hours, or 15 eight-hour days. Individual annual
              allowances can be changed below.
            </p>
          </div>

          <span className="report-date-chip">{report.employees.length} employees</span>
        </section>

        <section className="pto-admin-grid">
          {report.employees.map((employee) => {
            const usedPercent =
              employee.ptoAllowanceMinutes > 0
                ? (employee.ptoUsedMinutes / employee.ptoAllowanceMinutes) * 100
                : 0;

            const cappedUsedPercent = Math.max(0, Math.min(100, usedPercent));

            const overAllowance = employee.ptoRemainingMinutes < 0;

            return (
              <article
                className={
                  overAllowance ? "pto-admin-card pto-admin-card--warning" : "pto-admin-card"
                }
                key={employee.personId}
              >
                <header className="pto-admin-card__header">
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{usedPercent.toFixed(1)}% of allowance used</span>
                  </div>

                  <div
                    className={
                      overAllowance
                        ? "pto-admin-card__balance pto-admin-card__balance--warning"
                        : "pto-admin-card__balance"
                    }
                  >
                    {daysValue(employee.ptoRemainingMinutes).toFixed(1)}d remaining
                  </div>
                </header>

                <div className="pto-admin-progress">
                  <span
                    className={
                      overAllowance
                        ? "pto-admin-progress__used pto-admin-progress__used--over"
                        : "pto-admin-progress__used"
                    }
                    style={{
                      width: `${cappedUsedPercent}%`,
                    }}
                  />
                </div>

                <div className="pto-admin-card__metrics">
                  <div>
                    <span>Used</span>
                    <strong>{daysValue(employee.ptoUsedMinutes).toFixed(1)}d</strong>
                    <small>{hoursLabel(employee.ptoUsedMinutes)}</small>
                  </div>

                  <div>
                    <span>Allowance</span>
                    <strong>{daysValue(employee.ptoAllowanceMinutes).toFixed(1)}d</strong>
                    <small>{hoursLabel(employee.ptoAllowanceMinutes)}</small>
                  </div>

                  <div>
                    <span>Remaining</span>
                    <strong>{daysValue(employee.ptoRemainingMinutes).toFixed(1)}d</strong>
                    <small>{hoursLabel(employee.ptoRemainingMinutes)}</small>
                  </div>
                </div>

                <form className="pto-admin-card__editor" action={updatePtoAllowance}>
                  <input type="hidden" name="personId" value={employee.personId} />

                  <input type="hidden" name="calendarYear" value={report.ptoYear} />

                  <label>
                    <span>Annual allowance</span>

                    <div>
                      <input
                        type="number"
                        name="allowanceDays"
                        min="0"
                        step="0.5"
                        defaultValue={allowanceDaysInput(employee.ptoAllowanceMinutes)}
                        aria-label={`${employee.name} annual PTO allowance in days`}
                      />

                      <small>days (8h/day)</small>
                    </div>
                  </label>

                  <button className="button button--primary button--compact" type="submit">
                    Save Allowance
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
