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
};

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
  progressPercent: number | null;
  remainingMinutes: number | null;
  forecastMinutes: number | null;
  varianceMinutes: number | null;
  lastWeekMinutes: number;
  unallocatedMinutes: number;
  signals: MeetingSignal[];
};

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
    const missingMetrics =
      !projectMetrics || !!taskCountChanged || tasks.some((task) => !task.metricsAvailable);
    const holders = tasks.filter((task) => task.isCanonicalHolder && !task.isOutsourced);
    const remainingMinutes = missingMetrics
      ? null
      : holders.reduce(
          (sum, task) => sum + (task.isBranchComplete ? 0 : (task.remainingMinutes ?? 0)),
          0,
        );
    const forecastMinutes =
      projectMetrics && remainingMinutes !== null && projectMetrics.canonicalEstimatedMinutes > 0
        ? projectMetrics.loggedMinutes + remainingMinutes
        : null;
    const unestimatedTasks = open.filter(
      (task) =>
        !task.isOutsourced &&
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
    if (!tasks.length) signal("amber", "No imported tasks; confirm the project setup");
    else if (!open.length) signal("amber", "All tasks are complete; confirm project closeout");
    if (taskCountChanged)
      signal(
        "amber",
        "Task list changed since the forecast calculation; recalculate before relying on hours",
      );
    if (missingMetrics) signal("amber", "Calculations are missing for this project or some tasks");
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
        const completeMetrics = stageTasks.every((task) => task.metricsAvailable);
        const internal = stageTasks.filter((task) => !task.isOutsourced && task.isCanonicalHolder);
        const estimate = completeMetrics
          ? internal.reduce((sum, task) => sum + (task.countedEstimatedMinutes ?? 0), 0)
          : null;
        const remaining = completeMetrics
          ? internal.reduce(
              (sum, task) => sum + (task.isBranchComplete ? 0 : (task.remainingMinutes ?? 0)),
              0,
            )
          : null;
        const logged = stageTasks.reduce((sum, task) => sum + task.ownLoggedMinutes, 0);
        return {
          name,
          tasks: stageTasks,
          completed: stageTasks.filter(meetingTaskComplete).length,
          estimatedMinutes: estimate,
          loggedMinutes: logged,
          remainingMinutes: remaining,
          forecastMinutes: estimate && remaining !== null ? logged + remaining : null,
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
      progressPercent: tasks.length ? (completedTasks / tasks.length) * 100 : null,
      completedLastWeek: tasks.filter(
        (task) =>
          task.completedAt &&
          currentTimeReportingDate(task.completedAt) >= window.lastWeekStart &&
          currentTimeReportingDate(task.completedAt) <= window.lastWeekEnd,
      ).length,
      remainingMinutes,
      forecastMinutes,
      varianceMinutes:
        forecastMinutes !== null && projectMetrics
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
