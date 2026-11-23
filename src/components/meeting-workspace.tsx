"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";
import { combineProjectForecasts } from "@/lib/reporting/forecast-position";
import { formatHoursUsed, hoursUsedPercent } from "@/lib/reporting/labels";
import { dateLabel, hours, money, percent, reportingTimestamp } from "@/lib/reporting/format";
import {
  filterMeetingProjects,
  forecastConfidence,
  meetingTaskComplete,
  type MeetingProject,
  type MeetingStage,
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

/** One-line, plain-language status for a work group. Missing values are said, never shown as 0. */
function workGroupStatus(stage: MeetingStage): {
  text: string;
  tone: "red" | "amber" | "blue" | "green";
} {
  const allDone = stage.tasks.length > 0 && stage.completed === stage.tasks.length;
  if (stage.estimatedMinutes === null || stage.estimatedMinutes === 0)
    return { text: `No estimate · ${hours(stage.loggedMinutes)} logged`, tone: "amber" };
  const over = stage.loggedMinutes - stage.estimatedMinutes;
  if (over > 0) return { text: `${hours(over)} over estimate`, tone: "red" };
  if (allDone) return { text: `Done · ${hours(-over)} under estimate`, tone: "green" };
  if (stage.remainingMinutes === null) return { text: "Remaining hours unknown", tone: "amber" };
  const openTasks = stage.tasks.length - stage.completed;
  if (stage.remainingMinutes === 0 && openTasks > 0)
    return {
      text: `Estimate used up · ${openTasks} task${openTasks === 1 ? "" : "s"} open`,
      tone: "amber",
    };
  return { text: `${hours(stage.remainingMinutes)} remaining`, tone: "blue" };
}

// Hours for each work group on one shared scale: logged time (blue, red past the estimate),
// remaining estimate (hatched) and a marker at the estimate. Task progress sits beside it.
function WorkGroupChart({ stages }: { stages: MeetingStage[] }) {
  if (!stages.length) return <p className={styles.muted}>No work groups for this project.</p>;
  const scale = Math.max(
    1,
    ...stages.map((stage) =>
      Math.max(
        stage.estimatedMinutes ?? 0,
        stage.loggedMinutes + (stage.remainingMinutes ?? 0),
        stage.forecastMinutes ?? 0,
      ),
    ),
  );
  const pct = (minutes: number) => `${Math.max(0, Math.min(minutes / scale, 1)) * 100}%`;
  return (
    <div className={styles.groupChart}>
      <div className={styles.groupLegend} aria-hidden="true">
        <span data-key="logged">Logged</span>
        <span data-key="over">Over estimate</span>
        <span data-key="remaining">Remaining estimate</span>
        <span data-key="marker">Estimate</span>
      </div>
      {stages.map((stage) => {
        const estimate = stage.estimatedMinutes;
        const withinEstimate =
          estimate === null ? stage.loggedMinutes : Math.min(stage.loggedMinutes, estimate);
        const over = estimate === null ? 0 : Math.max(stage.loggedMinutes - estimate, 0);
        const remaining = stage.remainingMinutes ?? 0;
        const status = workGroupStatus(stage);
        const taskShare = stage.tasks.length ? stage.completed / stage.tasks.length : 0;
        return (
          <div className={styles.groupRow} key={stage.name}>
            <div className={styles.groupName}>
              <strong>{stage.name}</strong>
              <small>
                {stage.tasks.length
                  ? `${stage.completed} of ${stage.tasks.length} task${stage.tasks.length === 1 ? "" : "s"} done`
                  : "No tasks"}
              </small>
              <span className={styles.groupTasks} aria-hidden="true">
                <span style={{ width: `${taskShare * 100}%` }} />
              </span>
            </div>
            <div
              className={styles.groupTrack}
              role="img"
              aria-label={`${stage.name}: ${hours(stage.loggedMinutes)} logged of ${hours(estimate)} estimated, ${hours(stage.remainingMinutes)} remaining. ${status.text}.`}
            >
              <span className={styles.groupLogged} style={{ width: pct(withinEstimate) }} />
              {over > 0 ? (
                <span
                  className={styles.groupOver}
                  style={{ left: pct(withinEstimate), width: pct(over) }}
                />
              ) : null}
              {remaining > 0 ? (
                <span
                  className={styles.groupRemaining}
                  style={{ left: pct(stage.loggedMinutes), width: pct(remaining) }}
                />
              ) : null}
              {estimate ? (
                <span className={styles.groupMarker} style={{ left: pct(estimate) }} />
              ) : null}
            </div>
            <div className={styles.groupStatus} data-status={status.tone}>
              <strong>
                {hours(stage.loggedMinutes)} <small>of {hours(estimate)}</small>
              </strong>
              <span>{status.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function variance(minutes: number | null) {
  return minutes === null
    ? "No estimate to compare"
    : minutes > 0
      ? `${hours(minutes)} over estimate`
      : minutes < 0
        ? `${hours(-minutes)} under estimate`
        : "At estimate";
}

export type TaskFilter = "open" | "overdue" | "week" | "estimate" | "used" | "all";

type MeetingPeriod = { today: string; weekStart: string; weekEnd: string };

function estimateUsedUp(task: MeetingTask) {
  return (
    !!task.isCanonicalHolder &&
    !task.isOutsourced &&
    !task.isBranchComplete &&
    !meetingTaskComplete(task) &&
    (task.countedEstimatedMinutes ?? 0) > 0 &&
    (task.branchLoggedMinutes ?? 0) >= (task.countedEstimatedMinutes ?? 0)
  );
}

function taskMatchesFilter(
  task: MeetingTask,
  filter: TaskFilter,
  needsEstimate: Set<string>,
  period: MeetingPeriod,
) {
  const open = !meetingTaskComplete(task);
  if (filter === "all") return true;
  if (filter === "open") return open;
  if (filter === "overdue") return open && !!task.dueDate && task.dueDate < period.today;
  if (filter === "week")
    return (
      open && !!task.dueDate && task.dueDate >= period.weekStart && task.dueDate <= period.weekEnd
    );
  if (filter === "estimate") return needsEstimate.has(task.id);
  return estimateUsedUp(task);
}

function TaskDetail({
  project,
  teamworkBase,
  period,
  filter,
  onFilter,
}: {
  project: MeetingProject;
  teamworkBase: string | null;
  period: MeetingPeriod;
  filter: TaskFilter;
  onFilter: (filter: TaskFilter) => void;
}) {
  const today = period.today;
  const [taskQuery, setTaskQuery] = useState("");
  const query = taskQuery.trim().toLowerCase();
  const needsEstimate = new Set(project.missingEstimateTasks.map((task) => task.id));
  const chips: Array<{ key: TaskFilter; label: string }> = [
    { key: "open", label: "Open" },
    { key: "overdue", label: "Overdue" },
    { key: "week", label: "Due this week" },
    { key: "estimate", label: "Needs estimate" },
    { key: "used", label: "Estimate used up" },
    { key: "all", label: "All tasks" },
  ];
  const countFor = (key: TaskFilter) =>
    project.tasks.filter((task) => taskMatchesFilter(task, key, needsEstimate, period)).length;
  const visible = project.tasks.filter(
    (task) =>
      taskMatchesFilter(task, filter, needsEstimate, period) &&
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
      <div className={styles.taskChips} role="group" aria-label="Show tasks">
        {chips.map((chip) => {
          const count = countFor(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              className={styles.taskChip}
              aria-pressed={filter === chip.key}
              data-tone={
                count &&
                (chip.key === "overdue"
                  ? "red"
                  : chip.key === "estimate" || chip.key === "used"
                    ? "amber"
                    : undefined)
              }
              onClick={() => onFilter(chip.key)}
            >
              {chip.label} <span>{count}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.taskControls}>
        <label>
          Find a task or assignee
          <input
            value={taskQuery}
            onChange={(event) => setTaskQuery(event.target.value)}
            placeholder="Task, work group, list, or person"
          />
        </label>
        <span>
          Showing {visible.length} of {project.tasks.length} tasks
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
                    {needsEstimate.has(task.id) ? (
                      <strong className={styles.warning}>Needs estimate</strong>
                    ) : !task.metricsAvailable ? (
                      <>
                        {hours(task.ownEstimatedMinutes ?? 0)}
                        <small>From Teamwork · not yet calculated</small>
                      </>
                    ) : task.isOutsourced ? (
                      "Vendor work"
                    ) : holder ? (
                      hours(task.countedEstimatedMinutes)
                    ) : task.coveredByTaskId ? (
                      "Included in parent estimate"
                    ) : project.tasks.some((child) => child.parentTaskId === task.id) ? (
                      "See subtasks"
                    ) : (
                      "No estimate"
                    )}
                  </td>
                  <td>
                    {hours(task.ownLoggedMinutes)}
                    <small>{hours(task.lastWeekMinutes)} last week</small>
                  </td>
                  <td>
                    {!task.metricsAvailable
                      ? hours(Math.max((task.ownEstimatedMinutes ?? 0) - task.ownLoggedMinutes, 0))
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
  period,
  onClose,
}: {
  project: MeetingProject;
  teamworkBase: string | null;
  period: MeetingPeriod;
  onClose: () => void;
}) {
  const [review, setReview] = useState<{ open: boolean; filter: TaskFilter }>({
    open: false,
    filter: "open",
  });
  // Open the task review at a given filter, e.g. from "Needs estimate" or "Overdue".
  const showTasks = (filter: TaskFilter) => setReview({ open: true, filter });
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
            {project.jobType ?? "Other"} · {project.companyName ?? "No client"} ·{" "}
            {project.owner ?? "No owner"} · {dateLabel(project.startDate)} –{" "}
            {dateLabel(project.endDate)}
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
          {project.missingEstimateTasks.length ? (
            <div className={styles.needsEstimate}>
              <strong>Tagged &ldquo;Estimate Hours&rdquo; but no estimate entered:</strong>
              <ul>
                {project.missingEstimateTasks.slice(0, 6).map((task) => (
                  <li key={task.id}>
                    {teamworkBase ? (
                      <a
                        href={`${teamworkBase}/app/tasks/${task.teamworkId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {task.name}
                      </a>
                    ) : (
                      task.name
                    )}{" "}
                    <small>{task.taskListName}</small>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.inlineAction}
                onClick={() => showTasks("estimate")}
              >
                {project.missingEstimateTasks.length > 6
                  ? `Show all ${project.missingEstimateTasks.length} in task review`
                  : "Show in task review"}
              </button>
            </div>
          ) : null}
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
          <strong>
            {project.remainingMinutes === null ? "No tasks yet" : hours(project.remainingMinutes)}
          </strong>
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
          {project.forecastMinutes === null && project.missingEstimateTasks.length ? (
            <>
              <strong>Needs estimates</strong>
              <small>
                <button
                  type="button"
                  className={styles.inlineAction}
                  onClick={() => showTasks("estimate")}
                >
                  {project.missingEstimateTasks.length} Estimate Hours task
                  {project.missingEstimateTasks.length === 1 ? "" : "s"} without hours
                </button>
              </small>
            </>
          ) : (
            <>
              <strong>{hours(project.forecastMinutes)}</strong>
              <small>{variance(project.varianceMinutes)}</small>
            </>
          )}
        </div>
      </div>
      {project.unallocatedMinutes > 0 ? (
        <p className={styles.freshness}>
          {hours(project.unallocatedMinutes)} of logged time has no task and is included in the
          project total.
        </p>
      ) : null}

      <h4>Work-group progress</h4>
      <WorkGroupChart stages={project.stages} />

      <section className={styles.taskReview} data-open={review.open} aria-label="Task review">
        <div className={styles.taskReviewHeader}>
          <button
            type="button"
            className={styles.taskReviewToggle}
            aria-expanded={review.open}
            aria-controls={`task-review-${project.id}`}
            onClick={() => setReview((current) => ({ ...current, open: !current.open }))}
          >
            <span aria-hidden="true">{review.open ? "▾" : "▸"}</span>
            {review.open ? "Hide task review" : "Show task review"}
          </button>
          <div className={styles.reviewShortcuts}>
            {[
              { key: "open" as const, label: `${openTasks} open`, show: true },
              {
                key: "overdue" as const,
                label: `${project.overdueTasks} overdue`,
                show: project.overdueTasks > 0,
                tone: "red",
              },
              {
                key: "week" as const,
                label: `${project.dueThisWeek} due this week`,
                show: project.dueThisWeek > 0,
              },
              {
                key: "estimate" as const,
                label: `${project.missingEstimateTasks.length} need an estimate`,
                show: project.missingEstimateTasks.length > 0,
                tone: "amber",
              },
              {
                key: "used" as const,
                label: `${project.exhaustedEstimates} estimate${project.exhaustedEstimates === 1 ? "" : "s"} used up`,
                show: project.exhaustedEstimates > 0,
                tone: "amber",
              },
            ]
              .filter((item) => item.show)
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.taskChip}
                  data-tone={item.tone}
                  onClick={() => showTasks(item.key)}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </div>
        <div id={`task-review-${project.id}`} className={styles.taskReviewBody}>
          <TaskDetail
            project={project}
            teamworkBase={teamworkBase}
            period={period}
            filter={review.filter}
            onFilter={(filter) => setReview({ open: true, filter })}
          />
        </div>
      </section>
      <div className={styles.breakdownFooter}>
        <p className={styles.freshness}>
          Last source sync: {reportingTimestamp(project.lastSyncedAt)} · Forecast calculated:{" "}
          {reportingTimestamp(project.metrics?.calculatedAt)}
        </p>
        <button type="button" className="button button--secondary button--small" onClick={onClose}>
          Close {project.projectNumber ?? "project"} ▴
        </button>
      </div>
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
  // Closing from the bottom of a long breakdown returns you to that project's row.
  const closeProject = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => {
      const row = document.getElementById(`meeting-row-${id}`);
      if (!row) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      row.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
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
          <strong>{formatHoursUsed(hoursUsedPercent(loggedMinutes, estimatedMinutes))}</strong>
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
                    // The whole row opens or closes the project; links and buttons inside keep
                    // their own action. The name button remains the keyboard control.
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a, button, input, select")) return;
                      review(project.id);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.projectButton}
                        onClick={() => review(project.id)}
                        aria-expanded={expanded.has(project.id)}
                        aria-controls={`meeting-${project.id}`}
                      >
                        <span className={styles.expandIcon} aria-hidden="true">
                          {expanded.has(project.id) ? "▾" : "▸"}
                        </span>
                        {project.projectNumber && !project.name.includes(project.projectNumber)
                          ? `${project.projectNumber} · `
                          : ""}
                        {project.name}
                      </button>
                      <span className={styles.jobType}>{project.jobType ?? "Other"}</span>
                      <small>
                        {project.companyName ?? "No client"} · {project.owner ?? "No owner"}
                      </small>
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
                      {project.forecastMinutes === null && project.missingEstimateTasks.length ? (
                        <>
                          <strong className={styles.warning}>Needs estimates</strong>
                          <small>
                            {project.missingEstimateTasks
                              .slice(0, 2)
                              .map((task) => task.name)
                              .join(", ")}
                            {project.missingEstimateTasks.length > 2
                              ? ` +${project.missingEstimateTasks.length - 2} more`
                              : ""}{" "}
                            tagged Estimate Hours without hours
                          </small>
                        </>
                      ) : project.forecastMinutes === null ? (
                        <>
                          <strong>No tasks yet</strong>
                          <small className={styles.muted}>Add tasks in Teamwork</small>
                        </>
                      ) : (
                        <>
                          <strong>{hours(project.forecastMinutes)}</strong>
                          <small
                            className={
                              (project.varianceMinutes ?? 0) > 0 ? styles.warning : styles.muted
                            }
                          >
                            {variance(project.varianceMinutes)}
                            {project.uncalculatedTasks
                              ? ` · includes ${project.uncalculatedTasks} new task${project.uncalculatedTasks === 1 ? "" : "s"}`
                              : ""}
                          </small>
                        </>
                      )}
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
                            period={period}
                            onClose={() => closeProject(project.id)}
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
