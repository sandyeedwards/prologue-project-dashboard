import type { ProjectFilter } from "./dashboard-data";

type DashboardFilterOptions = {
  clients: string[];
  statuses: string[];
  types: string[];
};

export function dashboardFilterStateKey(
  filter: ProjectFilter,
  options: DashboardFilterOptions,
): string {
  return JSON.stringify([
    filter.clients ?? [],
    filter.healths ?? [],
    filter.statuses ?? [],
    filter.types ?? [],
    filter.dateFrom ?? null,
    filter.dateTo ?? null,
    options.clients,
    options.statuses,
    options.types,
  ]);
}
