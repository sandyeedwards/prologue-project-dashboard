import type { ProjectReportRow } from "./dashboard-data";
import { isProjectFinished } from "@/lib/calculations/project-completion";
import { currentTimeReportingDate } from "./time-reporting-rules";

export type MeetingProjectSource = {
  id: string;
  teamworkId: number;
  name: string;
  projectNumber: string | null;
  companyName: string | null;
  owner: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  archivedAt: Date | null;
  completedAt: Date | null;
  lastSyncedAt: Date | null;
  /** Teamwork project type and tags, used to show the job type (Scanning, Modeling, ...). */
  projectType?: string | null;
  tags?: string[];
  /** One job type label (Scanning, Modeling, Scanning and Modeling, Ready Set, Data Hall, Other). */
  jobType?: string;
};

export type MeetingTask = {
  id: string;
  projectId: string;
  teamworkId: number;
  parentTaskId: string | null;
  name: string;
  taskListName: string;
  group: string;
  status: string;
  dueDate: string | null;
  completedAt: Date | null;
  assignees: string[];
  ownLoggedMinutes: number;
  lastWeekMinutes: number;
  countedEstimatedMinutes: number | null;
  branchLoggedMinutes: number | null;
  remainingMinutes: number | null;
  isCanonicalHolder: boolean | null;
  isBranchComplete: boolean | null;
  isOutsourced: boolean;
  coveredByTaskId: string | null;
  metricsAvailable: boolean;
  /** The task's own Teamwork estimate, used for tasks added since the last calculation. */
  ownEstimatedMinutes?: number | null;
  /** Teamwork task tag names, e.g. "Estimate Hours". */
  tags?: string[];
};

export type MeetingTaskRef = Pick<
  MeetingTask,
  "id" | "teamworkId" | "name" | "taskListName" | "group"
>;

const normalizedTag = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
/** Tasks tagged "Estimate Hours" in Teamwork must carry an hour estimate. */
export function taskRequiresEstimate(task: Pick<MeetingTask, "tags">): boolean {
  return (task.tags ?? []).some((tag) => normalizedTag(tag) === "estimatehours");
}

export function meetingWindow(now = new Date()) {
  const today = currentTimeReportingDate(now);
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const shift = (days: number) =>
    new Date(monday.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  return {
    today,
    weekStart: shift(0),
    weekEnd: shift(6),
    lastWeekStart: shift(-7),
    lastWeekEnd: shift(-1),
  };
}

export function isActiveMeetingProject(project: MeetingProjectSource): boolean {
  return project.status.trim().toLowerCase() === "active" && !isProjectFinished(project);
}

export function meetingTaskComplete(task: Pick<MeetingTask, "status" | "completedAt">): boolean {
  return (
    !!task.completedAt ||
    ["complete", "completed", "closed"].includes(task.status.trim().toLowerCase())
  );
}

export type MeetingSignal = { tone: "red" | "amber"; label: string };
export type MeetingStage = {
  name: string;
  /** Name shown on MMM. */
  label: string;
  /**
   * Unbudgeted Admin: no task in the group has an estimate, so its hours are tracked as a share
   * of the project instead of against an estimate.
   */
  unbudgeted: boolean;
  /** Group logged hours as a percent of all task-linked logged hours on the project. */
  sharePercent: number | null;
  tasks: MeetingTask[];
  completed: number;
  estimatedMinutes: number | null;
  loggedMinutes: number;
  remainingMinutes: number | null;
  forecastMinutes: number | null;
};
export type MeetingProject = MeetingProjectSource & {
  metrics: ProjectReportRow | null;
  tasks: MeetingTask[];
  stages: MeetingStage[];
  completedTasks: number;
  completedLastWeek: number;
  overdueTasks: number;
  dueThisWeek: number;
  undatedTasks: number;
  unestimatedTasks: number;
  exhaustedEstimates: number;
  /** Open tasks tagged "Estimate Hours" that have no estimate: why projected hours are missing. */
  missingEstimateTasks: MeetingTaskRef[];
  /** Open tasks added since the last calculation; their own Teamwork estimates are used. */
  uncalculatedTasks: number;
  progressPercent: number | null;
  remainingMinutes: number | null;
  forecastMinutes: number | null;
  varianceMinutes: number | null;
  lastWeekMinutes: number;
  unallocatedMinutes: number;
  signals: MeetingSignal[];
};

/** Typical Admin share of logged hours on finished projects, for the soft warning on MMM. */
export type AdminBenchmark = {
  /** Median Admin share, percent. */
  typicalPercent: number;
  /** Upper quartile: above this, Admin is flagged for a look. */
  highPercent: number;
  projectCount: number;
};

/** Admin is only flagged once it is a meaningful amount of time, so small projects stay quiet. */
export const ADMIN_SHARE_MIN_MINUTES = 8 * 60;
/** Need enough finished projects before a "typical" share means anything. */
export const ADMIN_BENCHMARK_MIN_PROJECTS = 5;

function percentile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/**
 * Builds the benchmark from finished projects' Admin share. Projects with no logged time are
 * skipped (their share is unknown, not 0). Returns null without enough projects.
 */
export function adminBenchmark(
  rows: readonly { adminMinutes: number; loggedMinutes: number }[],
): AdminBenchmark | null {
  const shares = rows
    .filter((row) => row.loggedMinutes > 0)
    .map((row) => (row.adminMinutes / row.loggedMinutes) * 100)
    .sort((a, b) => a - b);
  if (shares.length < ADMIN_BENCHMARK_MIN_PROJECTS) return null;
  return {
    typicalPercent: percentile(shares, 0.5),
    highPercent: percentile(shares, 0.75),
    projectCount: shares.length,
  };
}

const groupOrder = ["Admin", "Mobilization", "Fieldwork", "Modeling"];
export function compareMeetingGroups(a: string, b: string): number {
  const rank = (name: string) =>
    groupOrder.includes(name) ? groupOrder.indexOf(name) : groupOrder.length;
  return rank(a) - rank(b) || a.localeCompare(b);
}

export function buildMeetingProjects(
  sources: readonly MeetingProjectSource[],
  metrics: readonly ProjectReportRow[],
  taskRows: readonly MeetingTask[],
  activity: readonly { projectId: string; lastWeekMinutes: number; unallocatedMinutes: number }[],
  now = new Date(),
  benchmark: AdminBenchmark | null = null,
): MeetingProject[] {
  const window = meetingWindow(now);
  const metricsById = new Map(metrics.map((row) => [row.id, row]));
  const activityById = new Map(activity.map((row) => [row.projectId, row]));
  const tasksByProject = new Map<string, MeetingTask[]>();
  for (const task of taskRows) {
    const rows = tasksByProject.get(task.projectId) ?? [];
    rows.push(task);
    tasksByProject.set(task.projectId, rows);
  }
  return sources.filter(isActiveMeetingProject).map((source) => {
    const projectMetrics = metricsById.get(source.id) ?? null;
    const rawTasks = tasksByProject.get(source.id) ?? [];
    const byId = new Map(rawTasks.map((task) => [task.id, task]));
    // An outsourced holder also covers its unestimated child tasks. Never add
    // those vendor estimates to the internal remaining-hours forecast.
    const outsourced = (task: MeetingTask): boolean => {
      const seen = new Set<string>();
      let current: MeetingTask | undefined = task;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        if (current.isOutsourced) return true;
        current = current.parentTaskId ? byId.get(current.parentTaskId) : undefined;
      }
      return false;
    };
    const tasks = rawTasks.map((task) => ({ ...task, isOutsourced: outsourced(task) }));
    const open = tasks.filter((task) => !meetingTaskComplete(task));
    const completedTasks = tasks.length - open.length;
    const overdueTasks = open.filter((task) => task.dueDate && task.dueDate < window.today).length;
    const dueThisWeek = open.filter(
      (task) => task.dueDate && task.dueDate >= window.weekStart && task.dueDate <= window.weekEnd,
    ).length;
    const taskCountChanged =
      projectMetrics &&
      typeof projectMetrics.totalTaskCount === "number" &&
      projectMetrics.totalTaskCount !== tasks.length;
    const hasChildren = (task: MeetingTask) =>
      tasks.some((child) => child.parentTaskId === task.id);
    // A task under a calculated estimate holder is already covered by that holder's estimate.
    const underCalculatedHolder = (task: MeetingTask): boolean => {
      const seen = new Set<string>();
      let parent = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
      while (parent && !seen.has(parent.id)) {
        seen.add(parent.id);
        if (parent.metricsAvailable && parent.isCanonicalHolder) return true;
        parent = parent.parentTaskId ? byId.get(parent.parentTaskId) : undefined;
      }
      return false;
    };
    const holders = tasks.filter((task) => task.isCanonicalHolder && !task.isOutsourced);
    // Tasks added since the last calculation: count their own estimate less their own time, so
    // projected hours stay current instead of going blank until the next recalculation.
    const uncalculated = open.filter(
      (task) =>
        !task.metricsAvailable &&
        !task.isOutsourced &&
        !hasChildren(task) &&
        !underCalculatedHolder(task),
    );
    const hasEstimate = (task: MeetingTask) =>
      (task.ownEstimatedMinutes ?? 0) > 0 || (task.countedEstimatedMinutes ?? 0) > 0;
    // Admin with no estimates anywhere is expected, unbudgeted time (Ready Set Project Management
    // is estimated, so it is reviewed like other work).
    const adminTasks = tasks.filter((task) => task.group === "Admin");
    const adminUnbudgeted = adminTasks.length > 0 && !adminTasks.some(hasEstimate);
    // Judged per list, so a budgeted "Project Management" list does not pull the $0 "Admin" list
    // beside it into the missing-estimate count.
    const budgetedAdminLists = new Set(
      adminTasks.filter(hasEstimate).map((task) => task.taskListName),
    );
    const expectedAdminTime = (task: MeetingTask) =>
      task.group === "Admin" && !budgetedAdminLists.has(task.taskListName);
    // Projected hours are only "missing" when a task that must be estimated ("Estimate Hours"
    // tag) has no estimate. Those tasks are named so they can be fixed in Teamwork.
    const missingEstimateTasks: MeetingTaskRef[] = open
      .filter(
        (task) =>
          taskRequiresEstimate(task) &&
          !task.isOutsourced &&
          !hasEstimate(task) &&
          !(task.coveredByTaskId && task.coveredByTaskId !== task.id) &&
          !tasks.some((child) => child.parentTaskId === task.id && hasEstimate(child)),
      )
      .map(({ id, teamworkId, name, taskListName, group }) => ({
        id,
        teamworkId,
        name,
        taskListName,
        group,
      }));
    const taskRemaining = (task: MeetingTask) =>
      task.metricsAvailable
        ? task.isBranchComplete
          ? 0
          : (task.remainingMinutes ?? 0)
        : Math.max((task.ownEstimatedMinutes ?? 0) - task.ownLoggedMinutes, 0);
    const remainingMinutes = tasks.length
      ? holders.reduce((sum, task) => sum + taskRemaining(task), 0) +
        uncalculated.reduce((sum, task) => sum + taskRemaining(task), 0)
      : null;
    const loggedBase =
      projectMetrics?.loggedMinutes ??
      tasks.reduce((sum, task) => sum + task.ownLoggedMinutes, 0) +
        (activityById.get(source.id)?.unallocatedMinutes ?? 0);
    const forecastMinutes =
      remainingMinutes !== null && !missingEstimateTasks.length
        ? loggedBase + remainingMinutes
        : null;
    const unestimatedTasks = open.filter(
      (task) =>
        !task.isOutsourced &&
        !expectedAdminTime(task) &&
        task.metricsAvailable &&
        !task.coveredByTaskId &&
        !task.isCanonicalHolder &&
        !(task.countedEstimatedMinutes ?? 0) &&
        !tasks.some((child) => child.parentTaskId === task.id),
    ).length;
    const exhaustedEstimates = holders.filter(
      (task) =>
        !task.isBranchComplete &&
        (task.countedEstimatedMinutes ?? 0) > 0 &&
        (task.branchLoggedMinutes ?? 0) >= (task.countedEstimatedMinutes ?? 0),
    ).length;
    const signals: MeetingSignal[] = [];
    const signal = (tone: MeetingSignal["tone"], label: string) => signals.push({ tone, label });
    if (source.endDate && source.endDate < window.today && open.length)
      signal("red", `Project end date passed; ${open.length} tasks still open`);
    if (overdueTasks) signal("red", `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}`);
    const profit =
      projectMetrics?.forecastProfit == null ? null : Number(projectMetrics.forecastProfit);
    if (profit !== null && profit < 0) signal("red", "Projected costs exceed the client fee");
    if (
      forecastMinutes !== null &&
      projectMetrics &&
      forecastMinutes > projectMetrics.canonicalEstimatedMinutes
    )
      signal("amber", "Projected hours exceed the internal estimate");
    if (exhaustedEstimates)
      signal(
        "amber",
        `${exhaustedEstimates} unfinished estimate${exhaustedEstimates === 1 ? " is" : "s are"} fully used; remaining effort needs review`,
      );
    if (unestimatedTasks)
      signal(
        "amber",
        `${unestimatedTasks} open task${unestimatedTasks === 1 ? " has" : "s have"} no internal hour estimate`,
      );
    const undatedTasks = open.filter((task) => !task.dueDate).length;
    if (undatedTasks)
      signal(
        "amber",
        `${undatedTasks} open task${undatedTasks === 1 ? " has" : "s have"} no due date`,
      );
    if (!source.endDate) signal("amber", "Project end date is missing");
    const taskLoggedMinutes = tasks.reduce((sum, task) => sum + task.ownLoggedMinutes, 0);
    const adminLoggedMinutes = adminTasks.reduce((sum, task) => sum + task.ownLoggedMinutes, 0);
    const adminShare =
      taskLoggedMinutes > 0 ? (adminLoggedMinutes / taskLoggedMinutes) * 100 : null;
    if (
      adminUnbudgeted &&
      benchmark &&
      adminShare !== null &&
      adminLoggedMinutes >= ADMIN_SHARE_MIN_MINUTES &&
      adminShare > benchmark.highPercent
    )
      signal(
        "amber",
        `Admin is ${Math.round(adminShare)}% of hours logged (typical ${Math.round(benchmark.typicalPercent)}%)`,
      );
    if (!tasks.length) signal("amber", "No imported tasks; confirm the project setup");
    else if (!open.length) signal("amber", "All tasks are complete; confirm project closeout");
    if (taskCountChanged)
      signal(
        "amber",
        "Task list changed since the forecast calculation; recalculate before relying on hours",
      );
    if (missingEstimateTasks.length)
      signal(
        "amber",
        `${missingEstimateTasks.length} task${missingEstimateTasks.length === 1 ? " is" : "s are"} tagged Estimate Hours but ${missingEstimateTasks.length === 1 ? "has" : "have"} no estimate`,
      );
    if (!projectMetrics) signal("amber", "Not calculated yet; hours use Teamwork task estimates");
    else if (uncalculated.length)
      signal(
        "amber",
        `${uncalculated.length} task${uncalculated.length === 1 ? "" : "s"} added since the last calculation; their own estimates are used`,
      );
    if (projectMetrics?.isProvisional)
      signal("amber", "Provisional forecast: cost or budget inputs need review");
    if (projectMetrics?.dataQualityIssueCount)
      signal("amber", `${projectMetrics.dataQualityIssueCount} reporting data issues`);
    if (source.lastSyncedAt && projectMetrics && source.lastSyncedAt > projectMetrics.calculatedAt)
      signal("amber", "Source sync is newer than the forecast calculation");
    const stages = [...new Set(tasks.map((task) => task.group))]
      .sort(compareMeetingGroups)
      .map((name) => {
        const stageTasks = tasks.filter((task) => task.group === name);
        const internal = stageTasks.filter((task) => !task.isOutsourced && task.isCanonicalHolder);
        const stageNew = uncalculated.filter((task) => task.group === name);
        const estimate =
          internal.reduce((sum, task) => sum + (task.countedEstimatedMinutes ?? 0), 0) +
          stageNew.reduce((sum, task) => sum + (task.ownEstimatedMinutes ?? 0), 0);
        const remaining =
          internal.reduce((sum, task) => sum + taskRemaining(task), 0) +
          stageNew.reduce((sum, task) => sum + taskRemaining(task), 0);
        const logged = stageTasks.reduce((sum, task) => sum + task.ownLoggedMinutes, 0);
        const stageMissing = missingEstimateTasks.some((task) => task.group === name);
        const unbudgeted = name === "Admin" && adminUnbudgeted;
        return {
          name,
          label: name,
          unbudgeted,
          sharePercent: taskLoggedMinutes > 0 ? (logged / taskLoggedMinutes) * 100 : null,
          tasks: stageTasks,
          completed: stageTasks.filter(meetingTaskComplete).length,
          estimatedMinutes: estimate,
          loggedMinutes: logged,
          remainingMinutes: stageMissing ? null : remaining,
          forecastMinutes: stageMissing ? null : logged + remaining,
        };
      });
    return {
      ...source,
      metrics: projectMetrics,
      tasks,
      stages,
      completedTasks,
      overdueTasks,
      dueThisWeek,
      undatedTasks,
      unestimatedTasks,
      exhaustedEstimates,
      missingEstimateTasks,
      uncalculatedTasks: uncalculated.length,
      progressPercent: tasks.length ? (completedTasks / tasks.length) * 100 : null,
      completedLastWeek: tasks.filter(
        (task) =>
          task.completedAt &&
          currentTimeReportingDate(task.completedAt) >= window.lastWeekStart &&
          currentTimeReportingDate(task.completedAt) <= window.lastWeekEnd,
      ).length,
      remainingMinutes,
      forecastMinutes,
      // With no estimate at all there is nothing to be over or under.
      varianceMinutes:
        forecastMinutes !== null && projectMetrics && projectMetrics.canonicalEstimatedMinutes > 0
          ? forecastMinutes - projectMetrics.canonicalEstimatedMinutes
          : null,
      lastWeekMinutes: activityById.get(source.id)?.lastWeekMinutes ?? 0,
      unallocatedMinutes: activityById.get(source.id)?.unallocatedMinutes ?? 0,
      signals,
    };
  });
}

export function filterMeetingProjects(
  projects: readonly MeetingProject[],
  filters: { query?: string; owner?: string; client?: string; focus?: string; sort?: string } = {},
): MeetingProject[] {
  const query = filters.query?.trim().toLowerCase();
  const rows = projects.filter(
    (project) =>
      (!query ||
        [project.name, project.projectNumber, project.companyName, project.owner]
          .join(" ")
          .toLowerCase()
          .includes(query)) &&
      (!filters.owner ||
        filters.owner === "ALL" ||
        (project.owner ?? "Unassigned") === filters.owner) &&
      (!filters.client ||
        filters.client === "ALL" ||
        (project.companyName ?? "No client") === filters.client) &&
      (filters.focus !== "ATTENTION" || project.signals.length > 0) &&
      (filters.focus !== "DUE" || project.dueThisWeek > 0) &&
      (filters.focus !== "OVERDUE" || project.overdueTasks > 0),
  );
  return rows.sort((a, b) => {
    if (filters.sort === "NAME") return a.name.localeCompare(b.name);
    if (filters.sort === "END")
      return (
        (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999") || a.name.localeCompare(b.name)
      );
    const red = (p: MeetingProject) => p.signals.filter((signal) => signal.tone === "red").length;
    return (
      red(b) - red(a) ||
      b.signals.length - a.signals.length ||
      b.overdueTasks - a.overdueTasks ||
      (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999") ||
      a.name.localeCompare(b.name)
    );
  });
}

export type ForecastConfidence = {
  /** Calculated, has a client fee, and is not provisional. */
  fullyCosted: number;
  /** Has a forecast (calculated, with a client fee) but it is provisional. */
  provisional: number;
  /** Not calculated, or no client fee, so no profit forecast at all. */
  withoutForecast: number;
};

/**
 * Splits the projects shown into three groups that never overlap, so each project is counted
 * once: fully costed + provisional + without a forecast = projects shown. A provisional project
 * with no client fee counts only as "without a forecast".
 */
export function forecastConfidence(
  projects: readonly Pick<MeetingProject, "metrics">[],
): ForecastConfidence {
  const result: ForecastConfidence = { fullyCosted: 0, provisional: 0, withoutForecast: 0 };
  for (const { metrics } of projects) {
    const fee =
      metrics?.clientFee === null || metrics?.clientFee === undefined || metrics.clientFee === ""
        ? null
        : Number(metrics.clientFee);
    if (!metrics || fee === null || !Number.isFinite(fee)) result.withoutForecast += 1;
    else if (metrics.isProvisional) result.provisional += 1;
    else result.fullyCosted += 1;
  }
  return result;
}
