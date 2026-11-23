import Link from "next/link";
import type {
  PipelineState,
  ProjectInsights,
  UtilizationSnapshot,
} from "@/lib/all-hands/all-hands-data";
import { dateLabel, hours, money, reportingTimestamp } from "@/lib/reporting/format";
import styles from "./all-hands.module.css";

/** Read-only agenda sections filled in from HubSpot, MMM and Time Reporting. */
function percentOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : "No time logged";
}

export function Pipeline({ state }: { state: PipelineState }) {
  if (!state.ok) return <p className={styles.unavailable}>Pipeline unavailable: {state.message}</p>;
  if (!state.pipelines.length) return <p className={styles.muted}>HubSpot has no open deals.</p>;
  return (
    <div className={styles.pipelines}>
      {state.pipelines.map((pipeline) => (
        <details key={pipeline.id} className={styles.pipeline} open>
          <summary>
            <strong>{pipeline.label}</strong>
            <span>
              {pipeline.openCount} open · {money(pipeline.amount)}
              {pipeline.unpriced ? ` + ${pipeline.unpriced} without an amount` : ""}
            </span>
          </summary>
          <table className={styles.stageTable}>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Deals</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.stages.map((stage) => (
                <tr key={stage.label}>
                  <td>{stage.label}</td>
                  <td>{stage.count}</td>
                  <td>
                    {money(stage.amount)}
                    {stage.unpriced ? <small> · {stage.unpriced} missing amount</small> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.dealLists}>
            <div>
              <h3>Expected to close in the next 30 days ({pipeline.closingSoonCount})</h3>
              {pipeline.closingSoon.length ? (
                <ul>
                  {pipeline.closingSoon.map((deal) => (
                    <li key={deal.id}>
                      <span>{deal.name}</span>
                      <small>
                        {deal.stage} · {dateLabel(deal.closeDate)} ·{" "}
                        {deal.amount === null ? "Amount missing" : money(deal.amount)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>None.</p>
              )}
            </div>
            <div>
              <h3>Past their close date, still open ({pipeline.pastCloseCount})</h3>
              {pipeline.pastClose.length ? (
                <ul>
                  {pipeline.pastClose.map((deal) => (
                    <li key={deal.id}>
                      <span>{deal.name}</span>
                      <small>
                        {deal.stage} · was {dateLabel(deal.closeDate)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>None.</p>
              )}
              {pipeline.undated ? (
                <p className={styles.muted}>
                  {pipeline.undated} open deal{pipeline.undated === 1 ? " has" : "s have"} no close
                  date.
                </p>
              ) : null}
            </div>
          </div>
        </details>
      ))}
      <p className={styles.muted}>
        Read from HubSpot at {reportingTimestamp(state.loadedAt)} (refreshes every 10 minutes).
      </p>
    </div>
  );
}

export function Insights({ insights }: { insights: ProjectInsights | null }) {
  if (!insights) return <p className={styles.unavailable}>Project data could not be loaded.</p>;
  return (
    <div className={styles.insights}>
      <div className={styles.stats}>
        <div>
          <strong>{insights.activeProjects}</strong>
          <small>Active projects</small>
        </div>
        <div>
          <strong>{insights.needingAttention}</strong>
          <small>Need attention</small>
        </div>
        <div>
          <strong>{insights.overdueTasks}</strong>
          <small>Overdue tasks</small>
        </div>
        <div>
          <strong>{insights.dueThisWeek}</strong>
          <small>Tasks due this week</small>
        </div>
      </div>
      {insights.watchList.length ? (
        <>
          <h3>Watch list</h3>
          <ul className={styles.watchList}>
            {insights.watchList.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>
                  {project.projectNumber ? `${project.projectNumber} · ` : ""}
                  {project.name}
                </Link>
                <small>{project.reason}</small>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p>
        <Link href="/mmm">Open MMM for the full project review →</Link>
      </p>
    </div>
  );
}

export function Utilization({ data }: { data: UtilizationSnapshot | null }) {
  if (!data) return <p className={styles.unavailable}>Utilization could not be loaded.</p>;
  return (
    <div className={styles.utilization}>
      <h3>
        Utilization last week ({dateLabel(data.startDate)} – {dateLabel(data.endDate)})
      </h3>
      <p>
        <strong>{percentOf(data.billableMinutes, data.totalMinutes)}</strong> billable ·{" "}
        {hours(data.totalMinutes)} logged of {hours(data.expectedMinutes)} expected
      </p>
      {data.people?.length ? (
        <table className={styles.stageTable}>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Logged</th>
              <th scope="col">Billable</th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((person) => (
              <tr key={person.name}>
                <td>{person.name}</td>
                <td>{hours(person.totalMinutes)}</td>
                <td>{percentOf(person.billableMinutes, person.totalMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className={styles.muted}>
        Billable ÷ logged hours, the same rule as{" "}
        <Link href="/time-reporting">Time &amp; Payroll</Link>.
      </p>
    </div>
  );
}
