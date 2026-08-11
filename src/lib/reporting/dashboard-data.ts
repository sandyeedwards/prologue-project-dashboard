import { getSqlClient } from "@/db/client";
import { normalizeTeamworkLabel } from "@/lib/teamwork/normalize";
import type { HistoricalProfitSeries } from "@/components/historical-profit-chart-types";

export type HealthBand = "GREEN" | "AMBER" | "RED" | "GRAY";
export type Coverage = "COMPLETE" | "PARTIAL" | "MISSING" | "NOT_EXPECTED";

export type ProjectReportRow = {
  id: string;
  teamworkId: number;
  projectNumber: string | null;
  name: string;
  companyName: string | null;
  status: string;
  projectType: string | null;
  startDate: string | null;
  endDate: string | null;
  archivedAt: Date | null;
  completedAt: Date | null;
  clientFee: string | null;
  targetCost: string | null;
  actualLaborCost: string | null;
  actualNonLaborCost: string | null;
  actualTotalCost: string | null;
  forecastCost: string | null;
  forecastProfit: string | null;
  forecastMarginPercent: string | null;
  canonicalEstimatedMinutes: number;
  loggedMinutes: number;
  unplannedLoggedMinutes: number;
  completedTaskCount: number;
  totalTaskCount: number;
  progressPercent: string | null;
  healthScore: string | null;
  healthBand: HealthBand;
  laborCoverage: Coverage;
  assignmentCoverage: Coverage;
  taskListBudgetCoverage: Coverage;
  expenseCoverage: Coverage;
  isProvisional: boolean;
  dataQualityIssueCount: number;
  tags: string[];
  calculatedAt: Date;
  calculationVersion: string;
};

export type DashboardSummary = {
  projectCount: number;
  provisionalCount: number;
  redCount: number;
  amberCount: number;
  greenCount: number;
  grayCount: number;
  totalClientFee: number | null;
  totalTargetCost: number | null;
  totalActualCost: number | null;
  totalForecastCost: number | null;
  totalForecastProfit: number | null;
  clientFeeKnownCount: number;
  targetCostKnownCount: number;
  actualCostKnownCount: number;
  actualCostPartialCount: number;
  forecastCostKnownCount: number;
  forecastProfitKnownCount: number;
  forecastMarginKnownCount: number;
  totalEstimatedMinutes: number;
  totalLoggedMinutes: number;
  latestCalculatedAt: Date | null;
  calculationVersion: string | null;
};

export type ProjectGroupRow = {
  groupName: string;
  targetCost: string | null;
  targetCostCoverage: Coverage;
  estimatedMinutes: number;
  loggedMinutes: number;
  projectedLaborCost: string | null;
  actualLaborCost: string | null;
  projectedNonLaborCost: string | null;
  actualNonLaborCost: string | null;
  forecastCost: string | null;
  varianceToTarget: string | null;
  progressPercent: string | null;
};

export type ProjectExpenseRow = {
  id: string;
  title: string;
  taskListName: string | null;
  operationalGroup: string | null;
  expenseDate: string | null;
  totalCost: string | null;
  isOutsourcedModeling: boolean;
};

export type ProjectTaskRow = {
  id: string;
  name: string;
  taskListName: string;
  operationalGroup: string;
  status: string;
  dueDate: string | null;
  completedAt: Date | null;
  countedEstimatedMinutes: number;
  branchLoggedMinutes: number;
  remainingMinutes: number;
  projectedLaborCost: string | null;
  actualLaborCost: string | null;
  remainingLaborCost: string | null;
  assignmentCoverage: Coverage;
  isOutsourced: boolean;
  isBranchComplete: boolean;
};

export type QualityIssueEvidenceRow = {
  id: string;
  kind: "TIME_ENTRY" | "TASK_LIST";
  label: string;
  personName: string | null;
  loggedDate: string | null;
  minutes: number | null;
  laborCost: string | null;
  description: string | null;
  teamworkUrl: string | null;
};

export type QualityIssueRow = {
  id: string;
  taskId: string | null;
  severity: "INFO" | "WARNING" | "ERROR";
  code: string;
  message: string;
  taskListName: string | null;
  taskName: string | null;
  lastDetectedAt: Date;
  details: Record<string, unknown> | null;
  teamworkUrl: string | null;
  evidence: QualityIssueEvidenceRow[];
};

export type UnplannedWorkRow = {
  issueId: string;
  projectId: string;
  taskId: string;
  teamworkTaskId: number | null;
  taskName: string;
  taskListName: string;
  loggedMinutes: number;
  laborCost: string | null;
  firstLoggedDate: string | null;
  lastLoggedDate: string | null;
  isDismissed: boolean;
  dismissedAt: Date | null;
  dismissedByName: string | null;
};

export type EmployeeLaborRow = {
  personId: string;
  displayName: string;
  email: string | null;
  loggedMinutes: number;
  actualLaborCost: string | null;
  projectCount: number;
  timeEntryCount: number;
  costCoveragePercent: number;
};

export type ProjectFilter = {
  query?: string;
  client?: string;
  health?: string;
  status?: string;
  type?: string;
  provisional?: string;
  sort?: string;
  projectIds?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export type PortfolioOperationalGroupRow = {
  groupName: "Fieldwork" | "Mobilization" | "Modeling" | "Admin" | "Unclassified";
  projectCount: number;
  allocatedRevenue: number;
  actualCostToDate: number | null;
  remainingCost: number | null;
  forecastCost: number;
  forecastProfit: number;
  marginPercent: number | null;
  estimatedMinutes: number;
  loggedMinutes: number;
  provisionalProjectCount: number;
  allocationMethods: string[];
};

export const PROJECT_TYPE_ORDER = ["Scanning", "Modeling", "Ready Set", "DataHall"] as const;

export function getProjectTypeFacets(
  row: Pick<ProjectReportRow, "projectType" | "tags">,
): string[] {
  const keys = new Set(
    [...row.tags, row.projectType]
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeTeamworkLabel(value)),
  );
  const isReadySet = keys.has("readyset");
  const isDataHall = keys.has("datahall");
  const hasScanning =
    isReadySet ||
    isDataHall ||
    keys.has("scanning") ||
    [...keys].some((key) => key.includes("scanning"));
  const hasModeling = keys.has("modeling") || [...keys].some((key) => key.includes("modeling"));
  const facets: string[] = [];
  if (hasScanning) facets.push("Scanning");
  if (hasModeling) facets.push("Modeling");
  if (isReadySet) facets.push("Ready Set");
  if (isDataHall) facets.push("DataHall");
  if (!facets.length && row.projectType) facets.push(row.projectType);
  return facets;
}

export function getAvailableProjectTypes(rows: ProjectReportRow[]): string[] {
  const available = new Set(rows.flatMap((row) => getProjectTypeFacets(row)));
  const ordered = PROJECT_TYPE_ORDER.filter((type) => available.has(type));
  const known = new Set<string>(PROJECT_TYPE_ORDER);
  const extras = [...available].filter((type) => !known.has(type)).sort();
  return [...ordered, ...extras];
}

export function normalizeDatabaseDate(value: unknown, fieldName = "timestamp"): Date {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) return value;
    throw new TypeError(`${fieldName} is an invalid Date.`);
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  throw new TypeError(`${fieldName} is not a valid database timestamp.`);
}

function normalizeOptionalDatabaseDate(value: unknown, fieldName: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  return normalizeDatabaseDate(value, fieldName);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

type RawProjectReportRow = Omit<ProjectReportRow, "calculatedAt" | "archivedAt" | "completedAt"> & {
  calculatedAt: unknown;
  archivedAt: unknown;
  completedAt: unknown;
};
type RawProjectTaskRow = Omit<ProjectTaskRow, "completedAt"> & {
  completedAt: unknown;
};
type RawQualityIssueRow = Omit<QualityIssueRow, "lastDetectedAt" | "teamworkUrl" | "evidence"> & {
  lastDetectedAt: unknown;
  taskTeamworkId: number | null;
};

type RawIssueTimeEntryRow = {
  id: string;
  teamworkId: number;
  taskId: string | null;
  taskName: string | null;
  taskListName: string | null;
  loggedDate: string;
  minutes: number;
  description: string | null;
  historicalCostTotal: string | null;
  historicalCostRate: string | null;
  costInfoReturned: boolean;
  personName: string | null;
};

export async function getProjectRows(): Promise<ProjectReportRow[]> {
  const sql = getSqlClient();
  const rows = await sql<RawProjectReportRow[]>`
    select
      p.id,
      p.teamwork_id as "teamworkId",
      p.project_number as "projectNumber",
      p.name,
      c.name as "companyName",
      p.status,
      p.project_type as "projectType",
      p.start_date as "startDate",
      p.end_date as "endDate",
      p.archived_at as "archivedAt",
      p.completed_at as "completedAt",
      pm.client_fee as "clientFee",
      pm.target_cost as "targetCost",
      pm.actual_labor_cost as "actualLaborCost",
      pm.actual_non_labor_cost as "actualNonLaborCost",
      pm.actual_total_cost as "actualTotalCost",
      pm.forecast_cost as "forecastCost",
      pm.forecast_profit as "forecastProfit",
      pm.forecast_margin_percent as "forecastMarginPercent",
      pm.canonical_estimated_minutes as "canonicalEstimatedMinutes",
      pm.logged_minutes as "loggedMinutes",
      pm.unestimated_logged_minutes as "unplannedLoggedMinutes",
      pm.completed_task_count as "completedTaskCount",
      pm.total_task_count as "totalTaskCount",
      pm.progress_percent as "progressPercent",
      pm.health_score as "healthScore",
      pm.health_band as "healthBand",
      pm.labor_coverage as "laborCoverage",
      pm.assignment_coverage as "assignmentCoverage",
      pm.task_list_budget_coverage as "taskListBudgetCoverage",
      pm.expense_coverage as "expenseCoverage",
      pm.is_provisional as "isProvisional",
      pm.calculated_at as "calculatedAt",
      cr.calculation_version as "calculationVersion",
      coalesce(dq.issue_count, 0)::int as "dataQualityIssueCount",
      coalesce(tg.tags, array[]::text[]) as tags
    from projects p
    inner join project_metrics pm on pm.project_id = p.id
    inner join calculation_runs cr on cr.id = pm.calculation_run_id
    left join companies c on c.id = p.company_id
    left join lateral (
      select count(*)::int as issue_count
      from data_quality_issues dqi
      left join unplanned_work_reviews uwr on uwr.task_id = dqi.task_id
      where dqi.project_id = p.id
        and dqi.resolved_at is null
        and (
          dqi.code <> 'UNPLANNED_ACTUAL_WORK'
          or uwr.task_id is null
          or coalesce((dqi.details ->> 'minutes')::int, 0) > uwr.dismissed_logged_minutes
        )
    ) dq on true
    left join lateral (
      select array_agg(t.name order by t.name) as tags
      from project_tags pt
      inner join tags t on t.id = pt.tag_id
      where pt.project_id = p.id
    ) tg on true
    where p.excluded_from_reporting = false
    order by p.name asc
  `;
  return rows.map((row) => ({
    ...row,
    archivedAt: normalizeOptionalDatabaseDate(row.archivedAt, `project ${row.id} archivedAt`),
    completedAt: normalizeOptionalDatabaseDate(row.completedAt, `project ${row.id} completedAt`),
    calculatedAt: normalizeDatabaseDate(row.calculatedAt, `project ${row.id} calculatedAt`),
  }));
}

function projectOverlapsDateRange(
  row: Pick<ProjectReportRow, "startDate" | "endDate">,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) return true;
  const projectStart = row.startDate ?? row.endDate;
  const projectEnd = row.endDate ?? row.startDate;
  if (!projectStart && !projectEnd) return false;
  if (dateFrom && projectEnd && projectEnd < dateFrom) return false;
  if (dateTo && projectStart && projectStart > dateTo) return false;
  return true;
}

export function filterAndSortProjects(
  rows: ProjectReportRow[],
  filter: ProjectFilter,
): ProjectReportRow[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const filtered = rows.filter((row) => {
    if (
      query &&
      ![row.projectNumber, row.name, row.companyName, row.projectType, row.status, ...row.tags]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    ) {
      return false;
    }
    if (filter.client && filter.client !== "ALL" && row.companyName !== filter.client) return false;
    if (filter.health && filter.health !== "ALL" && row.healthBand !== filter.health) return false;
    if (filter.status && filter.status !== "ALL" && row.status !== filter.status) return false;
    if (filter.type && filter.type !== "ALL" && !getProjectTypeFacets(row).includes(filter.type))
      return false;
    if (filter.provisional === "YES" && !row.isProvisional) return false;
    if (filter.provisional === "NO" && row.isProvisional) return false;
    if (!projectOverlapsDateRange(row, filter.dateFrom, filter.dateTo)) return false;
    if (filter.projectIds?.length && !filter.projectIds.includes(row.id)) return false;
    return true;
  });

  const sort = filter.sort ?? "name";
  return [...filtered].sort((a, b) => {
    if (sort === "health") {
      const rank: Record<HealthBand, number> = { RED: 0, AMBER: 1, GRAY: 2, GREEN: 3 };
      return rank[a.healthBand] - rank[b.healthBand] || a.name.localeCompare(b.name);
    }
    if (sort === "margin") {
      return (
        (numberOrNull(b.forecastMarginPercent) ?? -Infinity) -
        (numberOrNull(a.forecastMarginPercent) ?? -Infinity)
      );
    }
    if (sort === "cost") {
      return (
        (numberOrNull(b.forecastCost) ?? -Infinity) - (numberOrNull(a.forecastCost) ?? -Infinity)
      );
    }
    if (sort === "hours") return b.loggedMinutes - a.loggedMinutes;
    return a.name.localeCompare(b.name);
  });
}

export function summarizeProjects(rows: ProjectReportRow[]): DashboardSummary {
  const knownFees = rows
    .map((row) => numberOrNull(row.clientFee))
    .filter((value): value is number => value !== null);
  const knownTargets = rows
    .map((row) => numberOrNull(row.targetCost))
    .filter((value): value is number => value !== null);
  const knownActualCosts = rows
    .map((row) => numberOrNull(row.actualTotalCost))
    .filter((value): value is number => value !== null);
  const actualCostCompleteRows = rows.filter(
    (row) =>
      numberOrNull(row.actualTotalCost) !== null && actualCostCoverageStatus(row) === "COMPLETE",
  );
  const actualCostPartialRows = rows.filter(
    (row) =>
      numberOrNull(row.actualTotalCost) !== null && actualCostCoverageStatus(row) !== "COMPLETE",
  );
  const knownCosts = rows
    .map((row) => numberOrNull(row.forecastCost))
    .filter((value): value is number => value !== null);
  const knownProfits = rows
    .map((row) => numberOrNull(row.forecastProfit))
    .filter((value): value is number => value !== null);
  const knownMargins = rows
    .map((row) => numberOrNull(row.forecastMarginPercent))
    .filter((value): value is number => value !== null);
  const latest = rows.reduce<Date | null>((current, row) => {
    if (!current || row.calculatedAt.getTime() > current.getTime()) return row.calculatedAt;
    return current;
  }, null);
  return {
    projectCount: rows.length,
    provisionalCount: rows.filter((row) => row.isProvisional).length,
    redCount: rows.filter((row) => row.healthBand === "RED").length,
    amberCount: rows.filter((row) => row.healthBand === "AMBER").length,
    greenCount: rows.filter((row) => row.healthBand === "GREEN").length,
    grayCount: rows.filter((row) => row.healthBand === "GRAY").length,
    totalClientFee: knownFees.length ? knownFees.reduce((sum, value) => sum + value, 0) : null,
    totalTargetCost: knownTargets.length
      ? knownTargets.reduce((sum, value) => sum + value, 0)
      : null,
    totalActualCost: knownActualCosts.length
      ? knownActualCosts.reduce((sum, value) => sum + value, 0)
      : null,
    totalForecastCost: knownCosts.length ? knownCosts.reduce((sum, value) => sum + value, 0) : null,
    totalForecastProfit: knownProfits.length
      ? knownProfits.reduce((sum, value) => sum + value, 0)
      : null,
    clientFeeKnownCount: knownFees.length,
    targetCostKnownCount: knownTargets.length,
    actualCostKnownCount: actualCostCompleteRows.length,
    actualCostPartialCount: actualCostPartialRows.length,
    forecastCostKnownCount: knownCosts.length,
    forecastProfitKnownCount: knownProfits.length,
    forecastMarginKnownCount: knownMargins.length,
    totalEstimatedMinutes: rows.reduce((sum, row) => sum + row.canonicalEstimatedMinutes, 0),
    totalLoggedMinutes: rows.reduce((sum, row) => sum + row.loggedMinutes, 0),
    latestCalculatedAt: latest,
    calculationVersion: rows[0]?.calculationVersion ?? null,
  };
}

export type HistoricalCostRecord = {
  projectId: string;
  date: string;
  cost: number | null;
  kind: "LABOR" | "EXPENSE";
  fallbackDate: boolean;
};

type RawHistoricalCostRecord = {
  projectId: string;
  eventDate: string | null;
  cost: string | null;
  kind: "LABOR" | "EXPENSE";
  fallbackDate: boolean;
};

type HistoricalProjectEvent = {
  date: string;
  grossRevenueDelta: number;
  actualCostDelta: number;
  anticipatedCostDelta: number;
  forecastNetProfitDelta: number;
  startedProjectDelta: number;
  completedProjectDelta: number;
  grossRevenueKnownDelta: number;
  forecastCostKnownDelta: number;
  forecastProfitKnownDelta: number;
  costCoverageCompleteDelta: number;
  costCoveragePartialDelta: number;
  provisionalProjectDelta: number;
  costedTimeEntryDelta: number;
  costedExpenseDelta: number;
  missingCostRecordDelta: number;
  fallbackDatedLaborDelta: number;
  fallbackDatedExpenseDelta: number;
};

const MIN_HISTORICAL_DATE = "2000-01-01";

function isoDateFromDate(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function normalizeHistoricalDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (!match) return null;
  const normalized = match[1];
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized)
    return null;
  return normalized >= MIN_HISTORICAL_DATE ? normalized : null;
}

function completeCoverage(value: Coverage): boolean {
  return value === "COMPLETE" || value === "NOT_EXPECTED";
}

export function actualCostCoverageStatus(
  project: Pick<ProjectReportRow, "laborCoverage" | "expenseCoverage" | "actualTotalCost">,
): "COMPLETE" | "PARTIAL" | "MISSING" {
  if (completeCoverage(project.laborCoverage) && completeCoverage(project.expenseCoverage)) {
    return "COMPLETE";
  }
  return numberOrNull(project.actualTotalCost) === null ? "MISSING" : "PARTIAL";
}

function addHistoricalEvent(
  events: Map<string, HistoricalProjectEvent>,
  date: string,
  values: Omit<HistoricalProjectEvent, "date">,
): void {
  const current = events.get(date) ?? {
    date,
    grossRevenueDelta: 0,
    actualCostDelta: 0,
    anticipatedCostDelta: 0,
    forecastNetProfitDelta: 0,
    startedProjectDelta: 0,
    completedProjectDelta: 0,
    grossRevenueKnownDelta: 0,
    forecastCostKnownDelta: 0,
    forecastProfitKnownDelta: 0,
    costCoverageCompleteDelta: 0,
    costCoveragePartialDelta: 0,
    provisionalProjectDelta: 0,
    costedTimeEntryDelta: 0,
    costedExpenseDelta: 0,
    missingCostRecordDelta: 0,
    fallbackDatedLaborDelta: 0,
    fallbackDatedExpenseDelta: 0,
  };
  current.grossRevenueDelta += values.grossRevenueDelta;
  current.actualCostDelta += values.actualCostDelta;
  current.anticipatedCostDelta += values.anticipatedCostDelta;
  current.forecastNetProfitDelta += values.forecastNetProfitDelta;
  current.startedProjectDelta += values.startedProjectDelta;
  current.completedProjectDelta += values.completedProjectDelta;
  current.grossRevenueKnownDelta += values.grossRevenueKnownDelta;
  current.forecastCostKnownDelta += values.forecastCostKnownDelta;
  current.forecastProfitKnownDelta += values.forecastProfitKnownDelta;
  current.costCoverageCompleteDelta += values.costCoverageCompleteDelta;
  current.costCoveragePartialDelta += values.costCoveragePartialDelta;
  current.provisionalProjectDelta += values.provisionalProjectDelta;
  current.costedTimeEntryDelta += values.costedTimeEntryDelta;
  current.costedExpenseDelta += values.costedExpenseDelta;
  current.missingCostRecordDelta += values.missingCostRecordDelta;
  current.fallbackDatedLaborDelta += values.fallbackDatedLaborDelta;
  current.fallbackDatedExpenseDelta += values.fallbackDatedExpenseDelta;
  events.set(date, current);
}

function emptyHistoricalEvent(): Omit<HistoricalProjectEvent, "date"> {
  return {
    grossRevenueDelta: 0,
    actualCostDelta: 0,
    anticipatedCostDelta: 0,
    forecastNetProfitDelta: 0,
    startedProjectDelta: 0,
    completedProjectDelta: 0,
    grossRevenueKnownDelta: 0,
    forecastCostKnownDelta: 0,
    forecastProfitKnownDelta: 0,
    costCoverageCompleteDelta: 0,
    costCoveragePartialDelta: 0,
    provisionalProjectDelta: 0,
    costedTimeEntryDelta: 0,
    costedExpenseDelta: 0,
    missingCostRecordDelta: 0,
    fallbackDatedLaborDelta: 0,
    fallbackDatedExpenseDelta: 0,
  };
}

function actualCompletionDateForHistory(
  project: Pick<ProjectReportRow, "completedAt" | "archivedAt">,
  currentDate: string,
): string | null {
  const actualDates = [isoDateFromDate(project.completedAt), isoDateFromDate(project.archivedAt)]
    .filter((value): value is string => value !== null && value <= currentDate)
    .sort();
  return actualDates[0] ?? null;
}

function projectStartDateForHistory(
  project: ProjectReportRow,
  sourceCosts: HistoricalCostRecord[],
): string {
  const configuredStart = normalizeHistoricalDate(project.startDate);
  if (configuredStart) return configuredStart;
  const earliestSourceDate = sourceCosts
    .map((record) => normalizeHistoricalDate(record.date))
    .filter((value): value is string => value !== null)
    .sort()[0];
  const configuredEnd = normalizeHistoricalDate(project.endDate);
  const calculatedDate = project.calculatedAt.toISOString().slice(0, 10);
  return (
    [earliestSourceDate, configuredEnd, calculatedDate]
      .filter((value): value is string => value !== null && value !== undefined)
      .sort()[0] ?? calculatedDate
  );
}

export function buildHistoricalProfitSeriesFromSource(
  projectType: string,
  projects: ProjectReportRow[],
  sourceCosts: HistoricalCostRecord[],
  currentDate: string,
): HistoricalProfitSeries {
  const events = new Map<string, HistoricalProjectEvent>();
  const projectIds = new Set(projects.map((project) => project.id));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const relevantCosts = sourceCosts.filter((record) => projectIds.has(record.projectId));
  const costsByProject = new Map<string, HistoricalCostRecord[]>();
  for (const record of relevantCosts) {
    const records = costsByProject.get(record.projectId) ?? [];
    records.push(record);
    costsByProject.set(record.projectId, records);
  }

  for (const project of projects) {
    const projectCosts = costsByProject.get(project.id) ?? [];
    const startDate = projectStartDateForHistory(project, projectCosts);
    if (startDate > currentDate) continue;

    const clientFee = numberOrNull(project.clientFee);
    const anticipatedCost = numberOrNull(project.forecastCost);
    const storedForecastProfit = numberOrNull(project.forecastProfit);
    const forecastNetProfit =
      clientFee !== null && anticipatedCost !== null
        ? clientFee - anticipatedCost
        : storedForecastProfit;
    const coverageStatus = actualCostCoverageStatus(project);
    addHistoricalEvent(events, startDate, {
      ...emptyHistoricalEvent(),
      grossRevenueDelta: clientFee ?? 0,
      anticipatedCostDelta: anticipatedCost ?? 0,
      forecastNetProfitDelta: forecastNetProfit ?? 0,
      startedProjectDelta: 1,
      grossRevenueKnownDelta: clientFee === null ? 0 : 1,
      forecastCostKnownDelta: anticipatedCost === null ? 0 : 1,
      forecastProfitKnownDelta: forecastNetProfit === null ? 0 : 1,
      costCoverageCompleteDelta: coverageStatus === "COMPLETE" ? 1 : 0,
      costCoveragePartialDelta: coverageStatus === "COMPLETE" ? 0 : 1,
      provisionalProjectDelta: project.isProvisional ? 1 : 0,
    });

    const completionDate = actualCompletionDateForHistory(project, currentDate);
    if (completionDate && completionDate >= startDate) {
      addHistoricalEvent(events, completionDate, {
        ...emptyHistoricalEvent(),
        completedProjectDelta: 1,
      });
    }
  }

  for (const record of relevantCosts) {
    const normalizedDate = normalizeHistoricalDate(record.date);
    const project = projectById.get(record.projectId);
    const projectCosts = costsByProject.get(record.projectId) ?? [];
    const date =
      normalizedDate ?? (project ? projectStartDateForHistory(project, projectCosts) : currentDate);
    if (date > currentDate) continue;
    const cost = record.cost;
    const usedFallbackDate = record.fallbackDate || normalizedDate === null;
    addHistoricalEvent(events, date, {
      ...emptyHistoricalEvent(),
      actualCostDelta: cost ?? 0,
      costedTimeEntryDelta: cost !== null && record.kind === "LABOR" ? 1 : 0,
      costedExpenseDelta: cost !== null && record.kind === "EXPENSE" ? 1 : 0,
      missingCostRecordDelta: cost === null ? 1 : 0,
      fallbackDatedLaborDelta: record.kind === "LABOR" && usedFallbackDate ? 1 : 0,
      fallbackDatedExpenseDelta: record.kind === "EXPENSE" && usedFallbackDate ? 1 : 0,
    });
  }

  if (!events.size) {
    return {
      projectType,
      points: [],
      sourceActualCostTotal: 0,
      metricActualCostTotal: 0,
      reconciliationDifference: 0,
    };
  }
  if (!events.has(currentDate)) addHistoricalEvent(events, currentDate, emptyHistoricalEvent());

  let grossRevenue = 0;
  let actualCostToDate = 0;
  let anticipatedCostToDate = 0;
  let forecastNetProfitToDate = 0;
  let projectCount = 0;
  let completedProjectCount = 0;
  let grossRevenueKnownCount = 0;
  let forecastCostKnownCount = 0;
  let forecastProfitKnownCount = 0;
  let costCoverageCompleteCount = 0;
  let costCoveragePartialCount = 0;
  let provisionalProjectCount = 0;
  let costedTimeEntryCount = 0;
  let costedExpenseCount = 0;
  let missingCostRecordCount = 0;
  let fallbackDatedLaborCount = 0;
  let fallbackDatedExpenseCount = 0;

  const points: HistoricalProfitSeries["points"] = [];
  for (const event of [...events.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  )) {
    grossRevenue += event.grossRevenueDelta;
    actualCostToDate += event.actualCostDelta;
    anticipatedCostToDate += event.anticipatedCostDelta;
    forecastNetProfitToDate += event.forecastNetProfitDelta;
    projectCount += event.startedProjectDelta;
    completedProjectCount += event.completedProjectDelta;
    grossRevenueKnownCount += event.grossRevenueKnownDelta;
    forecastCostKnownCount += event.forecastCostKnownDelta;
    forecastProfitKnownCount += event.forecastProfitKnownDelta;
    costCoverageCompleteCount += event.costCoverageCompleteDelta;
    costCoveragePartialCount += event.costCoveragePartialDelta;
    provisionalProjectCount += event.provisionalProjectDelta;
    costedTimeEntryCount += event.costedTimeEntryDelta;
    costedExpenseCount += event.costedExpenseDelta;
    missingCostRecordCount += event.missingCostRecordDelta;
    fallbackDatedLaborCount += event.fallbackDatedLaborDelta;
    fallbackDatedExpenseCount += event.fallbackDatedExpenseDelta;

    points.push({
      date: event.date,
      grossRevenue,
      actualCostToDate,
      anticipatedCostToDate,
      netProfitToDate: grossRevenue - actualCostToDate,
      forecastNetProfitToDate,
      projectCount,
      completedProjectCount,
      grossRevenueKnownCount,
      forecastCostKnownCount,
      forecastProfitKnownCount,
      costCoverageCompleteCount,
      costCoveragePartialCount,
      provisionalProjectCount,
      costedTimeEntryCount,
      costedExpenseCount,
      missingCostRecordCount,
      fallbackDatedLaborCount,
      fallbackDatedExpenseCount,
    });
  }

  const sourceActualCostTotal = relevantCosts.reduce((sum, record) => sum + (record.cost ?? 0), 0);
  const metricActualCostTotal = projects.reduce(
    (sum, project) => sum + (numberOrNull(project.actualTotalCost) ?? 0),
    0,
  );

  return {
    projectType,
    points,
    sourceActualCostTotal,
    metricActualCostTotal,
    reconciliationDifference: sourceActualCostTotal - metricActualCostTotal,
  };
}

async function getHistoricalCostRecords(projectIds: string[]): Promise<HistoricalCostRecord[]> {
  if (!projectIds.length) return [];
  const sql = getSqlClient();
  const rows = await sql<RawHistoricalCostRecord[]>`
    select
      te.project_id as "projectId",
      te.logged_date::text as "eventDate",
      (
        case
          when te.historical_cost_total is not null then te.historical_cost_total
          when te.historical_cost_rate is not null then (te.minutes::numeric / 60) * te.historical_cost_rate
          else null
        end
      )::text as cost,
      'LABOR'::text as kind,
      false as "fallbackDate"
    from time_entries te
    where te.is_deleted = false
      and te.project_id = any(${projectIds}::uuid[])

    union all

    select
      e.project_id as "projectId",
      coalesce(e.expense_date, e.created_at::date)::text as "eventDate",
      e.total_cost::text as cost,
      'EXPENSE'::text as kind,
      (e.expense_date is null) as "fallbackDate"
    from expenses e
    where e.is_deleted = false
      and e.project_id = any(${projectIds}::uuid[])
  `;
  return rows.map((row) => ({
    projectId: row.projectId,
    date: row.eventDate ?? "",
    cost: numberOrNull(row.cost),
    kind: row.kind,
    fallbackDate: row.fallbackDate || normalizeHistoricalDate(row.eventDate) === null,
  }));
}

export async function getPortfolioHistoricalProfitSeries(
  projects: ProjectReportRow[],
): Promise<HistoricalProfitSeries[]> {
  if (!projects.length) return [];
  const currentDate = new Date().toISOString().slice(0, 10);
  const sourceCosts = await getHistoricalCostRecords(projects.map((project) => project.id));
  return [
    buildHistoricalProfitSeriesFromSource("All project types", projects, sourceCosts, currentDate),
  ];
}

type RawPortfolioGroupMetric = {
  projectId: string;
  groupName: string;
  targetCost: string | null;
  estimatedMinutes: number;
  loggedMinutes: number;
  actualLaborCost: string | null;
  actualNonLaborCost: string | null;
  forecastCost: string | null;
};

type GroupAccumulator = {
  groupName: PortfolioOperationalGroupRow["groupName"];
  projectIds: Set<string>;
  allocatedRevenue: number;
  actualCostToDate: number;
  actualCostKnown: boolean;
  forecastCost: number;
  forecastProfit: number;
  estimatedMinutes: number;
  loggedMinutes: number;
  provisionalProjectIds: Set<string>;
  allocationMethods: Set<string>;
};

function portfolioGroupName(
  _project: ProjectReportRow,
  groupName: string,
): PortfolioOperationalGroupRow["groupName"] {
  const normalized = normalizeTeamworkLabel(groupName);

  if (normalized === "admin" || normalized.includes("administrative")) {
    return "Admin";
  }

  if (normalized.includes("mobilization")) {
    return "Mobilization";
  }

  if (normalized.includes("modeling") || normalized.includes("modelling")) {
    return "Modeling";
  }

  if (
    normalized.includes("fieldwork") ||
    normalized.includes("fieldoperations") ||
    normalized.includes("scanning")
  ) {
    return "Fieldwork";
  }

  return "Unclassified";
}
async function getOperationalGroupMetricRows(): Promise<RawPortfolioGroupMetric[]> {
  const sql = getSqlClient();
  return sql<RawPortfolioGroupMetric[]>`
    select
      project_id as "projectId",
      group_name as "groupName",
      target_cost as "targetCost",
      estimated_minutes as "estimatedMinutes",
      logged_minutes as "loggedMinutes",
      actual_labor_cost as "actualLaborCost",
      actual_non_labor_cost as "actualNonLaborCost",
      forecast_cost as "forecastCost"
    from operational_group_metrics
  `;
}

export async function getPortfolioOperationalGroups(
  projects: ProjectReportRow[],
  sourceRows?: RawPortfolioGroupMetric[],
): Promise<PortfolioOperationalGroupRow[]> {
  if (!projects.length) return [];
  const allRows = sourceRows ?? (await getOperationalGroupMetricRows());
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const rowsByProject = new Map<string, RawPortfolioGroupMetric[]>();
  for (const row of allRows) {
    if (!projectById.has(row.projectId)) continue;
    const current = rowsByProject.get(row.projectId) ?? [];
    current.push(row);
    rowsByProject.set(row.projectId, current);
  }

  const output = new Map<PortfolioOperationalGroupRow["groupName"], GroupAccumulator>();
  const ensure = (name: PortfolioOperationalGroupRow["groupName"]): GroupAccumulator => {
    const existing = output.get(name);
    if (existing) return existing;
    const created: GroupAccumulator = {
      groupName: name,
      projectIds: new Set(),
      allocatedRevenue: 0,
      actualCostToDate: 0,
      actualCostKnown: false,
      forecastCost: 0,
      forecastProfit: 0,
      estimatedMinutes: 0,
      loggedMinutes: 0,
      provisionalProjectIds: new Set(),
      allocationMethods: new Set(),
    };
    output.set(name, created);
    return created;
  };

  for (const project of projects) {
    const projectRows = rowsByProject.get(project.id) ?? [];
    const grouped = new Map<PortfolioOperationalGroupRow["groupName"], RawPortfolioGroupMetric>();
    for (const row of projectRows) {
      const name = portfolioGroupName(project, row.groupName);
      const current = grouped.get(name);
      if (!current) {
        grouped.set(name, { ...row, groupName: name });
      } else {
        const targetValues = [
          numberOrNull(current.targetCost),
          numberOrNull(row.targetCost),
        ].filter((value): value is number => value !== null);
        current.targetCost = targetValues.length
          ? targetValues.reduce((sum, value) => sum + value, 0).toString()
          : null;
        current.estimatedMinutes += row.estimatedMinutes;
        current.loggedMinutes += row.loggedMinutes;
        const actualLaborValues = [
          numberOrNull(current.actualLaborCost),
          numberOrNull(row.actualLaborCost),
        ].filter((value): value is number => value !== null);
        current.actualLaborCost = actualLaborValues.length
          ? actualLaborValues.reduce((sum, value) => sum + value, 0).toString()
          : null;
        const actualNonLaborValues = [
          numberOrNull(current.actualNonLaborCost),
          numberOrNull(row.actualNonLaborCost),
        ].filter((value): value is number => value !== null);
        current.actualNonLaborCost = actualNonLaborValues.length
          ? actualNonLaborValues.reduce((sum, value) => sum + value, 0).toString()
          : null;
        const forecastValues = [
          numberOrNull(current.forecastCost),
          numberOrNull(row.forecastCost),
        ].filter((value): value is number => value !== null);
        current.forecastCost = forecastValues.length
          ? forecastValues.reduce((sum, value) => sum + value, 0).toString()
          : null;
      }
    }
    if (!grouped.size) {
      grouped.set("Unclassified", {
        projectId: project.id,
        groupName: "Unclassified",
        targetCost: project.targetCost,
        estimatedMinutes: project.canonicalEstimatedMinutes,
        loggedMinutes: project.loggedMinutes,
        actualLaborCost: project.actualLaborCost,
        actualNonLaborCost: project.actualNonLaborCost,
        forecastCost: project.forecastCost,
      });
    } else {
      const fallbackName: PortfolioOperationalGroupRow["groupName"] = "Unclassified";
      const mappedEstimated = [...grouped.values()].reduce(
        (sum, group) => sum + group.estimatedMinutes,
        0,
      );
      const mappedLogged = [...grouped.values()].reduce(
        (sum, group) => sum + group.loggedMinutes,
        0,
      );
      const mappedActual = [...grouped.values()].reduce(
        (sum, group) =>
          sum +
          (numberOrNull(group.actualLaborCost) ?? 0) +
          (numberOrNull(group.actualNonLaborCost) ?? 0),
        0,
      );
      const mappedForecast = [...grouped.values()].reduce(
        (sum, group) => sum + (numberOrNull(group.forecastCost) ?? 0),
        0,
      );
      const estimateGap = Math.max(project.canonicalEstimatedMinutes - mappedEstimated, 0);
      const loggedGap = Math.max(project.loggedMinutes - mappedLogged, 0);
      const projectActual = numberOrNull(project.actualTotalCost);
      const actualGap = projectActual === null ? 0 : Math.max(projectActual - mappedActual, 0);
      const projectForecast = numberOrNull(project.forecastCost);
      const forecastGap =
        projectForecast === null ? 0 : Math.max(projectForecast - mappedForecast, 0);
      if (estimateGap > 0 || loggedGap > 0 || actualGap > 0 || forecastGap > 0) {
        const current = grouped.get(fallbackName) ?? {
          projectId: project.id,
          groupName: fallbackName,
          targetCost: null,
          estimatedMinutes: 0,
          loggedMinutes: 0,
          actualLaborCost: "0",
          actualNonLaborCost: "0",
          forecastCost: "0",
        };
        current.estimatedMinutes += estimateGap;
        current.loggedMinutes += loggedGap;
        current.actualLaborCost = (
          (numberOrNull(current.actualLaborCost) ?? 0) + actualGap
        ).toString();
        current.forecastCost = ((numberOrNull(current.forecastCost) ?? 0) + forecastGap).toString();
        grouped.set(fallbackName, current);
      }
    }

    const groups = [...grouped.values()];
    const targets = groups.map((group) => numberOrNull(group.targetCost));
    const sourceTargetsComplete =
      projectRows.length > 0 && projectRows.every((row) => numberOrNull(row.targetCost) !== null);
    const completeTargets =
      sourceTargetsComplete &&
      targets.every((value) => value !== null) &&
      targets.some((value) => (value ?? 0) > 0);
    const targetTotal = targets.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const estimateTotal = groups.reduce(
      (sum, group) => sum + Math.max(group.estimatedMinutes, 0),
      0,
    );
    const costTotal = groups.reduce(
      (sum, group) => sum + Math.max(numberOrNull(group.forecastCost) ?? 0, 0),
      0,
    );
    const allocationMethod =
      completeTargets && targetTotal > 0
        ? "Task-list target cost"
        : estimateTotal > 0
          ? "Estimated hours"
          : costTotal > 0
            ? "Forecast cost"
            : "Equal share";
    const allocationTotal =
      allocationMethod === "Task-list target cost"
        ? targetTotal
        : allocationMethod === "Estimated hours"
          ? estimateTotal
          : allocationMethod === "Forecast cost"
            ? costTotal
            : groups.length;
    const clientFee = numberOrNull(project.clientFee);

    groups.forEach((group) => {
      const name = group.groupName as PortfolioOperationalGroupRow["groupName"];
      const accumulator = ensure(name);
      const target = numberOrNull(group.targetCost) ?? 0;
      const groupActualLabor = numberOrNull(group.actualLaborCost);
      const groupActualNonLabor = numberOrNull(group.actualNonLaborCost);
      const actualKnown = groupActualLabor !== null || groupActualNonLabor !== null;
      const actual = Math.max((groupActualLabor ?? 0) + (groupActualNonLabor ?? 0), 0);
      const forecast = Math.max(numberOrNull(group.forecastCost) ?? 0, 0);
      const basis =
        allocationMethod === "Task-list target cost"
          ? target
          : allocationMethod === "Estimated hours"
            ? Math.max(group.estimatedMinutes, 0)
            : allocationMethod === "Forecast cost"
              ? forecast
              : 1;
      const allocatedRevenue =
        clientFee === null || allocationTotal <= 0 ? 0 : clientFee * (basis / allocationTotal);
      accumulator.projectIds.add(project.id);
      accumulator.allocatedRevenue += allocatedRevenue;
      accumulator.actualCostToDate += actual;
      accumulator.actualCostKnown = accumulator.actualCostKnown || actualKnown;
      accumulator.forecastCost += forecast;
      accumulator.forecastProfit += allocatedRevenue - forecast;
      accumulator.estimatedMinutes += group.estimatedMinutes;
      accumulator.loggedMinutes += group.loggedMinutes;
      if (project.isProvisional) accumulator.provisionalProjectIds.add(project.id);
      accumulator.allocationMethods.add(allocationMethod);
    });
  }

  const order: PortfolioOperationalGroupRow["groupName"][] = [
    "Fieldwork",
    "Mobilization",
    "Modeling",
    "Admin",
    "Unclassified",
  ];
  return order
    .map((groupName) => output.get(groupName))
    .filter((value): value is GroupAccumulator => Boolean(value))
    .map((value) => ({
      groupName: value.groupName,
      projectCount: value.projectIds.size,
      allocatedRevenue: value.allocatedRevenue,
      actualCostToDate: value.actualCostKnown ? value.actualCostToDate : null,
      remainingCost: value.actualCostKnown
        ? Math.max(value.forecastCost - value.actualCostToDate, 0)
        : null,
      forecastCost: value.forecastCost,
      forecastProfit: value.forecastProfit,
      marginPercent:
        value.allocatedRevenue === 0 ? null : (value.forecastProfit / value.allocatedRevenue) * 100,
      estimatedMinutes: value.estimatedMinutes,
      loggedMinutes: value.loggedMinutes,
      provisionalProjectCount: value.provisionalProjectIds.size,
      allocationMethods: [...value.allocationMethods].sort(),
    }));
}

export async function getComparedProjectOperationalGroups(
  projects: ProjectReportRow[],
): Promise<Array<{ projectId: string; groups: PortfolioOperationalGroupRow[] }>> {
  if (!projects.length) return [];
  const sourceRows = await getOperationalGroupMetricRows();
  return Promise.all(
    projects.map(async (project) => ({
      projectId: project.id,
      groups: await getPortfolioOperationalGroups([project], sourceRows),
    })),
  );
}

export async function getProjectById(projectId: string): Promise<ProjectReportRow | null> {
  return (await getProjectRows()).find((row) => row.id === projectId) ?? null;
}

export async function getProjectExpenses(projectId: string): Promise<ProjectExpenseRow[]> {
  const sql = getSqlClient();
  return sql<ProjectExpenseRow[]>`
    select
      e.id,
      e.title,
      tl.name as "taskListName",
      e.operational_group as "operationalGroup",
      e.expense_date as "expenseDate",
      e.total_cost as "totalCost",
      e.is_outsourced_modeling as "isOutsourcedModeling"
    from expenses e
    left join task_lists tl on tl.id = e.task_list_id
    where e.project_id = ${projectId}
      and e.is_deleted = false
    order by e.expense_date desc nulls last, e.title asc
  `;
}

export async function getProjectGroups(projectId: string): Promise<ProjectGroupRow[]> {
  const sql = getSqlClient();
  return sql<ProjectGroupRow[]>`
    select
      group_name as "groupName",
      target_cost as "targetCost",
      target_cost_coverage as "targetCostCoverage",
      estimated_minutes as "estimatedMinutes",
      logged_minutes as "loggedMinutes",
      projected_labor_cost as "projectedLaborCost",
      actual_labor_cost as "actualLaborCost",
      projected_non_labor_cost as "projectedNonLaborCost",
      actual_non_labor_cost as "actualNonLaborCost",
      forecast_cost as "forecastCost",
      variance_to_target as "varianceToTarget",
      progress_percent as "progressPercent"
    from operational_group_metrics
    where project_id = ${projectId}
    order by group_name
  `;
}

export async function getProjectTasks(projectId: string): Promise<ProjectTaskRow[]> {
  const sql = getSqlClient();
  const rows = await sql<RawProjectTaskRow[]>`
    select
      t.id,
      t.name,
      tl.name as "taskListName",
      tl.operational_group as "operationalGroup",
      t.status,
      t.due_date as "dueDate",
      t.completed_at as "completedAt",
      tm.counted_estimated_minutes as "countedEstimatedMinutes",
      tm.branch_logged_minutes as "branchLoggedMinutes",
      tm.remaining_minutes as "remainingMinutes",
      tm.projected_labor_cost as "projectedLaborCost",
      tm.actual_labor_cost as "actualLaborCost",
      tm.remaining_labor_cost as "remainingLaborCost",
      tm.assignment_coverage as "assignmentCoverage",
      tm.is_outsourced as "isOutsourced",
      tm.is_branch_complete as "isBranchComplete"
    from task_metrics tm
    inner join tasks t on t.id = tm.task_id
    inner join task_lists tl on tl.id = t.task_list_id
    where tm.project_id = ${projectId} and t.is_deleted = false
    order by tl.operational_group, tl.name, t.name
  `;
  return rows.map((row) => ({
    ...row,
    completedAt: normalizeOptionalDatabaseDate(row.completedAt, `task ${row.id} completedAt`),
  }));
}

export async function getProjectQualityIssues(projectId: string): Promise<QualityIssueRow[]> {
  const sql = getSqlClient();
  const [context] = await sql<
    Array<{
      projectTeamworkId: number;
      apiEndpoint: string | null;
    }>
  >`
    select
      p.teamwork_id as "projectTeamworkId",
      (
        select tc.api_endpoint
        from teamwork_connections tc
        where tc.is_active = true
        order by tc.connected_at desc
        limit 1
      ) as "apiEndpoint"
    from projects p
    where p.id = ${projectId}
    limit 1
  `;
  const rows = await sql<RawQualityIssueRow[]>`
    select
      dqi.id,
      dqi.task_id as "taskId",
      dqi.severity,
      dqi.code,
      dqi.message,
      dqi.details,
      tl.name as "taskListName",
      t.name as "taskName",
      t.teamwork_id as "taskTeamworkId",
      dqi.last_detected_at as "lastDetectedAt"
    from data_quality_issues dqi
    left join task_lists tl on tl.id = dqi.task_list_id
    left join tasks t on t.id = dqi.task_id
    where dqi.project_id = ${projectId}
      and dqi.resolved_at is null
      and dqi.code <> 'UNPLANNED_ACTUAL_WORK'
    order by
      case dqi.severity when 'ERROR' then 0 when 'WARNING' then 1 else 2 end,
      dqi.code,
      dqi.last_detected_at desc
  `;
  const timeEntries = await sql<RawIssueTimeEntryRow[]>`
    select
      te.id,
      te.teamwork_id as "teamworkId",
      te.task_id as "taskId",
      t.name as "taskName",
      tl.name as "taskListName",
      te.logged_date as "loggedDate",
      te.minutes,
      te.description,
      case
        when te.historical_cost_total is not null then te.historical_cost_total
        when te.historical_cost_rate is not null then round((te.minutes / 60.0) * te.historical_cost_rate, 4)
        else null
      end as "historicalCostTotal",
      te.historical_cost_rate as "historicalCostRate",
      te.cost_info_returned as "costInfoReturned",
      nullif(trim(concat_ws(' ', person.first_name, person.last_name)), '') as "personName"
    from time_entries te
    left join tasks t on t.id = te.task_id
    left join task_lists tl on tl.id = t.task_list_id
    left join people person on person.id = te.person_id
    where te.project_id = ${projectId}
      and te.is_deleted = false
      and (
        te.task_id is null
        or te.cost_info_returned = false
        or (te.historical_cost_total is null and te.historical_cost_rate is null)
        or te.task_id in (
          select dqi.task_id
          from data_quality_issues dqi
          where dqi.project_id = ${projectId}
            and dqi.resolved_at is null
            and dqi.task_id is not null
            and dqi.code <> 'UNPLANNED_ACTUAL_WORK'
        )
      )
    order by te.logged_date desc, te.teamwork_id desc
  `;
  const missingTaskLists = await sql<Array<{ id: string; teamworkId: number; name: string }>>`
    select tl.id, tl.teamwork_id as "teamworkId", tl.name
    from task_lists tl
    left join project_budgets pb
      on pb.project_id = tl.project_id
      and pb.is_current = true
    left join task_list_budgets tlb
      on tlb.project_budget_id = pb.id
      and tlb.task_list_id = tl.id
      and tlb.target_cost is not null
    where tl.project_id = ${projectId}
      and tl.is_deleted = false
      and tlb.id is null
    order by tl.name
  `;

  const base = context?.apiEndpoint?.replace(/\/+$/, "") ?? null;
  const projectTimeUrl =
    base && context ? `${base}/app/projects/${context.projectTeamworkId}/time` : null;
  const projectFinanceUrl =
    base && context ? `${base}/app/projects/${context.projectTeamworkId}/finance/budgets` : null;
  const taskUrl = (teamworkTaskId: number | null): string | null =>
    base && teamworkTaskId ? `${base}/app/tasks/${teamworkTaskId}` : projectTimeUrl;
  const timeEvidence = (entry: RawIssueTimeEntryRow): QualityIssueEvidenceRow => ({
    id: entry.id,
    kind: "TIME_ENTRY",
    label: entry.taskName
      ? `${entry.taskListName ?? "Task"} · ${entry.taskName}`
      : "Time logged directly to the project",
    personName: entry.personName,
    loggedDate: entry.loggedDate,
    minutes: entry.minutes,
    laborCost: entry.historicalCostTotal,
    description: entry.description,
    teamworkUrl: projectTimeUrl,
  });

  return rows.map((row) => {
    let evidence: QualityIssueEvidenceRow[] = [];
    if (row.code === "UNALLOCATED_PROJECT_TIME") {
      evidence = timeEntries
        .filter((entry) => entry.taskId === null)
        .slice(0, 50)
        .map(timeEvidence);
    } else if (row.code === "ACTUAL_LABOR_COST_INCOMPLETE") {
      evidence = timeEntries
        .filter(
          (entry) =>
            !entry.costInfoReturned ||
            (entry.historicalCostTotal === null && entry.historicalCostRate === null),
        )
        .slice(0, 50)
        .map(timeEvidence);
    } else if (row.taskId) {
      evidence = timeEntries
        .filter((entry) => entry.taskId === row.taskId)
        .slice(0, 20)
        .map(timeEvidence);
    } else if (row.code === "TASK_LIST_BUDGET_COVERAGE_INCOMPLETE") {
      evidence = missingTaskLists.slice(0, 50).map((taskList) => ({
        id: taskList.id,
        kind: "TASK_LIST" as const,
        label: taskList.name,
        personName: null,
        loggedDate: null,
        minutes: null,
        laborCost: null,
        description: "No current Teamwork task-list target cost was returned.",
        teamworkUrl: projectFinanceUrl,
      }));
    }

    return {
      id: row.id,
      taskId: row.taskId,
      severity: row.severity,
      code: row.code,
      message: row.message,
      taskListName: row.taskListName,
      taskName: row.taskName,
      details: row.details,
      lastDetectedAt: normalizeDatabaseDate(
        row.lastDetectedAt,
        `data-quality issue ${row.id} lastDetectedAt`,
      ),
      teamworkUrl:
        row.code === "TASK_LIST_BUDGET_COVERAGE_INCOMPLETE"
          ? projectFinanceUrl
          : taskUrl(row.taskTeamworkId),
      evidence,
    };
  });
}

export async function getProjectUnplannedWork(projectId: string): Promise<UnplannedWorkRow[]> {
  const sql = getSqlClient();
  const rows = await sql<(Omit<UnplannedWorkRow, "dismissedAt"> & { dismissedAt: unknown })[]>`
    select
      dqi.id as "issueId",
      dqi.project_id as "projectId",
      dqi.task_id as "taskId",
      nullif(dqi.details ->> 'teamworkTaskId', '')::bigint as "teamworkTaskId",
      t.name as "taskName",
      tl.name as "taskListName",
      coalesce((dqi.details ->> 'minutes')::int, 0) as "loggedMinutes",
      nullif(dqi.details ->> 'laborCost', '') as "laborCost",
      nullif(dqi.details ->> 'firstLoggedDate', '') as "firstLoggedDate",
      nullif(dqi.details ->> 'lastLoggedDate', '') as "lastLoggedDate",
      (
        uwr.task_id is not null
        and coalesce((dqi.details ->> 'minutes')::int, 0) <= uwr.dismissed_logged_minutes
      ) as "isDismissed",
      uwr.dismissed_at as "dismissedAt",
      au.display_name as "dismissedByName"
    from data_quality_issues dqi
    inner join tasks t on t.id = dqi.task_id
    inner join task_lists tl on tl.id = t.task_list_id
    left join unplanned_work_reviews uwr on uwr.task_id = dqi.task_id
    left join app_users au on au.id = uwr.dismissed_by_user_id
    where dqi.project_id = ${projectId}
      and dqi.resolved_at is null
      and dqi.code = 'UNPLANNED_ACTUAL_WORK'
    order by "isDismissed" asc, tl.name asc, t.name asc
  `;
  return rows.map((row) => ({
    ...row,
    teamworkTaskId: row.teamworkTaskId === null ? null : Number(row.teamworkTaskId),
    dismissedAt: normalizeOptionalDatabaseDate(
      row.dismissedAt,
      `unplanned-work issue ${row.issueId} dismissedAt`,
    ),
  }));
}

export async function getEmployeeLaborRows(): Promise<EmployeeLaborRow[]> {
  const sql = getSqlClient();
  return sql<EmployeeLaborRow[]>`
    select
      p.id as "personId",
      trim(concat_ws(' ', p.first_name, p.last_name)) as "displayName",
      p.email,
      coalesce(sum(te.minutes), 0)::int as "loggedMinutes",
      case
        when count(te.id) filter (where te.cost_info_returned = true) = 0 then null
        else sum(te.historical_cost_total) filter (where te.cost_info_returned = true)
      end as "actualLaborCost",
      count(distinct te.project_id)::int as "projectCount",
      count(te.id)::int as "timeEntryCount",
      case
        when count(te.id) = 0 then 0
        else round(100.0 * count(te.id) filter (where te.cost_info_returned = true) / count(te.id), 2)::float
      end as "costCoveragePercent"
    from people p
    left join time_entries te
      on te.person_id = p.id
      and te.is_deleted = false
      and exists (
        select 1
        from projects reporting_project
        where reporting_project.id = te.project_id
          and reporting_project.excluded_from_reporting = false
      )
    where p.is_active = true and p.is_client_user = false and p.is_service_account = false
    group by p.id, p.first_name, p.last_name, p.email
    order by "loggedMinutes" desc, "displayName"
  `;
}
