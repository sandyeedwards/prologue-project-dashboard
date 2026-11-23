type SearchParamValues = Record<string, string | string[] | undefined>;

/**
 * Filters that carry across the work-queue tabs. Status is left out because each
 * tab is itself a status view, and the page limit restarts on a new tab.
 */
const TAB_CARRIED_PARAMS = ["q", "severity", "code", "path", "project", "scope", "platform"];

export const ISSUE_GROUP_PAGE_SIZE = 100;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function issuesHref(entries: Array<[string, string | undefined]>): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    const trimmed = value?.trim();
    // "ALL" is the default for every filter, but not for view (which defaults to ATTENTION).
    if (trimmed && (key === "view" || trimmed !== "ALL")) query.set(key, trimmed);
  }
  const search = query.toString();
  return search ? `/teamwork-issues?${search}` : "/teamwork-issues";
}

/** Link to another work-queue tab that keeps the current search, project, and filters. */
export function issueViewHref(params: SearchParamValues, view: string): string {
  return issuesHref([
    ["view", view],
    ...TAB_CARRIED_PARAMS.map((key): [string, string | undefined] => [
      key,
      firstValue(params[key]),
    ]),
  ]);
}

/** Number of project groups to show; invalid or missing values use the default page size. */
export function issueGroupLimit(value: string | string[] | undefined): number {
  const parsed = Number(firstValue(value));
  if (!Number.isInteger(parsed) || parsed < 1) return ISSUE_GROUP_PAGE_SIZE;
  return parsed;
}

/** The current page with a larger group limit, keeping every other parameter. */
export function showMoreIssuesHref(params: SearchParamValues, currentLimit: number): string {
  return issuesHref([
    ...Object.keys(params)
      .filter((key) => key !== "limit")
      .map((key): [string, string | undefined] => [key, firstValue(params[key])]),
    ["limit", String(currentLimit + ISSUE_GROUP_PAGE_SIZE)],
  ]);
}
