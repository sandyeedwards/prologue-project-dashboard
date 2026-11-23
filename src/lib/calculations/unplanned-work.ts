export type UnplannedTaskInput = {
  id: string;
  parentTaskId: string | null;
  estimatedMinutes: number | null;
};

export function identifyUnplannedTopLevelTasks<T extends UnplannedTaskInput>(
  tasks: readonly T[],
  loggedMinutesByTaskId: ReadonlyMap<string, number>,
  coveredByCanonicalEstimate: ReadonlySet<string>,
): T[] {
  return tasks.filter(
    (task) =>
      task.parentTaskId === null &&
      (task.estimatedMinutes ?? 0) <= 0 &&
      (loggedMinutesByTaskId.get(task.id) ?? 0) > 0 &&
      !coveredByCanonicalEstimate.has(task.id),
  );
}

/**
 * Admin time is expected and carries no hour estimates. Each Admin-group task list with no
 * estimated task is "unbudgeted": its time is left out of the unplanned flags but still counts in
 * actual hours and labor cost. A list that has estimates (Ready Set "Project Management") is
 * reviewed like any other work, without pulling the $0 "Admin" list next to it in with it.
 */
export function unbudgetedAdminTaskIds(
  tasks: readonly { id: string; taskListId: string; estimatedMinutes: number | null }[],
  taskLists: readonly { id: string; operationalGroup: string }[],
): Set<string> {
  const adminListIds = new Set(
    taskLists.filter((list) => list.operationalGroup === "Admin").map((list) => list.id),
  );
  const budgetedListIds = new Set(
    tasks
      .filter((task) => adminListIds.has(task.taskListId) && (task.estimatedMinutes ?? 0) > 0)
      .map((task) => task.taskListId),
  );
  return new Set(
    tasks
      .filter((task) => adminListIds.has(task.taskListId) && !budgetedListIds.has(task.taskListId))
      .map((task) => task.id),
  );
}
