import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type {
  DueTask,
  PipelineState,
  ProjectInsights,
  UtilizationSnapshot,
  WeekHighlights,
} from "@/lib/all-hands/all-hands-data";
import { dateLabel, hours, money, reportingTimestamp } from "@/lib/reporting/format";
import styles from "./all-hands.module.css";

/** Read-only agenda sections filled in from HubSpot, MMM and Time Reporting. */

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value);

function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

function Unavailable({ children }: { children: ReactNode }) {
  return <p className={styles.unavailable}>{children}</p>;
}

/* ---------- At a glance ---------- */

function Tile({
  label,
  value,
  note,
  tone,
  href,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  tone?: "good" | "watch" | "neutral";
  href?: string;
}) {
  const body = (
    <>
      <small>{label}</small>
      <strong>{value}</strong>
      {note ? <span>{note}</span> : null}
    </>
  );
  return href ? (
    <a className={styles.tile} data-tone={tone ?? "neutral"} href={href}>
      {body}
    </a>
  ) : (
    <div className={styles.tile} data-tone={tone ?? "neutral"}>
      {body}
    </div>
  );
}

export function Glance({
  highlights,
  utilization,
  pipeline,
  insights,
}: {
  highlights: WeekHighlights | null;
  utilization: UtilizationSnapshot | null;
  pipeline: PipelineState;
  insights: ProjectInsights | null;
}) {
  const trend =
    utilization && utilization.priorTotalMinutes !== null && utilization.priorTotalMinutes > 0
      ? ((utilization.totalMinutes - utilization.priorTotalMinutes) /
          utilization.priorTotalMinutes) *
        100
      : null;
  const billable = utilization
    ? percentOf(utilization.billableMinutes, utilization.totalMinutes)
    : null;
  const openDeals = pipeline.ok
    ? pipeline.pipelines.reduce((sum, row) => sum + row.openCount, 0)
    : null;
  const openAmount = pipeline.ok
    ? pipeline.pipelines.reduce((sum, row) => sum + row.amount, 0)
    : null;
  return (
    <div className={styles.glance}>
      <Tile
        label="Hours logged last week"
        value={utilization ? hours(utilization.totalMinutes) : "Missing"}
        href="#section-projects"
        note={
          trend === null ? null : (
            <em data-direction={trend >= 0 ? "up" : "down"}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(0)}% vs week before
            </em>
          )
        }
      />
      <Tile
        label="Billable"
        value={billable === null ? "Missing" : `${billable.toFixed(0)}%`}
        tone={billable === null ? "neutral" : billable >= 75 ? "good" : "watch"}
        href="#section-projects"
        note="of hours logged"
      />
      <Tile
        label="Tasks finished last week"
        value={highlights ? String(highlights.tasksCompleted) : "Missing"}
        tone="good"
        href="#section-wins"
        note={
          highlights?.projectsCompleted.length
            ? `${highlights.projectsCompleted.length} project${highlights.projectsCompleted.length === 1 ? "" : "s"} wrapped up`
            : undefined
        }
      />
      <Tile
        label="Due this week"
        value={highlights ? String(highlights.dueThisWeek.length) : "Missing"}
        href="#section-calendar"
        tone={insights && insights.overdueTasks > 0 ? "watch" : "neutral"}
        note={insights ? `${insights.overdueTasks} overdue` : undefined}
      />
      <Tile
        label="Open pipeline"
        value={openAmount === null ? "Missing" : compact(openAmount)}
        href="#section-pipeline"
        note={openDeals === null ? "HubSpot unavailable" : `${openDeals} open deals`}
      />
    </div>
  );
}

/* ---------- Wins ---------- */

export function Wins({
  highlights,
  pipeline,
}: {
  highlights: WeekHighlights | null;
  pipeline: PipelineState;
}) {
  if (!highlights) return <Unavailable>Last week&apos;s activity could not be loaded.</Unavailable>;
  const won = pipeline.ok ? pipeline.wonLastWeek : null;
  const nothing =
    !highlights.tasksCompleted &&
    !highlights.projectsCompleted.length &&
    !highlights.projectsStarted.length &&
    !won?.deals.length;
  return (
    <div className={styles.wins}>
      <p className={styles.muted}>
        {dateLabel(highlights.lastWeekStart)} – {dateLabel(highlights.lastWeekEnd)}
      </p>
      {nothing ? (
        <p className={styles.quiet}>A quiet week on paper. Share a win from the floor!</p>
      ) : null}
      <div className={styles.winGrid}>
        {won && won.deals.length ? (
          <div className={styles.winCard} data-kind="deal">
            <strong>
              {won.deals.length} deal{won.deals.length === 1 ? "" : "s"} won
              {won.amount > 0 ? ` · ${compact(won.amount)}` : ""}
            </strong>
            <ul>
              {won.deals.slice(0, 6).map((deal) => (
                <li key={deal.id}>
                  {deal.name}
                  <small>{deal.amount === null ? "Amount missing" : money(deal.amount)}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {highlights.projectsCompleted.length ? (
          <div className={styles.winCard} data-kind="done">
            <strong>
              {highlights.projectsCompleted.length} project
              {highlights.projectsCompleted.length === 1 ? "" : "s"} completed
            </strong>
            <ul>
              {highlights.projectsCompleted.slice(0, 6).map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`}>
                    {project.projectNumber ? `${project.projectNumber} · ` : ""}
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {highlights.projectsStarted.length ? (
          <div className={styles.winCard} data-kind="new">
            <strong>
              {highlights.projectsStarted.length} new project
              {highlights.projectsStarted.length === 1 ? "" : "s"} kicked off
            </strong>
            <ul>
              {highlights.projectsStarted.slice(0, 6).map((project) => (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`}>
                    {project.projectNumber ? `${project.projectNumber} · ` : ""}
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={styles.winCard} data-kind="tasks">
          <strong>{highlights.tasksCompleted} tasks finished</strong>
          <p>Across all reporting projects in Teamwork.</p>
        </div>
      </div>
      {!pipeline.ok ? (
        <p className={styles.muted}>Deals won are missing: {pipeline.message}</p>
      ) : null}
    </div>
  );
}

/* ---------- This week by day ---------- */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function WeekAhead({
  weekStart,
  highlights,
  teamworkBase,
}: {
  weekStart: string;
  highlights: WeekHighlights | null;
  teamworkBase: string | null;
}) {
  if (!highlights)
    return <Unavailable>This week&apos;s due dates could not be loaded.</Unavailable>;
  const days = DAY_NAMES.map((name, index) => {
    const date = new Date(`${weekStart}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return { name, iso, tasks: highlights.dueThisWeek.filter((task) => task.dueDate === iso) };
  });
  const weekend = highlights.dueThisWeek.filter(
    (task) => !days.some((day) => day.iso === task.dueDate),
  );
  const taskLabel = (task: DueTask) => (
    <li key={task.id}>
      {teamworkBase ? (
        <a href={`${teamworkBase}/app/tasks/${task.teamworkId}`} target="_blank" rel="noreferrer">
          {task.name}
        </a>
      ) : (
        <span>{task.name}</span>
      )}
      <small>
        {task.projectNumber ?? task.projectName}
        {task.assignees.length ? ` · ${task.assignees.join(", ")}` : " · Unassigned"}
      </small>
    </li>
  );
  return (
    <div className={styles.weekAhead}>
      <h3>Due this week in Teamwork</h3>
      <div className={styles.days}>
        {days.map((day) => (
          <div key={day.iso} className={styles.day} data-empty={day.tasks.length === 0}>
            <header>
              <strong>{day.name}</strong>
              <small>{dateLabel(day.iso).replace(/, \d{4}$/, "")}</small>
              <span>{day.tasks.length}</span>
            </header>
            {day.tasks.length ? (
              <ul>
                {day.tasks.slice(0, 6).map(taskLabel)}
                {day.tasks.length > 6 ? (
                  <li className={styles.more}>+{day.tasks.length - 6} more</li>
                ) : null}
              </ul>
            ) : (
              <p>Nothing due</p>
            )}
          </div>
        ))}
      </div>
      {weekend.length ? (
        <p className={styles.muted}>
          {weekend.length} more due over the weekend.
          {highlights.dueThisWeek.length >= 80 ? " Showing the first 80 tasks." : ""}
        </p>
      ) : null}
    </div>
  );
}

/* ---------- Pipeline ---------- */

export function Pipeline({ state }: { state: PipelineState }) {
  if (!state.ok) return <Unavailable>Pipeline unavailable: {state.message}</Unavailable>;
  if (!state.pipelines.length) return <p className={styles.muted}>HubSpot has no open deals.</p>;
  return (
    <div className={styles.pipelines}>
      {state.pipelines.map((pipeline) => {
        const widest = Math.max(1, ...pipeline.stages.map((stage) => stage.amount));
        return (
          <details key={pipeline.id} className={styles.pipeline} open>
            <summary>
              <strong>{pipeline.label}</strong>
              <span>
                {pipeline.openCount} open · {compact(pipeline.amount)}
                {pipeline.unpriced ? ` + ${pipeline.unpriced} without an amount` : ""}
              </span>
            </summary>
            <ol className={styles.funnel}>
              {pipeline.stages.map((stage) => (
                <li key={stage.label}>
                  <span className={styles.funnelLabel}>{stage.label}</span>
                  <span className={styles.funnelTrack} aria-hidden="true">
                    <span style={{ width: `${Math.max((stage.amount / widest) * 100, 2)}%` }} />
                  </span>
                  <span className={styles.funnelValue}>
                    <strong>{compact(stage.amount)}</strong>
                    <small>
                      {stage.count} deal{stage.count === 1 ? "" : "s"}
                      {stage.unpriced ? ` · ${stage.unpriced} no amount` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
            <div className={styles.dealLists}>
              <div className={styles.dealList} data-kind="soon">
                <h3>Closing in the next 30 days ({pipeline.closingSoonCount})</h3>
                {pipeline.closingSoon.length ? (
                  <ul>
                    {pipeline.closingSoon.map((deal) => (
                      <li key={deal.id}>
                        <span>{deal.name}</span>
                        <small>
                          {dateLabel(deal.closeDate)} · {deal.stage} ·{" "}
                          {deal.amount === null ? "Amount missing" : money(deal.amount)}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>None.</p>
                )}
              </div>
              <div className={styles.dealList} data-kind="late">
                <h3>Past close date, still open ({pipeline.pastCloseCount})</h3>
                {pipeline.pastClose.length ? (
                  <ul>
                    {pipeline.pastClose.map((deal) => (
                      <li key={deal.id}>
                        <span>{deal.name}</span>
                        <small>
                          was {dateLabel(deal.closeDate)} · {deal.stage}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>None. Nice!</p>
                )}
                {pipeline.undated ? (
                  <p className={styles.muted}>
                    {pipeline.undated} open deal{pipeline.undated === 1 ? " has" : "s have"} no
                    close date.
                  </p>
                ) : null}
              </div>
            </div>
          </details>
        );
      })}
      <p className={styles.muted}>
        Read from HubSpot at {reportingTimestamp(state.loadedAt)} (refreshes every 10 minutes).
      </p>
    </div>
  );
}

/* ---------- Projects ---------- */

export function Insights({ insights }: { insights: ProjectInsights | null }) {
  if (!insights) return <Unavailable>Project data could not be loaded.</Unavailable>;
  return (
    <div className={styles.insights}>
      <div className={styles.stats}>
        <div>
          <strong>{insights.activeProjects}</strong>
          <small>Active projects</small>
        </div>
        <div data-tone={insights.needingAttention ? "watch" : "good"}>
          <strong>{insights.needingAttention}</strong>
          <small>Need attention</small>
        </div>
        <div data-tone={insights.overdueTasks ? "alert" : "good"}>
          <strong>{insights.overdueTasks}</strong>
          <small>Overdue tasks</small>
        </div>
        <div>
          <strong>{insights.dueThisWeek}</strong>
          <small>Due this week</small>
        </div>
      </div>
      {insights.watchList.length ? (
        <>
          <h3>Watch list</h3>
          <ul className={styles.watchList}>
            {insights.watchList.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>
                  <strong>
                    {project.projectNumber ? `${project.projectNumber} · ` : ""}
                    {project.name}
                  </strong>
                  <small>{project.reason}</small>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.quiet}>No projects with red flags this week.</p>
      )}
      <p>
        <Link href="/mmm">Open MMM for the full project review →</Link>
      </p>
    </div>
  );
}

export function Utilization({ data }: { data: UtilizationSnapshot | null }) {
  if (!data) return <Unavailable>Utilization could not be loaded.</Unavailable>;
  const team = percentOf(data.billableMinutes, data.totalMinutes);
  const widest = Math.max(1, ...(data.people ?? []).map((person) => person.totalMinutes));
  return (
    <div className={styles.utilization}>
      <h3>
        Utilization last week ({dateLabel(data.startDate)} – {dateLabel(data.endDate)})
      </h3>
      <div className={styles.utilTeam}>
        <div
          className={styles.ring}
          style={{ "--ring": `${team ?? 0}` } as CSSProperties}
          role="img"
          aria-label={team === null ? "No time logged" : `${team.toFixed(0)}% billable`}
        >
          <span>{team === null ? "—" : `${team.toFixed(0)}%`}</span>
        </div>
        <p>
          <strong>billable</strong> · {hours(data.totalMinutes)} logged of{" "}
          {hours(data.expectedMinutes)} expected
        </p>
      </div>
      {data.people?.length ? (
        <ul className={styles.people}>
          {data.people.map((person) => {
            const share = percentOf(person.billableMinutes, person.totalMinutes);
            return (
              <li key={person.name}>
                <span>{person.name}</span>
                <span
                  className={styles.personBar}
                  style={{ width: `${(person.totalMinutes / widest) * 100}%` }}
                  aria-hidden="true"
                >
                  <span style={{ width: `${share ?? 0}%` }} />
                </span>
                <small>
                  {hours(person.totalMinutes)} · {share === null ? "—" : `${share.toFixed(0)}%`}
                </small>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className={styles.muted}>
        Dark = billable, light = other time. Billable ÷ logged hours, the same rule as{" "}
        <Link href="/time-reporting">Time &amp; Payroll</Link>.
      </p>
    </div>
  );
}
