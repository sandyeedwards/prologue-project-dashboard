import { and, count, desc, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "@/db/client";
import {
  calculationRuns,
  dataQualityIssues,
  operationalGroupMetrics,
  projectMetrics,
  projects,
  syncRuns,
  taskMetrics,
  tasks,
} from "@/db/schema";
import { REPORTING_RULES } from "@/config/reporting-rules";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type LegacyDateAuditRow = {
  legacyTimeEntryDates: number;
  legacyProjectStartDates: number;
};

type ActualCostReconciliationRow = {
  projectId: string;
  projectNumber: string | null;
  projectName: string;
  metricActualTotal: string | null;
  reconstructedActualTotal: string;
  difference: string;
  missingTimeEntryCostCount: number;
  missingExpenseCostCount: number;
};

export async function verifyCalculations() {
  const db = getDb();
  const [latestRun] = await db
    .select()
    .from(calculationRuns)
    .orderBy(desc(calculationRuns.startedAt))
    .limit(1);
  const [latestSyncRun] = await db
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);
  const latestSyncSummary = object(latestSyncRun?.summary);
  const latestSyncWarningCodes = object(latestSyncSummary.warningCodes);
  const excludedNoReportRecords = object(latestSyncSummary.excludedNoReportRecords);
  const taskListRelationshipRecovery = object(latestSyncSummary.taskListRelationshipRecovery);
  const timeDateFallbackWarnings = numberValue(latestSyncWarningCodes.TIME_DATE_FALLBACK) ?? 0;
  const legacyTaskListRelationshipWarnings =
    numberValue(latestSyncWarningCodes.TASK_LIST_RELATIONSHIP_MISSING) ?? 0;
  const taskListIdWarnings = numberValue(latestSyncWarningCodes.TASK_LIST_ID_MISSING) ?? 0;
  const taskListProjectConflictWarnings =
    numberValue(latestSyncWarningCodes.TASK_LIST_PROJECT_CONFLICT) ?? 0;
  const taskRelationshipWarnings =
    numberValue(latestSyncWarningCodes.TASK_RELATIONSHIP_MISSING) ?? 0;
  const timeRelationshipWarnings =
    numberValue(latestSyncWarningCodes.TIME_RELATIONSHIP_MISSING) ?? 0;
  const reportableRelationshipWarnings =
    taskListIdWarnings +
    taskListProjectConflictWarnings +
    taskRelationshipWarnings +
    timeRelationshipWarnings;
  const recoveredTaskLists =
    numberValue(taskListRelationshipRecovery.recoveredFromTaskEvidence) ?? 0;
  const ignoredUnreferencedTaskLists =
    numberValue(taskListRelationshipRecovery.ignoredUnreferenced) ?? 0;
  const referencedTaskListsWithoutProjectEvidence =
    numberValue(taskListRelationshipRecovery.referencedWithoutProjectEvidence) ?? 0;
  const conflictingTaskListEvidence =
    numberValue(taskListRelationshipRecovery.conflictingTaskEvidence) ?? 0;
  const [eligibleProjects, activeTasks, metricProjects, metricTasks, metricGroups, issueCount] =
    await Promise.all([
      db.select({ value: count() }).from(projects).where(eq(projects.excludedFromReporting, false)),
      db
        .select({ value: count() })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(tasks.isDeleted, false), eq(projects.excludedFromReporting, false))),
      db.select({ value: count() }).from(projectMetrics),
      db.select({ value: count() }).from(taskMetrics),
      db.select({ value: count() }).from(operationalGroupMetrics),
      db.select({ value: count() }).from(dataQualityIssues),
    ]);

  const sql = getSqlClient();
  const [legacyDateAudit] = await sql<LegacyDateAuditRow[]>`
    select
      (
        select count(*)::int
        from time_entries te
        where te.is_deleted = false
          and te.logged_date < date '2000-01-01'
      ) as "legacyTimeEntryDates",
      (
        select count(*)::int
        from projects p
        where p.start_date is not null
          and p.start_date < date '2000-01-01'
      ) as "legacyProjectStartDates"
  `;
  const actualCostReconciliation = await sql<ActualCostReconciliationRow[]>`
    with labor as (
      select
        te.project_id,
        coalesce(sum(
          case
            when te.historical_cost_total is not null then te.historical_cost_total
            when te.historical_cost_rate is not null then (te.minutes::numeric / 60) * te.historical_cost_rate
            else null
          end
        ), 0) as source_labor_cost,
        count(*) filter (
          where te.historical_cost_total is null and te.historical_cost_rate is null
        )::int as missing_cost_count
      from time_entries te
      where te.is_deleted = false
      group by te.project_id
    ),
    expense as (
      select
        e.project_id,
        coalesce(sum(e.total_cost), 0) as source_expense_cost,
        count(*) filter (where e.total_cost is null)::int as missing_cost_count
      from expenses e
      where e.is_deleted = false
      group by e.project_id
    )
    select
      p.id as "projectId",
      p.project_number as "projectNumber",
      p.name as "projectName",
      pm.actual_total_cost::text as "metricActualTotal",
      (coalesce(labor.source_labor_cost, 0) + coalesce(expense.source_expense_cost, 0))::text as "reconstructedActualTotal",
      (
        coalesce(labor.source_labor_cost, 0)
        + coalesce(expense.source_expense_cost, 0)
        - coalesce(pm.actual_total_cost, 0)
      )::text as difference,
      coalesce(labor.missing_cost_count, 0)::int as "missingTimeEntryCostCount",
      coalesce(expense.missing_cost_count, 0)::int as "missingExpenseCostCount"
    from projects p
    inner join project_metrics pm on pm.project_id = p.id
    left join labor on labor.project_id = p.id
    left join expense on expense.project_id = p.id
    where p.excluded_from_reporting = false
    order by p.project_number nulls last, p.name
  `;
  const actualCostMismatches = actualCostReconciliation.filter(
    (row) => Math.abs(numberValue(row.difference) ?? 0) > 0.01,
  );
  const partialSourceCoverage = actualCostReconciliation.filter(
    (row) => row.missingTimeEntryCostCount > 0 || row.missingExpenseCostCount > 0,
  );

  const [pilot] = await db
    .select({
      projectNumber: projects.projectNumber,
      projectName: projects.name,
      details: projectMetrics.details,
      projectedNonLaborCost: projectMetrics.projectedNonLaborCost,
      healthBand: projectMetrics.healthBand,
      isProvisional: projectMetrics.isProvisional,
    })
    .from(projects)
    .innerJoin(projectMetrics, eq(projectMetrics.projectId, projects.id))
    .where(eq(projects.projectNumber, REPORTING_RULES.calculationPilotProjectNumber))
    .limit(1);
  const pilotDetails = object(pilot?.details);
  const pilotOutsourcedMinutes = numberValue(pilotDetails.outsourcedEstimatedMinutes);
  const pilotOutsourcedCost = numberValue(pilotDetails.projectedOutsourcedCost);
  const pilotExpectedOutsourcedCost =
    pilotOutsourcedMinutes === null
      ? null
      : (pilotOutsourcedMinutes / 60) * REPORTING_RULES.outsourcedModelingHourlyRateUsd;
  const pilotMatchesConfiguredRate =
    pilotExpectedOutsourcedCost !== null &&
    pilotOutsourcedCost !== null &&
    Math.abs(pilotExpectedOutsourcedCost - pilotOutsourcedCost) < 0.01;

  const checks = {
    latestRunCompleted:
      latestRun?.status === "SUCCEEDED" || latestRun?.status === "SUCCEEDED_WITH_WARNINGS",
    allEligibleProjectsCalculated: metricProjects[0].value === eligibleProjects[0].value,
    taskMetricsCreated: metricTasks[0].value > 0,
    taskMetricCoverageAcceptable:
      activeTasks[0].value === 0 || metricTasks[0].value / activeTasks[0].value >= 0.9,
    operationalGroupsCalculated: metricGroups[0].value > 0,
    noCalculationErrors: (latestRun?.errors ?? 1) === 0,
    actualCostReconcilesToDatedSourceRecords: actualCostMismatches.length === 0,
    noLegacyEpochDates:
      (legacyDateAudit?.legacyTimeEntryDates ?? 0) === 0 &&
      (legacyDateAudit?.legacyProjectStartDates ?? 0) === 0,
    timeEntryDatesImportedWithoutFallback: timeDateFallbackWarnings === 0,
    taskListRelationshipsResolvedForReportableProjects: reportableRelationshipWarnings === 0,
    pilotProjectFound: pilot !== undefined,
    pilotOutsourcedCalculationPresent:
      pilot !== undefined &&
      pilotOutsourcedMinutes !== null &&
      pilotOutsourcedMinutes > 0 &&
      pilotOutsourcedCost !== null &&
      pilotOutsourcedCost > 0,
    pilotOutsourcedCostMatchesConfiguredRate: pilot !== undefined && pilotMatchesConfiguredRate,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    status: passed ? "PASS" : "FAIL",
    checks,
    counts: {
      eligibleProjects: eligibleProjects[0].value,
      projectMetrics: metricProjects[0].value,
      activeTasks: activeTasks[0].value,
      taskMetrics: metricTasks[0].value,
      operationalGroupMetrics: metricGroups[0].value,
      dataQualityIssues: issueCount[0].value,
    },
    teamworkSyncAudit: {
      latestRunId: latestSyncRun?.id ?? null,
      latestRunStatus: latestSyncRun?.status ?? null,
      timeDateFallbackWarnings,
      reportableRelationshipWarnings,
      legacyTaskListRelationshipWarnings,
      taskListIdWarnings,
      taskListProjectConflictWarnings,
      taskRelationshipWarnings,
      timeRelationshipWarnings,
      taskListRelationshipRecovery: {
        recoveredFromTaskEvidence: recoveredTaskLists,
        ignoredUnreferenced: ignoredUnreferencedTaskLists,
        referencedWithoutProjectEvidence: referencedTaskListsWithoutProjectEvidence,
        conflictingTaskEvidence: conflictingTaskListEvidence,
      },
      excludedNoReportRecords: {
        taskLists: numberValue(excludedNoReportRecords.taskLists) ?? 0,
        tasks: numberValue(excludedNoReportRecords.tasks) ?? 0,
        timeEntries: numberValue(excludedNoReportRecords.timeEntries) ?? 0,
      },
    },
    legacyDateAudit: {
      timeEntriesBefore2000: legacyDateAudit?.legacyTimeEntryDates ?? 0,
      projectStartsBefore2000: legacyDateAudit?.legacyProjectStartDates ?? 0,
    },
    actualCostReconciliation: {
      checkedProjects: actualCostReconciliation.length,
      mismatchCount: actualCostMismatches.length,
      projectsWithPartialSourceCoverage: partialSourceCoverage.length,
      mismatches: actualCostMismatches.map((row) => ({
        projectNumber: row.projectNumber,
        projectName: row.projectName,
        metricActualTotal: numberValue(row.metricActualTotal),
        reconstructedActualTotal: numberValue(row.reconstructedActualTotal),
        difference: numberValue(row.difference),
      })),
      partialCoverage: partialSourceCoverage.map((row) => ({
        projectNumber: row.projectNumber,
        projectName: row.projectName,
        missingTimeEntryCostCount: row.missingTimeEntryCostCount,
        missingExpenseCostCount: row.missingExpenseCostCount,
      })),
    },
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          calculationVersion: latestRun.calculationVersion,
          startedAt: latestRun.startedAt,
          completedAt: latestRun.completedAt,
          projectsRead: latestRun.projectsRead,
          projectsCalculated: latestRun.projectsCalculated,
          warnings: latestRun.warnings,
          errors: latestRun.errors,
          summary: latestRun.summary,
        }
      : null,
    pilot: pilot
      ? {
          projectNumber: pilot.projectNumber,
          projectName: pilot.projectName,
          outsourcedEstimatedHours:
            pilotOutsourcedMinutes === null ? null : pilotOutsourcedMinutes / 60,
          projectedOutsourcedCost: pilotOutsourcedCost,
          configuredOutsourcedHourlyRate: REPORTING_RULES.outsourcedModelingHourlyRateUsd,
          expectedOutsourcedCost: pilotExpectedOutsourcedCost,
          matchesConfiguredOutsourcedRate: pilotMatchesConfiguredRate,
          healthBand: pilot.healthBand,
          isProvisional: pilot.isProvisional,
        }
      : null,
    notes: [
      ...(pilot === undefined
        ? [
            `Pilot project ${REPORTING_RULES.calculationPilotProjectNumber} was not found in the reporting dataset.`,
          ]
        : pilotMatchesConfiguredRate
          ? []
          : [
              `The pilot outsourced-modeling cost does not equal estimated outsourced hours × $${REPORTING_RULES.outsourcedModelingHourlyRateUsd}/hour.`,
            ]),
      ...(timeDateFallbackWarnings > 0
        ? [
            `${timeDateFallbackWarnings} time entr${timeDateFallbackWarnings === 1 ? "y is" : "ies are"} still using a fallback logged date. Re-run the Teamwork sync after confirming the V3 timeLogged field is returned.`,
          ]
        : []),
      ...(reportableRelationshipWarnings > 0
        ? [
            `${reportableRelationshipWarnings} relationship warning(s) still affect reportable task or time-entry data. NoReport records and unreferenced task lists do not fail this check.`,
          ]
        : []),
      ...(ignoredUnreferencedTaskLists > 0
        ? [
            `${ignoredUnreferencedTaskLists} task list(s) had no usable project relationship and were not referenced by any imported reportable task. They were excluded from calculations without failing verification.`,
          ]
        : []),
      ...(referencedTaskListsWithoutProjectEvidence > 0
        ? [
            `${referencedTaskListsWithoutProjectEvidence} task list(s) were referenced by task records that did not expose a project relationship. Any effect on reportable tasks is reported separately as a relationship warning.`,
          ]
        : []),
      ...(recoveredTaskLists > 0
        ? [
            `${recoveredTaskLists} task-list relationship(s) were recovered from their task records.`,
          ]
        : []),
      ...(legacyTaskListRelationshipWarnings > 0
        ? [
            `${legacyTaskListRelationshipWarnings} legacy task-list warning(s) were recorded by a pre-v1.1.14 sync. Run npm run step9:refresh-calculations to replace the audit with the current relationship classification.`,
          ]
        : []),
      ...((legacyDateAudit?.legacyTimeEntryDates ?? 0) > 0 ||
      (legacyDateAudit?.legacyProjectStartDates ?? 0) > 0
        ? [
            "Legacy dates before 2000 remain in the database. Run npm run step9:refresh-calculations so the Teamwork sync can repair the imported dates before completing Step 10.",
          ]
        : []),
      ...(partialSourceCoverage.length
        ? [
            `${partialSourceCoverage.length} project(s) contain time entries or expenses without usable cost data. Their actual totals are known subtotals and remain provisional until the source coverage is resolved.`,
          ]
        : []),
    ],
  };
}
