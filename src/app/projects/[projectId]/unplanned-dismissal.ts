/**
 * Keeps one issue per task: the first one seen. Callers pass issues ordered
 * newest-detected first, so each task keeps its latest detection and the
 * dismissal records that detection's logged minutes.
 */
export function latestIssuePerTask<T extends { taskId: string | null }>(
  issues: T[],
): Array<T & { taskId: string }> {
  const seen = new Set<string>();
  const latest: Array<T & { taskId: string }> = [];
  for (const issue of issues) {
    if (!issue.taskId || seen.has(issue.taskId)) continue;
    seen.add(issue.taskId);
    latest.push(issue as T & { taskId: string });
  }
  return latest;
}
