import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/reporting-ui";
import { requireRole } from "@/lib/auth/session";
import { getEmployeeLaborRows } from "@/lib/reporting/dashboard-data";
import { hours, money, percent } from "@/lib/reporting/format";

export const dynamic = "force-dynamic";

export default async function ManagerPage() {
  const session = await requireRole("MANAGER", "/manager");
  const people = await getEmployeeLaborRows();
  const totalMinutes = people.reduce((sum, person) => sum + person.loggedMinutes, 0);
  const knownCost = people.reduce(
    (sum, person) => sum + (person.actualLaborCost === null ? 0 : Number(person.actualLaborCost)),
    0,
  );
  const peopleWithCost = people.filter((person) => person.actualLaborCost !== null).length;
  return (
    <AppShell user={session.user}>
      <main className="shell shell--wide">
        <section className="page-heading">
          <p className="eyebrow">Manager reporting</p>
          <h1>Employee labor analysis</h1>
          <p className="lede">
            Hours and total historical labor cost by employee. Hourly cost rates are never displayed
            or sent to the browser.
          </p>
        </section>
        <section className="metric-grid metric-grid--four">
          <MetricCard
            label="Employees"
            value={people.length}
            detail="Active internal Teamwork people"
          />
          <MetricCard
            label="Logged time"
            value={hours(totalMinutes)}
            detail="Historical imported time"
          />
          <MetricCard
            label="Known labor cost"
            value={money(knownCost)}
            detail="Only returned Teamwork cost totals"
          />
          <MetricCard
            label="Cost-covered employees"
            value={`${peopleWithCost}/${people.length}`}
            detail="Missing cost is not treated as zero"
            tone={peopleWithCost === people.length ? "success" : "warning"}
          />
        </section>
        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Labor totals</p>
              <h2>Employee contribution</h2>
            </div>
            <span className="section-meta">Manager and Admin only</span>
          </div>
          <div className="table-wrap report-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Hours</th>
                  <th>Actual labor cost</th>
                  <th>Projects</th>
                  <th>Time entries</th>
                  <th>Cost coverage</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.personId}>
                    <td>
                      <strong>{person.displayName || "Unnamed employee"}</strong>
                      <small className="table-subvalue">{person.email ?? "No email"}</small>
                    </td>
                    <td>{hours(person.loggedMinutes)}</td>
                    <td>{money(person.actualLaborCost)}</td>
                    <td>{person.projectCount}</td>
                    <td>{person.timeEntryCount}</td>
                    <td>{percent(person.costCoveragePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
