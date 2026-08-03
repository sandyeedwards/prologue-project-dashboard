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
        <section className="page-heading page-heading--split">
          <div>
            <p className="eyebrow">Help &amp; administration</p>
            <h1>Using project reporting</h1>
            <p className="lede">
              A practical guide to reading portfolio health, understanding provisional financials,
              correcting Teamwork data, and accessing role-specific tools.
            </p>
          </div>
          <Link className="button button--primary" href="/dashboard">
            Open dashboard
          </Link>
        </section>

        <section className="help-grid" aria-label="Dashboard help topics">
          <article className="help-card help-card--featured">
            <p className="eyebrow">Start here</p>
            <h2>Read the portfolio from broad to specific</h2>
            <ol className="help-steps">
              <li>
                <strong>Filter the Dashboard</strong>
                <span>
                  Use the shared Dashboard row to choose project dates, project type, client,
                  health, or status. Click a date field for the calendar, or double-click to type a
                  flexible date.
                </span>
              </li>
              <li>
                <strong>Open a project</strong>
                <span>
                  Review actual cost, forecast, hours, operational groups, and source-data issues.
                </span>
              </li>
              <li>
                <strong>Compare or combine projects</strong>
                <span>
                  Use the always-visible search and filter controls in the Projects workspace to
                  compare up to six projects or combine the selected projects into one aggregate
                  report. Compare normalizes each project to its own revenue baseline so actual
                  cost, remaining work, profit, and overruns are immediately comparable. A second
                  view separates the same rows by operational group. Combine rolls the selection
                  into the aggregate profitability structure used by the Dashboard and includes the
                  same historical revenue, cost, and net-profit view for the selected projects.
                </span>
              </li>
              <li>
                <strong>Correct the source</strong>
                <span>
                  Use the Teamwork links in data-quality details, then rerun the sync and
                  calculations.
                </span>
              </li>
            </ol>
          </article>

          <article className="help-card">
            <p className="eyebrow">Health</p>
            <h2>What the percentage means</h2>
            <p>
              The colored health percentage combines financial, schedule, effort, overdue-work, and
              data-completeness signals. Color communicates urgency; the number makes close projects
              easier to compare.
            </p>
            <div className="help-health-scale">
              <span className="health-badge health-badge--green">85.00%</span>
              <span className="health-badge health-badge--amber">72.00%</span>
              <span className="health-badge health-badge--red">48.00%</span>
              <span className="health-badge health-badge--gray">N/A</span>
            </div>
          </article>

          <article className="help-card">
            <p className="eyebrow">Financials</p>
            <h2>Provisional does not mean incorrect</h2>
            <p>
              The Dashboard profitability tabs compare the combined forecasted position, a
              project-life financial trend, and operational-group results. Gross revenue is
              recognized when a project starts by adding its total client fee. The historical
              actual-cost line adds labor on each valid Teamwork time-entry date using historical
              cost information and adds expenses on their expense dates. Invalid legacy dates such
              as 1970 are excluded and temporarily assigned to the project start date until the
              Teamwork refresh repairs them. Net profit to date is cumulative gross revenue minus
              cumulative actual cost. Anticipated cost and forecasted net profit use the latest
              project forecast for projects started by each date; they are current projections
              arranged on the project-life timeline rather than archived forecast snapshots. Active
              Dashboard filters apply to all three views. The historical chart can be narrowed with
              preset or Custom dates. Presets populate the shared Project date fields, Custom
              highlights those fields for direct entry, Unlimited clears the historical date limit,
              and Reset range returns the view to Unlimited. A user can also press and drag across
              the graph to zoom, or click once to set the starting boundary and click again to
              finish.
            </p>
          </article>

          <article className="help-card">
            <p className="eyebrow">Data quality</p>
            <h2>Fix issues in Teamwork</h2>
            <p>
              Expand a source-data issue to see affected tasks, task lists, or time entries. Correct
              the Teamwork record rather than editing calculated dashboard values. The NoReport tag
              is the sole reporting-exclusion tag; Ready Set and DataHall projects remain eligible.
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
                    <strong>User access</strong>
                    <p>Assign Viewer, Manager, and Admin dashboard roles.</p>
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
