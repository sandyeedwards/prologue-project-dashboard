import type { CanonicalTaskMetric } from "./types";

// Vendor expense actuals belong in cost-to-date. Vendor task hour estimates
// are reference data and must not become additional costed remaining work.
export function deliveryCostForecast(
  actualCost: number,
  remainingInternalLabor: number,
  projectFinished: boolean,
): number {
  return actualCost + (projectFinished ? 0 : remainingInternalLabor);
}

interface TaskHierarchyRecord {
  id: string;
  parentTaskId: string | null;
  name: string;
}

export function createOutsourcedBranchResolver(
  tasks: readonly TaskHierarchyRecord[],
  isOutsourcedName: (name: string) => boolean,
): (taskId: string) => boolean {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const cache = new Map<string, boolean>();

  return (taskId: string): boolean => {
    const cached = cache.get(taskId);
    if (cached !== undefined) return cached;

    const visited = new Set<string>();
    let current = taskById.get(taskId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (isOutsourcedName(current.name)) {
        cache.set(taskId, true);
        return true;
      }
      current = current.parentTaskId ? taskById.get(current.parentTaskId) : undefined;
    }

    cache.set(taskId, false);
    return false;
  };
}

export function sumInternalCanonicalEstimatedMinutes(
  taskIds: readonly string[],
  metrics: ReadonlyMap<string, CanonicalTaskMetric>,
  isOutsourcedBranch: (taskId: string) => boolean,
): number {
  return taskIds.reduce((sum, taskId) => {
    const metric = metrics.get(taskId);

    if (!metric?.isCanonicalHolder || isOutsourcedBranch(taskId)) {
      return sum;
    }

    return sum + metric.countedEstimatedMinutes;
  }, 0);
}
