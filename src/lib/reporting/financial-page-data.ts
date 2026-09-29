import {
  filterAndSortProjects,
  getAvailableProjectTypes,
  getPortfolioHistoricalProfitSeries,
  getPortfolioOperationalGroups,
  getProjectRows,
  summarizeProjects,
  type ProjectFilter,
} from "@/lib/reporting/dashboard-data";

type ParamValue = string | string[] | undefined;

function one(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: ParamValue): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function getFinancialPageData(
  params: Record<string, ParamValue>,
  options: { includeHistory?: boolean } = {},
) {
  const allProjects = await getProjectRows();
  const filter: ProjectFilter = {
    clients: many(params.client),
    healths: many(params.health),
    statuses: many(params.status),
    types: many(params.type),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
  };
  const projects = filterAndSortProjects(allProjects, filter);
  const summary = summarizeProjects(projects);
  const operationalGroups = await getPortfolioOperationalGroups(projects);
  const historicalProfitSeries = options.includeHistory
    ? await getPortfolioHistoricalProfitSeries(projects)
    : undefined;
  const reconciliationRows = operationalGroups.map((group) => ({
    label: group.groupName,
    detail: `${group.projectCount} project${group.projectCount === 1 ? "" : "s"}`,
    revenue: group.allocatedRevenue,
    cost: group.forecastCost,
    actualCost: group.actualCostToDate,
    remainingCost: group.remainingCost,
    profit: group.forecastProfit,
    margin: group.marginPercent,
    projectCount: group.projectCount,
  }));
  const profitabilityRows = reconciliationRows.filter((row) => row.label !== "Unclassified");
  const effortRows = operationalGroups
    .filter((group) => group.groupName !== "Unclassified")
    .map((group) => ({
      label: group.groupName,
      detail: `${group.projectCount} project${group.projectCount === 1 ? "" : "s"}`,
      values: {
        estimated: group.estimatedMinutes / 60,
        logged: group.loggedMinutes / 60,
      },
    }));
  const totalRevenue = reconciliationRows.reduce((sum, row) => sum + (row.revenue ?? 0), 0);
  const totalForecastCost = reconciliationRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const actualComplete = reconciliationRows.every((row) => row.actualCost != null);
  const remainingComplete = reconciliationRows.every((row) => row.remainingCost != null);
  const totalProfitabilityRow = reconciliationRows.length
    ? {
        label: "Company total",
        detail: `${summary.projectCount} project${summary.projectCount === 1 ? "" : "s"}`,
        revenue: totalRevenue,
        cost: totalForecastCost,
        actualCost: actualComplete
          ? reconciliationRows.reduce((sum, row) => sum + (row.actualCost ?? 0), 0)
          : null,
        remainingCost: remainingComplete
          ? reconciliationRows.reduce((sum, row) => sum + (row.remainingCost ?? 0), 0)
          : null,
        profit: totalRevenue - totalForecastCost,
        margin: totalRevenue > 0 ? ((totalRevenue - totalForecastCost) / totalRevenue) * 100 : null,
        projectCount: summary.projectCount,
      }
    : null;

  return {
    filter,
    projects,
    summary,
    profitabilityRows,
    effortRows,
    totalProfitabilityRow,
    historicalProfitSeries,
    clients: [
      ...new Set(
        allProjects
          .map((row) => row.companyName)
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort(),
    statuses: [...new Set(allProjects.map((row) => row.status).filter(Boolean))].sort(),
    types: getAvailableProjectTypes(allProjects),
  };
}
