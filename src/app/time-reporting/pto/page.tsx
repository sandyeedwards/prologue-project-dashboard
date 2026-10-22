import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import { ptoDaysLabel, ptoDaysLongLabel, ptoHoursLabel } from "@/lib/reporting/pto-display";
import { getTimeReportingReport } from "@/lib/reporting/time-reporting-data";

export const dynamic = "force-dynamic";

export default async function MyPtoPage() {
  const session = await requireUser("/time-reporting/pto");
  const report = await getTimeReportingReport();

  const employee = report.employees.find((row) => row.teamworkId === session.user.teamworkUserId);

  const usedPercent =
    employee && employee.ptoAllowanceMinutes > 0
      ? (employee.ptoUsedMinutes / employee.ptoAllowanceMinutes) * 100
      : 0;

  const cappedUsedPercent = Math.max(0, Math.min(100, usedPercent));

  const overAllowance = employee ? employee.ptoRemainingMinutes < 0 : false;

  const ringColor = overAllowance ? "#c9413b" : "#2b78d0";

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide time-reporting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Calendar year {report.ptoYear}</p>

            <h1>My PTO</h1>

            <p>
              See your annual PTO allowance as days and hours, including how much you have used and
              how much remains.
            </p>
          </div>
        </section>

        <nav className="time-reporting-subnav" aria-label="Time Reporting sections">
          <Link href="/time-reporting" className="time-reporting-subnav__item">
            <strong>Overview</strong>
            <span>Utilization &amp; employee time</span>
          </Link>

          <Link
            href="/time-reporting/pto"
            className="time-reporting-subnav__item time-reporting-subnav__item--active"
          >
            <strong>My PTO</strong>
            <span>My annual PTO balance</span>
          </Link>

          {session.user.role === "ADMIN" ? (
            <Link href="/time-reporting/pto/all" className="time-reporting-subnav__item">
              <strong>All PTO</strong>
              <span>Balances &amp; allowances</span>
            </Link>
          ) : null}
        </nav>

        {employee ? (
          <>
            <section className="pto-visual-card">
              <div
                className="pto-usage-ring"
                style={{
                  background: `conic-gradient(${ringColor} ${cappedUsedPercent}%, #e8eef6 ${cappedUsedPercent}% 100%)`,
                }}
                aria-label={`${usedPercent.toFixed(1)}% of annual PTO allowance used`}
              >
                <div className="pto-usage-ring__inner">
                  <strong>{ptoDaysLabel(employee.ptoUsedMinutes).replace("d", "")}</strong>

                  <span>days used</span>

                  <small>of {ptoDaysLabel(employee.ptoAllowanceMinutes)}</small>
                </div>
              </div>

              <div className="pto-visual-card__content">
                <p className="eyebrow">{employee.name}</p>

                <h2 className={overAllowance ? "pto-value--warning" : undefined}>
                  {overAllowance
                    ? `${ptoDaysLongLabel(Math.abs(employee.ptoRemainingMinutes))} over allowance`
                    : `${ptoDaysLongLabel(employee.ptoRemainingMinutes)} remaining`}
                </h2>

                <p>
                  You have used <strong>{ptoDaysLongLabel(employee.ptoUsedMinutes)}</strong> (
                  {ptoHoursLabel(employee.ptoUsedMinutes)}) of your{" "}
                  <strong>{ptoDaysLongLabel(employee.ptoAllowanceMinutes)}</strong> annual
                  allowance.
                </p>

                <div className="pto-progress">
                  <div className="pto-progress__track">
                    <span
                      className={
                        overAllowance
                          ? "pto-progress__used pto-progress__used--over"
                          : "pto-progress__used"
                      }
                      style={{
                        width: `${cappedUsedPercent}%`,
                      }}
                    />
                  </div>

                  <div className="pto-progress__labels">
                    <span>
                      <strong>{ptoHoursLabel(employee.ptoUsedMinutes)}</strong> used
                    </span>

                    <span>
                      <strong>{ptoHoursLabel(employee.ptoAllowanceMinutes)}</strong> allowed
                    </span>
                  </div>
                </div>

                <div className="pto-visual-card__percent">
                  {usedPercent.toFixed(1)}% of annual allowance used
                </div>
              </div>
            </section>

            <section className="pto-stat-grid">
              <article className="pto-stat-card">
                <span>Annual Allowance</span>
                <strong>{ptoDaysLabel(employee.ptoAllowanceMinutes)}</strong>
                <small>{ptoHoursLabel(employee.ptoAllowanceMinutes)}</small>
              </article>

              <article
                className={overAllowance ? "pto-stat-card pto-stat-card--warning" : "pto-stat-card"}
              >
                <span>PTO Used</span>
                <strong>{ptoDaysLabel(employee.ptoUsedMinutes)}</strong>
                <small>{ptoHoursLabel(employee.ptoUsedMinutes)}</small>
              </article>

              <article
                className={overAllowance ? "pto-stat-card pto-stat-card--warning" : "pto-stat-card"}
              >
                <span>{overAllowance ? "PTO Over Allowance" : "PTO Remaining"}</span>
                <strong>{ptoDaysLabel(Math.abs(employee.ptoRemainingMinutes))}</strong>
                <small>{ptoHoursLabel(Math.abs(employee.ptoRemainingMinutes))}</small>
              </article>
            </section>

            <section className="time-reporting-panel pto-policy-card">
              <div className="time-reporting-panel__header">
                <div>
                  <p className="eyebrow">How PTO is calculated</p>
                  <h2>Annual PTO Balance</h2>

                  <p>
                    PTO is read from Internal Operations → Out Of Office → PTO. One PTO day equals
                    eight hours. Balances reset January 1 with no carryover. The standard annual
                    allowance is 120 hours unless an administrator assigns an individual allowance.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="time-reporting-panel">
            <div className="time-reporting-panel__empty">
              Your signed-in Teamwork account could not be matched to an active PTO record.
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
