"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";
import { combineProjectForecasts } from "@/lib/reporting/forecast-position";
import { dateLabel, hours, money, percent, reportingTimestamp } from "@/lib/reporting/format";
import {
  filterMeetingProjects,
  forecastConfidence,
  meetingTaskComplete,
  type MeetingProject,
  type MeetingTask,
  type meetingWindow,
} from "@/lib/reporting/mmm-report";
import styles from "@/app/mmm/mmm.module.css";

function amount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function projectTone(project: MeetingProject): "red" | "amber" | "green" {
  return project.signals.some((signal) => signal.tone === "red")
    ? "red"
    : project.signals.length
      ? "amber"
      : "green";
}

function forecastRow(project: MeetingProject) {
  const metrics = project.metrics;
  const revenue = amount(metrics?.clientFee);
  if (!metrics || revenue === null) return null;
  const actual = amount(metrics.actualTotalCost);
  const cost = amount(metrics.forecastCost);
  return {
    label: project.name,
    revenue,
    cost,
    actualCost: actual,
    remainingCost: cost === null || actual === null ? null : Math.max(cost - actual, 0),
    profit: amount(metrics.forecastProfit),
    margin: amount(metrics.forecastMarginPercent),
    projectCount: 1,
    provisional: metrics.isProvisional,
  };
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
                <tr
                  key={task.id}
                  data-tone={
                    overdue
                      ? "red"
                      : holder && !complete && (task.remainingMinutes ?? 0) === 0
                        ? "amber"
                        : undefined
                  }
                >
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

function ProjectBreakdown({
  project,
  teamworkBase,
  today,
}: {
  project: MeetingProject;
  teamworkBase: string | null;
  today: string;
}) {
  const tone = projectTone(project);
  const outlook = forecastRow(project);
  const openTasks = project.tasks.length - project.completedTasks;
  return (
    <div className={styles.projectBody}>
      <header className={styles.breakdownHeader} data-tone={tone}>
        <div>
          <p className="eyebrow">Project breakdown</p>
          <h3>{project.name}</h3>
          <p>
            {project.companyName ?? "No client"} · {project.owner ?? "No owner"} ·{" "}
            {dateLabel(project.startDate)} – {dateLabel(project.endDate)}
          </p>
          <p>
            <span className={styles.dealLabel}>HubSpot deal</span>{" "}
            {project.hubspotDeal ? (
              project.hubspotDeal.url ? (
                <a href={project.hubspotDeal.url} target="_blank" rel="noreferrer">
                  {project.hubspotDeal.name ?? "Linked deal (name unavailable)"}
                </a>
              ) : (
                (project.hubspotDeal.name ?? "Linked deal (name unavailable)")
              )
            ) : (
              <span className={styles.muted}>No linked deal found</span>
            )}
          </p>
        </div>
        <div className={styles.links}>
          <Link className="button button--secondary button--small" href={`/projects/${project.id}`}>
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
      </header>

      <div className={styles.breakdownGrid}>
        <section className={styles.signals} data-tone={tone} aria-label="Discussion points">
          <h4>
            {tone === "red"
              ? "Action needed"
              : tone === "amber"
                ? "Review before relying on the forecast"
                : "No current flags"}
          </h4>
          {project.signals.length ? (
            <ul>
              {project.signals.map((signal) => (
                <li data-tone={signal.tone} key={signal.label}>
                  {signal.label}
                </li>
              ))}
            </ul>
          ) : (
            <p>No current delivery or reporting flags.</p>
          )}
          <p className={styles.activity}>
            <strong>Last week:</strong> {hours(project.lastWeekMinutes)} logged ·{" "}
            {project.completedLastWeek} tasks completed
            <br />
            <strong>This week:</strong> {project.dueThisWeek} open tasks due ·{" "}
            {project.overdueTasks} overdue
          </p>
        </section>
        <section className={styles.outlook} aria-label="Financial outlook">
          <h4>Profit forecast</h4>
          {outlook ? (
            <PortfolioFinancialComposition rows={[outlook]} variant="total" showHeroMetrics />
          ) : (
            <p className="chart-empty">
              {project.metrics
                ? "No client fee is recorded, so profit cannot be forecast."
                : "This project has not been calculated yet."}
            </p>
          )}
          {/* With a forecast bar shown, the bar carries the provisional note itself. */}
          {project.metrics?.isProvisional && !outlook ? (
            <p className={styles.warning}>Provisional: missing inputs may increase costs.</p>
          ) : null}
        </section>
      </div>

      <div className={styles.stats}>
        <div>
          <span>Tasks complete</span>
          <strong>
            {project.completedTasks} / {project.tasks.length}
          </strong>
          <small>
            {openTasks} open ·{" "}
            {project.progressPercent === null
              ? "no tasks"
              : `${percent(project.progressPercent, 0)} complete`}
          </small>
        </div>
        <div>
          <span>Logged of internal estimate</span>
          <strong>{hours(project.metrics?.loggedMinutes)}</strong>
          <small>of {hours(project.metrics?.canonicalEstimatedMinutes)} estimated</small>
        </div>
        <div data-tone="blue">
          <span>Estimated remaining</span>
          <strong>{hours(project.remainingMinutes)}</strong>
          <small>Unused estimates on open internal work</small>
        </div>
        <div
          data-tone={
            project.forecastMinutes === null
              ? "amber"
              : (project.varianceMinutes ?? 0) > 0
                ? "red"
                : "blue"
          }
        >
          <span>Projected final hours</span>
          <strong>{hours(project.forecastMinutes)}</strong>
          <small>{variance(project.varianceMinutes)}</small>
        </div>
      </div>
      {project.unallocatedMinutes > 0 ? (
        <p className={styles.freshness}>
          {hours(project.unallocatedMinutes)} of logged time has no task and is included in the
          project total.
        </p>
      ) : null}

      <h4>Work-group progress</h4>
      <div className="table-wrap">
        <table className={`data-table ${styles.stageTable}`}>
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
                <td data-label="Tasks complete">
                  {stage.completed}/{stage.tasks.length}
                  {stage.tasks.length ? (
                    <progress
                      max={stage.tasks.length}
                      value={stage.completed}
                      aria-label={`${stage.name}: ${stage.completed} of ${stage.tasks.length} tasks complete`}
                    />
                  ) : null}
                </td>
                <td data-label="Internal estimate">{hours(stage.estimatedMinutes)}</td>
                <td data-label="Logged">{hours(stage.loggedMinutes)}</td>
                <td data-label="Estimated remaining">{hours(stage.remainingMinutes)}</td>
                <td
                  data-label="Projected final hours"
                  data-tone={
                    stage.forecastMinutes === null
                      ? "amber"
                      : stage.forecastMinutes > (stage.estimatedMinutes ?? 0)
                        ? "red"
                        : "blue"
                  }
                >
                  <strong>{hours(stage.forecastMinutes)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className={styles.taskReview} data-print-open>
        <summary>
          <span>Task review</span>
          <small>
            {openTasks} open · {project.overdueTasks} overdue · {project.exhaustedEstimates}{" "}
            estimate{project.exhaustedEstimates === 1 ? "" : "s"} used up
          </small>
        </summary>
        <TaskDetail project={project} teamworkBase={teamworkBase} today={today} />
      </details>
      <p className={styles.freshness}>
        Last source sync: {reportingTimestamp(project.lastSyncedAt)} · Forecast calculated:{" "}
        {reportingTimestamp(project.metrics?.calculatedAt)}
      </p>
    </div>
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
  const [focusId, setFocusId] = useState<string | null>(null);
  // Bring a newly opened project into the middle of the screen. A breakdown taller than the
  // window is aligned to its project row instead, so the row and summary stay visible.
  useEffect(() => {
    if (!focusId) return;
    const frame = requestAnimationFrame(() => {
      const row = document.getElementById(`meeting-row-${focusId}`);
      const panel = document.getElementById(`meeting-${focusId}`);
      if (!row) return;
      const top = row.getBoundingClientRect().top + window.scrollY;
      const height = row.offsetHeight + (panel?.offsetHeight ?? 0);
      const target =
        height < window.innerHeight * 0.9 ? top - (window.innerHeight - height) / 2 : top - 16;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(target, 0), behavior: reduce ? "auto" : "smooth" });
      setFocusId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, expanded]);
  const visible = useMemo(
    () => filterMeetingProjects(projects, { query, owner, client, focus, sort }),
    [projects, query, owner, client, focus, sort],
  );
  const owners = [...new Set(projects.map((p) => p.owner ?? "Unassigned"))].sort();
  const clients = [...new Set(projects.map((p) => p.companyName ?? "No client"))].sort();
  const openTasks = visible.reduce((sum, p) => sum + p.tasks.length - p.completedTasks, 0);
  const overdue = visible.reduce((sum, p) => sum + p.overdueTasks, 0);
  const knownHours = visible.filter((p) => p.forecastMinutes !== null);
  const needsDiscussion = visible.filter((p) => p.signals.length);
  const actionNeeded = visible.filter((p) => projectTone(p) === "red");
  const dueThisWeek = visible.reduce((sum, p) => sum + p.dueThisWeek, 0);
  const loggedMinutes = visible.reduce((sum, p) => sum + (p.metrics?.loggedMinutes ?? 0), 0);
  const estimatedMinutes = visible.reduce(
    (sum, p) => sum + (p.metrics?.canonicalEstimatedMinutes ?? 0),
    0,
  );
  // Each project counted once: fully costed, provisional, or without a forecast.
  const confidence = forecastConfidence(visible);
  // Same rule as Company Overview: only projects with a fee, current costs and forecast cost are
  // combined, so revenue − forecast cost equals the stated profit; the rest are counted.
  const combined = combineProjectForecasts(visible.flatMap((p) => (p.metrics ? [p.metrics] : [])));
  const meetingForecast = combined
    ? {
        label: "Active projects shown",
        detail: `${combined.includedCount} of ${visible.length} projects${
          visible.length - combined.includedCount
            ? ` · ${visible.length - combined.includedCount} excluded: not calculated, or fee or costs missing`
            : ""
        }`,
        revenue: combined.revenue,
        cost: combined.forecastCost,
        actualCost: combined.actualCost,
        remainingCost: combined.remainingCost,
        profit: combined.profit,
        margin: combined.margin,
        projectCount: combined.includedCount,
        provisional: combined.provisionalCount > 0,
      }
    : null;
  const meetingPulse = !visible.length
    ? "No active projects match these filters."
    : actionNeeded.length
      ? `${actionNeeded.length} project${actionNeeded.length === 1 ? " needs" : "s need"} action this week${overdue ? `, with ${overdue} overdue task${overdue === 1 ? "" : "s"}` : ""}.`
      : needsDiscussion.length
        ? `No urgent actions; ${needsDiscussion.length} project${needsDiscussion.length === 1 ? " has" : "s have"} inputs or estimates to review.`
        : "Every project shown is on track with no current flags.";
  const oldestCalculation = projects
    .map((p) => p.metrics?.calculatedAt)
    .filter((value): value is Date => !!value)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const review = (id: string) => {
    const opening = !expanded.has(id);
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (opening) setFocusId(id);
  };
  const reset = () => {
    setQuery("");
    setOwner("ALL");
    setClient("ALL");
    setFocus("ALL");
    setSort("PRIORITY");
  };
  return (
    <main className={`shell shell--wide executive-dashboard mmm-report ${styles.workspace}`}>
      <div className="breadcrumb">
        <Link href="/dashboard">Company Overview</Link>
        <span>/</span>
        <span>MMM</span>
      </div>
      <section className="report-titlebar report-titlebar--executive">
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
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  document
                    .querySelectorAll<HTMLDetailsElement>("details[data-print-open]")
                    .forEach((details) => (details.open = true));
                  window.print();
                }),
              );
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
      <section className="company-pulse company-pulse--executive" aria-label="Meeting summary">
        <div className="company-pulse__summary">
          <p className="eyebrow">This week</p>
          <h2>{meetingPulse}</h2>
          {needsDiscussion.length && focus !== "ATTENTION" ? (
            <button
              type="button"
              className={styles.pulseLink}
              onClick={() => setFocus("ATTENTION")}
            >
              Show {needsDiscussion.length} project{needsDiscussion.length === 1 ? "" : "s"} to
              discuss
            </button>
          ) : null}
        </div>
        <div className="company-pulse__stat">
          <span>Projects to discuss</span>
          <strong>
            {needsDiscussion.length} of {visible.length}
          </strong>
          <small>
            {actionNeeded.length} need action · {projects.length} active in total
          </small>
        </div>
        <div className="company-pulse__stat">
          <span>Open tasks</span>
          <strong>{openTasks}</strong>
          <small>
            {overdue} overdue · {dueThisWeek} due this week
          </small>
        </div>
        <div className="company-pulse__stat">
          <span>Hours used</span>
          <strong>
            {estimatedMinutes ? percent((loggedMinutes / estimatedMinutes) * 100, 0) : "N/A"}
          </strong>
          <small>
            {hours(loggedMinutes)} of {hours(estimatedMinutes)} internal estimate ·{" "}
            {knownHours.length
              ? `${hours(knownHours.reduce((total, p) => total + (p.forecastMinutes ?? 0), 0))} projected`
              : "projection unavailable"}
          </small>
        </div>
        <div className="company-pulse__stat">
          <span>Forecast confidence</span>
          <strong>
            {confidence.fullyCosted} of {visible.length}
          </strong>
          <small>
            {confidence.provisional || confidence.withoutForecast
              ? [
                  confidence.provisional ? `${confidence.provisional} provisional` : null,
                  confidence.withoutForecast
                    ? `${confidence.withoutForecast} without a forecast`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "all fully costed"}
          </small>
        </div>
      </section>
      <section className="report-section company-forecast-strip company-forecast-strip--full">
        <div className="company-forecast-strip__heading">
          <div>
            <p className="eyebrow">Financial outlook</p>
            <h2>Profit Forecast</h2>
            <p>
              Combined forecast for the active projects shown, from the shared project calculation.
            </p>
          </div>
          <span>Reflects the filters below.</span>
        </div>
        {meetingForecast ? (
          <PortfolioFinancialComposition rows={[meetingForecast]} variant="total" showHeroMetrics />
        ) : (
          <div className="chart-empty">No calculated client fees for the projects shown.</div>
        )}
      </section>
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
          <div className={styles.agendaActions}>
            <span className="section-meta" aria-live="polite">
              {visible.length} projects shown
            </span>
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
        <p className={styles.legend}>
          <span data-tone="red">Action needed</span>
          <span data-tone="amber">Review inputs or estimates</span>
          <span data-tone="blue">Projected figures</span>
          <span data-tone="green">No current flags</span>
        </p>
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
                <Fragment key={project.id}>
                  <tr
                    id={`meeting-row-${project.id}`}
                    className={styles.projectRow}
                    data-tone={
                      project.signals.some((s) => s.tone === "red")
                        ? "red"
                        : project.signals.length
                          ? "amber"
                          : "green"
                    }
                    data-expanded={expanded.has(project.id)}
                  >
                    <td>
                      <button
                        className={styles.projectButton}
                        onClick={() => review(project.id)}
                        aria-expanded={expanded.has(project.id)}
                        aria-controls={`meeting-${project.id}`}
                      >
                        <span className={styles.expandIcon} aria-hidden="true">
                          {expanded.has(project.id) ? "−" : "+"}
                        </span>
                        {project.projectNumber && !project.name.includes(project.projectNumber)
                          ? `${project.projectNumber} · `
                          : ""}
                        {project.name}
                      </button>
                      <small>
                        {project.companyName ?? "No client"} · {project.owner ?? "No owner"}
                      </small>
                      {project.hubspotDeal ? (
                        <small className={styles.dealName}>
                          HubSpot: {project.hubspotDeal.name ?? "linked deal (name unavailable)"}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Task completion">
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
                    <td
                      data-label="Logged / estimated"
                      data-tone={
                        project.metrics &&
                        project.metrics.loggedMinutes > project.metrics.canonicalEstimatedMinutes
                          ? "red"
                          : undefined
                      }
                    >
                      <strong>{hours(project.metrics?.loggedMinutes)}</strong>
                      <small>
                        of {hours(project.metrics?.canonicalEstimatedMinutes)} estimated
                      </small>
                    </td>
                    <td
                      data-label="Projected finish hours"
                      data-tone={
                        project.forecastMinutes === null
                          ? "amber"
                          : (project.varianceMinutes ?? 0) > 0
                            ? "red"
                            : "blue"
                      }
                    >
                      <strong>{hours(project.forecastMinutes)}</strong>
                      <small
                        className={
                          (project.varianceMinutes ?? 0) > 0 ? styles.warning : styles.muted
                        }
                      >
                        {variance(project.varianceMinutes)}
                      </small>
                    </td>
                    <td data-label="Projected profit">
                      <strong
                        className={
                          project.metrics?.forecastProfit == null
                            ? styles.muted
                            : Number(project.metrics.forecastProfit) < 0
                              ? styles.negative
                              : project.metrics.isProvisional
                                ? styles.warning
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
                    <td data-label="Discuss / delivery">
                      {project.signals.length ? (
                        <>
                          <span
                            className={styles.statusBadge}
                            data-tone={
                              project.signals.some((signal) => signal.tone === "red")
                                ? "red"
                                : "amber"
                            }
                          >
                            {project.signals.some((signal) => signal.tone === "red")
                              ? "Action needed"
                              : "Review"}
                          </span>
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
                  {expanded.has(project.id) ? (
                    <tr className={styles.expandedRow}>
                      <td colSpan={6}>
                        <section
                          id={`meeting-${project.id}`}
                          aria-label={`${project.name} project breakdown`}
                          className={styles.inlineBreakdown}
                        >
                          <ProjectBreakdown
                            project={project}
                            teamworkBase={teamworkBase}
                            today={period.today}
                          />
                        </section>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length ? (
          <p className="empty-panel">No active projects match these filters.</p>
        ) : null}
      </section>
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
