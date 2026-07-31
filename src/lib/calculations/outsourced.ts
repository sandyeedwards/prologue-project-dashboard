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
