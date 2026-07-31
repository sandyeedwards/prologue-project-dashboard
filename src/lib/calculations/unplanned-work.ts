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
