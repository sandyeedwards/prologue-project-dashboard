"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dateLabel, hours, money, percent, reportingTimestamp } from "@/lib/reporting/format";
import {
  filterMeetingProjects,
  meetingTaskComplete,
  type MeetingProject,
  type MeetingTask,
  type meetingWindow,
} from "@/lib/reporting/mmm-report";
import styles from "@/app/mmm/mmm.module.css";

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card metric-card--secondary${tone ? ` metric-card--${tone}` : ""}`}>
      <header className="metric-card__header">
        <span className="metric-card__indicator" aria-hidden="true" />
        <p className="metric-card__label">{label}</p>
      </header>
      <div className="metric-card__value">{value}</div>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}

function variance(minutes: number | null) {
  return minutes === null
    ? "Not available"
    : minutes > 0
      ? `${hours(minutes)} over estimate`
      : minutes < 0
        ? `${hours(-minutes)} under estimate`
        : "At estimate";
}

function TaskDetail({
  project,
  teamworkBase,
  today,
}: {
  project: MeetingProject;
  teamworkBase: string | null;
  today: string;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskQuery, setTaskQuery] = useState("");
  const query = taskQuery.trim().toLowerCase();
  const visible = project.tasks.filter(
    (task) =>
      (showCompleted || !meetingTaskComplete(task)) &&
      (!query ||
        [task.name, task.taskListName, task.group, ...task.assignees]
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
  const byId = new Map(project.tasks.map((row) => [row.id, row]));
  const depth = (task: MeetingTask) => {
    let level = 0,
      parent = task.parentTaskId;
    const seen = new Set([task.id]);
    while (parent && byId.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      level++;
      parent = byId.get(parent)!.parentTaskId;
    }
    return Math.min(level, 4);
  };
  // Keep children beside their parents; cycle/orphan records remain visible.
  const ordered: MeetingTask[] = [];
  const visited = new Set<string>();
  const visit = (task: MeetingTask) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    ordered.push(task);
    visible.filter((child) => child.parentTaskId === task.id).forEach(visit);
  };
  visible
    .filter((task) => !visible.some((parent) => parent.id === task.parentTaskId))
    .forEach(visit);
  visible.forEach(visit);
  return (
    <>
      <div className={styles.taskControls}>
        <label>
          Find a task or assignee
          <input
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            placeholder="Task, work group, list, or person"
          />
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />{" "}
          Include completed tasks
        </label>
        <span>
          {visible.length} of {project.tasks.length} tasks
        </span>
      </div>
      <div className="table-wrap">
        <table className={`data-table ${styles.taskTable}`}>
          <caption className={styles.caption}>
            Task detail · logged hours belong to each task only; parent and subtask time is not
            repeated.
          </caption>
          <thead>
            <tr>
              <th>Task / assignee</th>
              <th>Status / due</th>
              <th>Internal estimate</th>
              <th>Logged</th>
              <th>Estimated remaining</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((task) => {
              const complete = meetingTaskComplete(task);
              const overdue = !complete && !!task.dueDate && task.dueDate < today;
              const holder = task.isCanonicalHolder && !task.isOutsourced;
              return (
                <tr key={task.id}>
                  <td>
                    <div style={{ paddingLeft: `${depth(task) * 0.85}rem` }}>
                      {teamworkBase ? (
                        <a
                          href={`${teamworkBase}/app/tasks/${task.teamworkId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <strong>{task.name}</strong>
                        </a>
                      ) : (
                        <strong>{task.name}</strong>
                      )}
                      <small>
                        {task.group} · {task.taskListName}
                      </small>
                      <small>{task.assignees.join(", ") || "No assignment recorded"}</small>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        complete ? styles.positive : overdue ? styles.negative : styles.muted
                      }
                    >
                      {complete ? "Complete" : overdue ? "Open · overdue" : "Open"}
                    </span>
                    <small>{dateLabel(task.dueDate)}</small>
                  </td>
                  <td>
                    {!task.metricsAvailable
                      ? "Not calculated"
                      : task.isOutsourced
                        ? "Vendor work"
                        : holder
                          ? hours(task.countedEstimatedMinutes)
                          : task.coveredByTaskId
                            ? "Included in parent estimate"
                            : project.tasks.some((child) => child.parentTaskId === task.id)
                              ? "See subtasks"
                              : "No estimate"}
                  </td>
                  <td>
                    {hours(task.ownLoggedMinutes)}
                    <small>{hours(task.lastWeekMinutes)} last week</small>
                  </td>
                  <td>
                    {!task.metricsAvailable
                      ? "Not calculated"
                      : holder
                        ? hours(task.isBranchComplete ? 0 : task.remainingMinutes)
                        : "—"}
                    {holder && !task.isBranchComplete && (task.remainingMinutes ?? 0) === 0 ? (
                      <small className={styles.warning}>
                        Estimate used; review remaining effort
                      </small>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!visible.length ? <p className="empty-panel">No tasks match these filters.</p> : null}
    </>
  );
}

export function MeetingWorkspace({
  projects,
  window: period,
  teamworkBase,
}: {
  projects: MeetingProject[];
  window: ReturnType<typeof meetingWindow>;
  teamworkBase: string | null;
}) {
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("ALL");
  const [client, setClient] = useState("ALL");
  const [focus, setFocus] = useState("ALL");
  const [sort, setSort] = useState("PRIORITY");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const visible = useMemo(
    () => filterMeetingProjects(projects, { query, owner, client, focus, sort }),
    [projects, query, owner, client, focus, sort],
  );
  const owners = [...new Set(projects.map((p) => p.owner ?? "Unassigned"))].sort();
  const clients = [...new Set(projects.map((p) => p.companyName ?? "No client"))].sort();
  const openTasks = visible.reduce((sum, p) => sum + p.tasks.length - p.completedTasks, 0);
  const overdue = visible.reduce((sum, p) => sum + p.overdueTasks, 0);
  const knownHours = visible.filter((p) => p.forecastMinutes !== null);
  const knownProfit = visible.filter((p) => p.metrics?.forecastProfit != null);
  const oldestCalculation = projects
    .map((p) => p.metrics?.calculatedAt)
    .filter((value): value is Date => !!value)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const review = (id: string) => {
    setExpanded((previous) => new Set(previous).add(id));
    requestAnimationFrame(() =>
      document
        .getElementById(`meeting-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const reset = () => {
    setQuery("");
    setOwner("ALL");
    setClient("ALL");
    setFocus("ALL");
    setSort("PRIORITY");
  };
  return (
    <main className={`shell shell--wide ${styles.workspace}`}>
      <div className="breadcrumb">
        <Link href="/dashboard">Company Overview</Link>
        <span>/</span>
        <span>MMM</span>
      </div>
      <section className="report-titlebar">
        <div className="report-titlebar__copy">
          <p className="eyebrow">Active project review</p>
          <h1>Monday Morning Meeting</h1>
          <p>
            What needs attention, what is coming up, and where each project is projected to finish.
          </p>
          <small>
            Week of {dateLabel(period.weekStart)} · reviewed as of {dateLabel(period.today)}
          </small>
        </div>
        <div className="report-titlebar__actions">
          <Link className="button button--secondary" href="/dashboard">
            Company Overview
          </Link>
          <button
            className="button button--secondary"
            onClick={() => {
              setExpanded(new Set(visible.map((project) => project.id)));
              requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
            }}
          >
            Print meeting report
          </button>
        </div>
      </section>
      <p className={styles.freshness}>
        Oldest project calculation: {reportingTimestamp(oldestCalculation)}. Project cards show
        their individual sync and calculation times. Last week means{" "}
        {dateLabel(period.lastWeekStart)}–{dateLabel(period.lastWeekEnd)}.
      </p>
      <section className={styles.filters} aria-label="Meeting report filters">
        <label className={styles.search}>
          Find a project
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Project number, name, client, or owner"
          />
        </label>
        <label>
          Project owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="ALL">All owners</option>
            {owners.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Client
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="ALL">All clients</option>
            {clients.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Meeting focus
          <select value={focus} onChange={(e) => setFocus(e.target.value)}>
            <option value="ALL">All active projects</option>
            <option value="ATTENTION">Needs discussion</option>
            <option value="OVERDUE">Overdue tasks</option>
            <option value="DUE">Tasks due this week</option>
          </select>
        </label>
        <label>
          Order
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="PRIORITY">Meeting priority</option>
            <option value="END">Project end date</option>
            <option value="NAME">Project name</option>
          </select>
        </label>
        <button className="button button--secondary" onClick={reset}>
          Reset
        </button>
      </section>
      <section className="metric-grid metric-grid--four" aria-label="Meeting summary">
        <MetricCard
          label="Active projects shown"
          value={visible.length}
          detail={`${visible.filter((p) => p.signals.length).length} need discussion · ${projects.length} active in total`}
        />
        <MetricCard
          label="Open tasks"
          value={openTasks}
          detail={`${overdue} overdue · ${visible.reduce((sum, p) => sum + p.dueThisWeek, 0)} due this week`}
          tone={overdue ? "warning" : undefined}
        />
        <MetricCard
          label="Projected internal hours"
          value={
            knownHours.length
              ? hours(knownHours.reduce((sum, p) => sum + (p.forecastMinutes ?? 0), 0))
              : "Not available"
          }
          detail={`Known forecast for ${knownHours.length} of ${visible.length} projects; excludes vendor estimates`}
        />
        <MetricCard
          label="Known projected profit"
          value={
            knownProfit.length
              ? money(knownProfit.reduce((sum, p) => sum + Number(p.metrics!.forecastProfit), 0))
              : "Not available"
          }
          detail={`${knownProfit.length} of ${visible.length} projects · ${visible.filter((p) => p.metrics?.isProvisional).length} provisional forecasts`}
        />
      </section>
      <section className="report-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Meeting agenda</p>
            <h2>Active projects at a glance</h2>
            <p className="section-description">
              Select a project to review its work groups, tasks, and forecast. Task completion is a
              count, not a measure of effort.
            </p>
          </div>
          <span className="section-meta" aria-live="polite">
            {visible.length} projects shown
          </span>
        </div>
        <div className="table-wrap">
          <table className={`data-table ${styles.overviewTable}`}>
            <thead>
              <tr>
                <th>Project / owner</th>
                <th>Task completion</th>
                <th>Logged / estimated</th>
                <th>Projected finish hours</th>
                <th>Projected profit</th>
                <th>Discuss / delivery</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => (
                <tr key={project.id}>
                  <td>
                    <button className={styles.projectButton} onClick={() => review(project.id)}>
                      {project.projectNumber && !project.name.includes(project.projectNumber)
                        ? `${project.projectNumber} · `
                        : ""}
                      {project.name}
                    </button>
                    <small>
                      {project.companyName ?? "No client"} · {project.owner ?? "No owner"}
                    </small>
                  </td>
                  <td>
                    <strong>
                      {project.completedTasks} / {project.tasks.length}
                    </strong>
                    <small>
                      {project.progressPercent === null
                        ? "No tasks imported"
                        : `${percent(project.progressPercent, 0)} complete`}
                    </small>
                    {project.tasks.length ? (
                      <progress
                        max={project.tasks.length}
                        value={project.completedTasks}
                        aria-label={`${project.name}: ${project.completedTasks} of ${project.tasks.length} tasks complete`}
                      />
                    ) : null}
                  </td>
                  <td>
                    <strong>{hours(project.metrics?.loggedMinutes)}</strong>
                    <small>of {hours(project.metrics?.canonicalEstimatedMinutes)} estimated</small>
                  </td>
                  <td>
                    <strong>{hours(project.forecastMinutes)}</strong>
                    <small
                      className={(project.varianceMinutes ?? 0) > 0 ? styles.warning : styles.muted}
                    >
                      {variance(project.varianceMinutes)}
                    </small>
                  </td>
                  <td>
                    <strong
                      className={
                        project.metrics?.forecastProfit == null
                          ? styles.muted
                          : Number(project.metrics.forecastProfit) < 0
                            ? styles.negative
                            : styles.positive
                      }
                    >
                      {money(project.metrics?.forecastProfit)}
                    </strong>
                    <small>
                      {percent(project.metrics?.forecastMarginPercent)} margin
                      {project.metrics?.isProvisional ? " · provisional" : ""}
                    </small>
                  </td>
                  <td>
                    {project.signals.length ? (
                      <>
                        <span
                          className={
                            project.signals.some((s) => s.tone === "red")
                              ? styles.negative
                              : styles.warning
                          }
                        >
                          {project.signals[0].label}
                        </span>
                        {project.signals.length > 1 ? (
                          <small>+{project.signals.length - 1} more to review</small>
                        ) : null}
                      </>
                    ) : (
                      <span className={styles.positive}>No current flags</span>
                    )}
                    <small>Ends {dateLabel(project.endDate)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length ? (
          <p className="empty-panel">No active projects match these filters.</p>
        ) : null}
      </section>
      <div className={styles.detailActions}>
        <h2>Project breakdowns</h2>
        <div>
          <button
            className="button button--secondary button--small"
            onClick={() => setExpanded(new Set(visible.map((p) => p.id)))}
          >
            Expand all shown
          </button>
          <button
            className="button button--secondary button--small"
            onClick={() => setExpanded(new Set())}
          >
            Collapse all
          </button>
        </div>
      </div>
      {visible.map((project) => (
        <details
          className={styles.project}
          id={`meeting-${project.id}`}
          key={project.id}
          open={expanded.has(project.id)}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setExpanded((previous) => {
              if (previous.has(project.id) === open) return previous;
              const next = new Set(previous);
              if (open) next.add(project.id);
              else next.delete(project.id);
              return next;
            });
          }}
        >
          <summary>
            <div>
              <strong>{project.name}</strong>
              <small>
                {project.owner ?? "No owner"} · {project.companyName ?? "No client"}
              </small>
            </div>
            <span>
              {project.completedTasks}/{project.tasks.length} tasks complete
            </span>
            <span>
              {project.signals.length
                ? `${project.signals.length} discussion points`
                : "No current flags"}
            </span>
          </summary>
          {expanded.has(project.id) ? (
            <div className={styles.projectBody}>
              <div className={styles.links}>
                <Link
                  className="button button--secondary button--small"
                  href={`/projects/${project.id}`}
                >
                  Full project report
                </Link>
                {teamworkBase ? (
                  <a
                    className="button button--secondary button--small"
                    href={`${teamworkBase}/app/projects/${project.teamworkId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Teamwork
                  </a>
                ) : null}
              </div>
              <div className={styles.signals}>
                {project.signals.length ? (
                  <ul>
                    {project.signals.map((signal) => (
                      <li
                        className={signal.tone === "red" ? styles.negative : styles.warning}
                        key={signal.label}
                      >
                        {signal.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No current delivery or reporting flags.</p>
                )}
              </div>
              <div className={styles.stats}>
                <div>
                  <span>Internal estimate</span>
                  <strong>{hours(project.metrics?.canonicalEstimatedMinutes)}</strong>
                </div>
                <div>
                  <span>Logged to date</span>
                  <strong>{hours(project.metrics?.loggedMinutes)}</strong>
                </div>
                <div>
                  <span>Estimated remaining</span>
                  <strong>{hours(project.remainingMinutes)}</strong>
                </div>
                <div>
                  <span>Projected final hours</span>
                  <strong>{hours(project.forecastMinutes)}</strong>
                  <small>{variance(project.varianceMinutes)}</small>
                </div>
                <div>
                  <span>Client fee</span>
                  <strong>{money(project.metrics?.clientFee)}</strong>
                </div>
                <div>
                  <span>Current costs</span>
                  <strong>{money(project.metrics?.actualTotalCost)}</strong>
                </div>
                <div>
                  <span>Projected final cost</span>
                  <strong>{money(project.metrics?.forecastCost)}</strong>
                </div>
                <div>
                  <span>Projected profit</span>
                  <strong>{money(project.metrics?.forecastProfit)}</strong>
                  <small>{percent(project.metrics?.forecastMarginPercent)} margin</small>
                </div>
              </div>
              <p className={styles.activity}>
                <strong>Last week:</strong> {hours(project.lastWeekMinutes)} logged ·{" "}
                {project.completedLastWeek} tasks completed. <strong>This week:</strong>{" "}
                {project.dueThisWeek} open tasks due.{" "}
                {project.unallocatedMinutes > 0
                  ? `${hours(project.unallocatedMinutes)} of total logged time has no task and is included in the project total.`
                  : ""}
              </p>
              <h3>Work-group progress</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Work group</th>
                      <th>Tasks complete</th>
                      <th>Internal estimate</th>
                      <th>Logged</th>
                      <th>Estimated remaining</th>
                      <th>Projected final hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.stages.map((stage) => (
                      <tr key={stage.name}>
                        <td>
                          <strong>{stage.name}</strong>
                        </td>
                        <td>
                          {stage.completed}/{stage.tasks.length}
                        </td>
                        <td>{hours(stage.estimatedMinutes)}</td>
                        <td>{hours(stage.loggedMinutes)}</td>
                        <td>{hours(stage.remainingMinutes)}</td>
                        <td>{hours(stage.forecastMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Task review</h3>
              <TaskDetail project={project} teamworkBase={teamworkBase} today={period.today} />
              <p className={styles.freshness}>
                Last source sync: {reportingTimestamp(project.lastSyncedAt)} · Forecast calculated:{" "}
                {reportingTimestamp(project.metrics?.calculatedAt)}
              </p>
            </div>
          ) : null}
        </details>
      ))}
      <section className={`report-section ${styles.notes}`}>
        <h2>How to read this meeting report</h2>
        <p>
          Projected internal hours = all logged project hours + unused estimates on unfinished
          internal work. Parent and subtask estimates are counted once. Vendor modeling estimates
          are excluded from internal hours; their recorded expenses remain in the existing project
          cost forecast.
        </p>
        <p>
          Reaching an estimate does not mean a task is finished. Open tasks with exhausted or
          missing estimates need the team’s review; the projection may be too low. Financial
          projections use the same calculations as the project reports, and provisional figures may
          change when missing inputs are corrected.
        </p>
        <p>
          This is the latest imported project state, not a saved historical meeting snapshot.
          Completed, closed, archived, on-hold, and reporting-excluded projects are outside this
          active-project view.
        </p>
      </section>
    </main>
  );
}
