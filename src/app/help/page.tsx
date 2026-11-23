import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const session = await requireUser("/help");
  const canManageLabor = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  const isAdmin = session.user.role === "ADMIN";

  return (
    <AppShell user={session.user}>
      <main className="shell shell--wide">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Help &amp; administration</p>
            <h1>Guide</h1>
            <p>
              What each page shows, what the colours mean, and how to fix data that looks wrong.
            </p>
          </div>
          <div className="report-titlebar__actions">
            <Link className="button button--primary" href="/dashboard">
              Open Company Overview
            </Link>
          </div>
        </section>

        <section className="help-grid" aria-label="Guide topics">
          <article className="help-card help-card--featured">
            <p className="eyebrow">Pages</p>
            <h2>Where to find things</h2>
            <ol className="help-steps">
              <li>
                <strong>Company Overview</strong>
                <span>
                  A quick read of company profit, project health, workload, and data confidence. The
                  MMM and All-Hands buttons open the Monday meeting pages.
                </span>
              </li>
              <li>
                <strong>Revenue Trends</strong>
                <span>
                  Gross revenue, actual cost to date, anticipated cost to date, net profit to date,
                  and forecasted net profit over time. Pick a preset (or All data), choose Custom
                  dates, or drag across the chart to zoom. Reset range shows everything again.
                </span>
              </li>
              <li>
                <strong>Operational Performance</strong>
                <span>
                  Revenue, cost, remaining work, forecasted profit, and logged vs estimated hours
                  for each operational group.
                </span>
              </li>
              <li>
                <strong>All Projects</strong>
                <span>
                  Search and filter every project and open one for full detail. Select projects to
                  Compare them side by side or Combine them into one report.
                </span>
              </li>
              <li>
                <strong>MMM</strong>
                <span>
                  The Monday Morning Meeting page: the projects to talk about this week, with links
                  back to Teamwork.
                </span>
              </li>
              <li>
                <strong>Time &amp; Payroll</strong>
                <span>Employee hours, billable utilization, time-entry expectations, and PTO.</span>
              </li>
              <li>
                <strong>Hosting</strong>
                <span>
                  Contracted hosting revenue and costs, plus the current hosting footprint.
                </span>
              </li>
            </ol>
          </article>

          <article className="help-card">
            <p className="eyebrow">Colours</p>
            <h2>What the colours mean</h2>
            <p>
              <span className="health-badge health-badge--green">Green</span> Confirmed profit.
            </p>
            <p>
              <span className="health-badge health-badge--amber">Amber</span> Provisional: the
              forecast is not fully confirmed yet, because cost data is missing or partial, or the
              calculation is out of date.
            </p>
            <p>
              <span className="health-badge health-badge--red">Red</span> Loss.
            </p>
            <p>
              <span className="health-badge health-badge--gray">Grey</span> Missing data. It is
              never counted as zero.
            </p>
          </article>

          <article className="help-card">
            <p className="eyebrow">Costs</p>
            <h2>How costs are counted</h2>
            <p>
              Profit is the client fee minus all labor and all expenses. Outsourced modeling vendor
              bills count as actual cost once they are entered as expenses in Teamwork Finance; they
              are never estimated. Outsourced Modeling hours are left out of remaining hours and
              remaining cost.
            </p>
            <p>
              Task-list budgets cover Prologue cost only, so work-group budget comparisons leave
              vendor bills out and show them on their own line. Admin has no budget: its hours are
              cost, shown as a share of the project.
            </p>
          </article>

          <article className="help-card">
            <p className="eyebrow">Data</p>
            <h2>When a number looks wrong</h2>
            <p>
              Reports are built from Teamwork. Open the project, follow the Teamwork link in its
              data-quality details, fix the source, then rerun the sync and calculations. The
              &quot;Data as of&quot; date at the top of a page shows when figures were last
              calculated.
            </p>
          </article>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tools</p>
              <h2>Role-specific reporting and administration</h2>
            </div>
            <span className="section-meta">Signed in as {session.user.role}</span>
          </div>
          <div className="tool-grid">
            {canManageLabor ? (
              <Link className="tool-card" href="/manager">
                <span className="tool-card__icon">L</span>
                <div>
                  <strong>Labor analysis</strong>
                  <p>Employee-level logged hours and historical labor cost coverage.</p>
                </div>
              </Link>
            ) : null}
            {isAdmin ? (
              <>
                <Link className="tool-card" href="/admin/users">
                  <span className="tool-card__icon">U</span>
                  <div>
                    <strong>Admin permissions</strong>
                    <p>Grant or remove Admin access for Teamwork employees.</p>
                  </div>
                </Link>
                <Link className="tool-card" href="/admin/calculations">
                  <span className="tool-card__icon">C</span>
                  <div>
                    <strong>Calculations</strong>
                    <p>Review calculation runs, coverage, health bands, and validation status.</p>
                  </div>
                </Link>
                <Link className="tool-card" href="/admin/teamwork">
                  <span className="tool-card__icon">T</span>
                  <div>
                    <strong>Teamwork connection</strong>
                    <p>Review the central reporting connection and synchronization status.</p>
                  </div>
                </Link>
              </>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
