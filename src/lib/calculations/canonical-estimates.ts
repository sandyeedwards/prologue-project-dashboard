import type { CalculationTaskInput, CanonicalTaskMetric } from "./types";

function isCompleted(task: CalculationTaskInput): boolean {
  const status = task.status.toLowerCase();
  return task.completedAt !== null || status === "completed" || status === "complete";
}

export function calculateCanonicalTaskMetrics(
  tasks: readonly CalculationTaskInput[],
  loggedMinutesByTaskId: ReadonlyMap<string, number>,
): Map<string, CanonicalTaskMetric> {
  const activeTasks = tasks.filter((task) => !task.isDeleted);
  const byId = new Map(activeTasks.map((task) => [task.id, task]));
  const children = new Map<string, CalculationTaskInput[]>();

  for (const task of activeTasks) {
    if (task.parentTaskId && byId.has(task.parentTaskId)) {
      const list = children.get(task.parentTaskId) ?? [];
      list.push(task);
      children.set(task.parentTaskId, list);
    }
  }

  const result = new Map<string, CanonicalTaskMetric>();
  const visiting = new Set<string>();

  const visit = (task: CalculationTaskInput): CanonicalTaskMetric => {
    const existing = result.get(task.id);
    if (existing) return existing;
    if (visiting.has(task.id)) {
      throw new Error(`Task hierarchy cycle detected at task ${task.teamworkId}.`);
    }
    visiting.add(task.id);

    const childMetrics = (children.get(task.id) ?? []).map(visit);
    const childEstimate = childMetrics.reduce((sum, child) => sum + child.branchEstimatedMinutes, 0);
    const ownEstimate = Math.max(0, task.estimatedMinutes ?? 0);
    const estimateSource = childEstimate > 0 ? "CHILDREN" : ownEstimate > 0 ? "OWN" : "NONE";
    const countedEstimate = estimateSource === "OWN" ? ownEstimate : 0;
    const branchEstimate = estimateSource === "CHILDREN" ? childEstimate : ownEstimate;
    const ownLogged = Math.max(0, loggedMinutesByTaskId.get(task.id) ?? 0);
    const branchLogged =
      ownLogged + childMetrics.reduce((sum, child) => sum + child.branchLoggedMinutes, 0);
    const branchComplete =
      isCompleted(task) ||
      ((children.get(task.id) ?? []).length > 0 && childMetrics.every((child) => child.isBranchComplete));
    const remaining = branchComplete ? 0 : Math.max(branchEstimate - branchLogged, 0);
    const descendantTaskIds = childMetrics.flatMap((child) => [child.taskId, ...child.descendantTaskIds]);

    const metric: CanonicalTaskMetric = {
      taskId: task.id,
      estimateSource,
      ownEstimatedMinutes: ownEstimate,
      countedEstimatedMinutes: countedEstimate,
      branchEstimatedMinutes: branchEstimate,
      ownLoggedMinutes: ownLogged,
      branchLoggedMinutes: branchLogged,
      remainingMinutes: remaining,
      isCanonicalHolder: estimateSource === "OWN",
      isBranchComplete: branchComplete,
      descendantTaskIds,
    };
    result.set(task.id, metric);
    visiting.delete(task.id);
    return metric;
  };

  for (const task of activeTasks) visit(task);
  return result;
}

export function rootTaskIds(tasks: readonly CalculationTaskInput[]): string[] {
  const active = tasks.filter((task) => !task.isDeleted);
  const ids = new Set(active.map((task) => task.id));
  return active
    .filter((task) => task.parentTaskId === null || !ids.has(task.parentTaskId))
    .map((task) => task.id);
}
