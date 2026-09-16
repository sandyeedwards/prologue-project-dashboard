export const COMPARE_PROJECT_LIMIT = 6;

// Thirty UUID query parameters use roughly 1.4 KB, leaving room for the route and filters
// beneath conservative request-line limits enforced by browsers and reverse proxies.
export const COMBINE_PROJECT_LIMIT = 30;

export type ProjectSelectionMode = "compare" | "combine";

export function projectSelectionLimit(mode: ProjectSelectionMode): number {
  return mode === "compare" ? COMPARE_PROJECT_LIMIT : COMBINE_PROJECT_LIMIT;
}

export function projectSelectionExceedsLimit(
  mode: ProjectSelectionMode,
  projectIds: string[],
): boolean {
  return new Set(projectIds).size > projectSelectionLimit(mode);
}

export function combinedProjectsHref(projectIds: string[]): string | null {
  const uniqueProjectIds = [...new Set(projectIds)];
  if (!uniqueProjectIds.length || uniqueProjectIds.length > COMBINE_PROJECT_LIMIT) return null;

  const search = new URLSearchParams();
  search.set("mode", "combine");
  uniqueProjectIds.forEach((projectId) => search.append("project", projectId));
  return `/projects?${search.toString()}`;
}
