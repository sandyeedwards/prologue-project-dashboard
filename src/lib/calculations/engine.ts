import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  calculationRuns,
  dataQualityIssues,
  expenses,
  jobRoles,
  operationalGroupMetrics,
  outsourcedRates,
  outsourcedTaskAliases,
  people,
  projectBudgets,
  projectMetrics,
  projects,
  projectTags,
  tags,
  taskAssignments,
  taskListBudgets,
  taskLists,
  taskMetrics,
  tasks,
  timeEntries,
} from "@/db/schema";
import { REPORTING_RULES } from "@/config/reporting-rules";
import { normalizeTeamworkLabel } from "@/lib/teamwork/normalize";
import { calculateCanonicalTaskMetrics, rootTaskIds } from "./canonical-estimates";
import { collectBranchUserIds, extractAssignments } from "./assignments";
import { resolveForecastAssignment } from "./forecast-assignment";
import { calculateHealth } from "./health";
import { resolveExpenseCoverage } from "./expense-coverage";
import { createOutsourcedBranchResolver } from "./outsourced";
import { calculatePlannedFinancials, calculateTaskListBudgetCoverage } from "./planned-financials";
import type { CalculationTaskInput, Coverage } from "./types";
import { identifyUnplannedTopLevelTasks } from "./unplanned-work";

export const CALCULATION_VERSION = "step7-v1.0.7";

type IssueInsert = typeof dataQualityIssues.$inferInsert;
type TaskMetricInsert = typeof taskMetrics.$inferInsert;
type GroupMetricInsert = typeof operationalGroupMetrics.$inferInsert;

function numeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null): string | null {
  return value === null || !Number.isFinite(value)
    ? null
    : (Math.round(value * 100) / 100).toFixed(2);
}

function decimal(value: number | null): string | null {
  return value === null || !Number.isFinite(value)
    ? null
    : (Math.round(value * 10000) / 10000).toFixed(4);
}

function completed(status: string, completedAt: Date | null): boolean {
  const normalized = status.toLowerCase();
  return completedAt !== null || normalized === "completed" || normalized === "complete";
}

function coverage(complete: number, total: number): Coverage {
  if (total === 0) return "NOT_EXPECTED";
  if (complete === 0) return "MISSING";
  if (complete === total) return "COMPLETE";
  return "PARTIAL";
}

function coveragePoints(value: Coverage): number {
  if (value === "COMPLETE" || value === "NOT_EXPECTED") return 100;
  if (value === "PARTIAL") return 50;
  return 0;
}

function outsourcedNameMatcher(normalizedAliases: ReadonlySet<string>) {
  return (name: string): boolean => normalizedAliases.has(normalizeTeamworkLabel(name));
}

function isPastDue(dueDate: string | null, asOf: Date): boolean {
  if (!dueDate) return false;
  const parsed = new Date(`${dueDate}T23:59:59Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed < asOf;
}

async function insertChunks<T>(
  rows: readonly T[],
  insert: (chunk: T[]) => Promise<unknown>,
  chunkSize = 500,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await insert(rows.slice(index, index + chunkSize));
  }
}

export async function calculateAllProjects(asOfDate = new Date()) {
  const db = getDb();
  await db
    .update(calculationRuns)
    .set({
      status: "FAILED",
      completedAt: new Date(),
      errors: 1,
      summary: { message: "Previous calculation process ended unexpectedly." },
    })
    .where(eq(calculationRuns.status, "RUNNING"));

  const [run] = await db
    .insert(calculationRuns)
    .values({ calculationVersion: CALCULATION_VERSION })
    .returning();

  try {
    const [
      projectRows,
      taskListRows,
      taskRows,
      timeRows,
      peopleRows,
      jobRoleRows,
      budgetRows,
      expenseRows,
      taskListBudgetRows,
      tagRows,
      projectTagRows,
      outsourcedAliasRows,
    ] = await Promise.all([
      db.select().from(projects),
      db.select().from(taskLists),
      db.select().from(tasks),
      db.select().from(timeEntries),
      db.select().from(people),
      db.select().from(jobRoles),
      db.select().from(projectBudgets),
      db.select().from(expenses),
      db.select().from(taskListBudgets),
      db.select().from(tags),
      db.select().from(projectTags),
      db.select().from(outsourcedTaskAliases),
    ]);

    const normalizedOutsourcedAliases = new Set<string>(
      outsourcedAliasRows
        .filter((row) => row.isActive)
        .map((row) => row.normalizedAlias || normalizeTeamworkLabel(row.alias))
        .filter((value) => value.length > 0),
    );
    if (normalizedOutsourcedAliases.size === 0) {
      for (const alias of REPORTING_RULES.outsourcedTaskAliases) {
        normalizedOutsourcedAliases.add(normalizeTeamworkLabel(alias));
      }
    }
    const isOutsourcedName = outsourcedNameMatcher(normalizedOutsourcedAliases);

    const reportingProjects = projectRows.filter((project) => !project.excludedFromReporting);
    const reportingProjectIds = new Set(reportingProjects.map((project) => project.id));
    const asOfText = asOfDate.toISOString().slice(0, 10);
    const [rateRow] = await db
      .select()
      .from(outsourcedRates)
      .where(
        and(
          lte(outsourcedRates.effectiveFrom, asOfText),
          or(isNull(outsourcedRates.effectiveTo), gte(outsourcedRates.effectiveTo, asOfText)),
        ),
      )
      .orderBy(desc(outsourcedRates.effectiveFrom))
      .limit(1);
    const outsourcedRate =
      numeric(rateRow?.hourlyRate) ?? REPORTING_RULES.outsourcedModelingHourlyRateUsd;

    const personByTeamworkId = new Map<number, typeof people.$inferSelect>(
      peopleRows.map((person) => [person.teamworkId, person]),
    );
    const personCostRateByTeamworkId = new Map<number, number | null>(
      peopleRows.map((person) => [person.teamworkId, numeric(person.costRate)]),
    );
    const jobRoleByTeamworkId = new Map<number, typeof jobRoles.$inferSelect>(
      jobRoleRows.map((role) => [role.teamworkId, role]),
    );
    const jobRoleCostRateByTeamworkId = new Map<number, number | null>(
      jobRoleRows.map((role) => [role.teamworkId, numeric(role.costRate)]),
    );
    const tagById = new Map<string, typeof tags.$inferSelect>(tagRows.map((tag) => [tag.id, tag]));
    const tagNamesByProject = new Map<string, string[]>();
    for (const relation of projectTagRows) {
      const tag = tagById.get(relation.tagId);
      if (!tag) continue;
      const names = tagNamesByProject.get(relation.projectId) ?? [];
      names.push(tag.name);
      tagNamesByProject.set(relation.projectId, names);
    }

    await db.delete(taskAssignments);
    const assignmentRows: (typeof taskAssignments.$inferInsert)[] = [];
    for (const task of taskRows.filter(
      (row) => !row.isDeleted && reportingProjectIds.has(row.projectId),
    )) {
      const assignments = extractAssignments(task.raw);
      for (const teamworkAssigneeId of assignments.userIds) {
        assignmentRows.push({
          taskId: task.id,
          kind: "USER",
          teamworkAssigneeId,
          personId: personByTeamworkId.get(teamworkAssigneeId)?.id ?? null,
        });
      }
      for (const teamworkAssigneeId of assignments.teamIds) {
        assignmentRows.push({ taskId: task.id, kind: "TEAM", teamworkAssigneeId });
      }
      for (const teamworkAssigneeId of assignments.companyIds) {
        assignmentRows.push({ taskId: task.id, kind: "COMPANY", teamworkAssigneeId });
      }
      for (const teamworkAssigneeId of assignments.jobRoleIds) {
        assignmentRows.push({ taskId: task.id, kind: "JOB_ROLE", teamworkAssigneeId });
      }
    }
    await insertChunks(assignmentRows, async (chunk) => {
      await db.insert(taskAssignments).values(chunk).onConflictDoNothing();
    });

    await db.delete(taskMetrics);
    await db.delete(operationalGroupMetrics);
    await db.delete(projectMetrics);
    await db.delete(dataQualityIssues);

    const allTaskMetrics: TaskMetricInsert[] = [];
    const allGroupMetrics: GroupMetricInsert[] = [];
    const allIssues: IssueInsert[] = [];
    const projectSummaries: Record<string, unknown>[] = [];
    let warningCount = 0;

    for (const project of reportingProjects) {
      const projectTaskLists = taskListRows.filter(
        (row) => row.projectId === project.id && !row.isDeleted,
      );
      const projectTasks = taskRows.filter((row) => row.projectId === project.id && !row.isDeleted);
      const projectTime = timeRows.filter((row) => row.projectId === project.id && !row.isDeleted);
      const projectExpenses = expenseRows.filter(
        (row) => row.projectId === project.id && !row.isDeleted,
      );
      const projectBudgetsForProject = budgetRows.filter((row) => row.projectId === project.id);

      const plannedFinancials = calculatePlannedFinancials(
        projectBudgetsForProject,
        taskListBudgetRows,
      );

      const currentBudget = plannedFinancials.revenueBudget;
      const projectTaskListBudgets = plannedFinancials.applicableTaskListBudgets;

      const taskInputs: CalculationTaskInput[] = projectTasks.map((task) => ({
        id: task.id,
        teamworkId: task.teamworkId,
        projectId: task.projectId,
        taskListId: task.taskListId,
        parentTaskId: task.parentTaskId,
        name: task.name,
        status: task.status,
        completedAt: task.completedAt,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        isDeleted: task.isDeleted,
        raw: task.raw,
      }));
      const ownLoggedByTask = new Map<string, number>();
      for (const entry of projectTime) {
        if (!entry.taskId) continue;
        ownLoggedByTask.set(entry.taskId, (ownLoggedByTask.get(entry.taskId) ?? 0) + entry.minutes);
      }
      const canonical = calculateCanonicalTaskMetrics(taskInputs, ownLoggedByTask);
      const rawByTaskId = new Map<string, unknown>(projectTasks.map((task) => [task.id, task.raw]));
      const isOutsourcedBranch = createOutsourcedBranchResolver(projectTasks, isOutsourcedName);
      const roots = rootTaskIds(taskInputs);
      const canonicalEstimatedMinutes = roots.reduce(
        (sum, rootId) => sum + (canonical.get(rootId)?.branchEstimatedMinutes ?? 0),
        0,
      );
      const taskLinkedMinutes = projectTime
        .filter((entry) => entry.taskId !== null)
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const unallocatedMinutes = projectTime
        .filter((entry) => entry.taskId === null)
        .reduce((sum, entry) => sum + entry.minutes, 0);
      const loggedMinutes = taskLinkedMinutes + unallocatedMinutes;

      const holderByCoveredTaskId = new Map<string, string>();
      for (const metric of canonical.values()) {
        if (!metric.isCanonicalHolder) continue;
        for (const coveredId of [metric.taskId, ...metric.descendantTaskIds]) {
          if (!holderByCoveredTaskId.has(coveredId))
            holderByCoveredTaskId.set(coveredId, metric.taskId);
        }
      }
      const uncoveredLoggedByTask = new Map(
        [...ownLoggedByTask.entries()].filter(([taskId]) => !holderByCoveredTaskId.has(taskId)),
      );
      const nonCanonicalLoggedMinutes = [...uncoveredLoggedByTask.values()].reduce(
        (sum, minutes) => sum + minutes,
        0,
      );
      const unplannedTasks = identifyUnplannedTopLevelTasks(
        projectTasks,
        ownLoggedByTask,
        new Set(holderByCoveredTaskId.keys()),
      );
      const unplannedLoggedMinutes = unplannedTasks.reduce(
        (sum, task) => sum + (uncoveredLoggedByTask.get(task.id) ?? 0),
        0,
      );
      const plannedTaskLinkedMinutes = Math.max(taskLinkedMinutes - nonCanonicalLoggedMinutes, 0);

      let actualLaborKnown = 0;
      let actualLaborCompleteEntries = 0;
      const actualCostByTask = new Map<string, number>();
      for (const entry of projectTime) {
        const total = numeric(entry.historicalCostTotal);
        const rate = numeric(entry.historicalCostRate);
        const entryCost = total ?? (rate === null ? null : (entry.minutes / 60) * rate);
        if (entryCost !== null) {
          actualLaborKnown += entryCost;
          actualLaborCompleteEntries += 1;
          if (entry.taskId) {
            actualCostByTask.set(
              entry.taskId,
              (actualCostByTask.get(entry.taskId) ?? 0) + entryCost,
            );
          }
        }
      }
      const laborCoverage = coverage(actualLaborCompleteEntries, projectTime.length);

      for (const task of unplannedTasks) {
        const taskEntries = projectTime.filter((entry) => entry.taskId === task.id);
        const minutes = uncoveredLoggedByTask.get(task.id) ?? 0;
        const laborCost = actualCostByTask.get(task.id) ?? 0;
        const dates = taskEntries.map((entry) => entry.loggedDate).sort();
        allIssues.push({
          projectId: project.id,
          taskListId: task.taskListId,
          taskId: task.id,
          severity: "INFO",
          code: "UNPLANNED_ACTUAL_WORK",
          message:
            "Time was logged to a top-level task without an estimate. Actual hours and historical labor cost remain included.",
          details: {
            minutes,
            laborCost: money(laborCost),
            teamworkTaskId: task.teamworkId,
            firstLoggedDate: dates[0] ?? null,
            lastLoggedDate: dates.at(-1) ?? null,
            timeEntryCount: taskEntries.length,
          },
        });
      }

      let projectedLaborKnown = 0;
      let remainingLaborKnown = 0;
      let projectedOutsourced = 0;
      let holderCount = 0;
      let laborHolderCount = 0;
      let knownProjectedLaborHolderCount = 0;
      let knownRemainingLaborHolderCount = 0;
      let completeAssignmentHolders = 0;
      let partialAssignmentHolders = 0;
      const projectedLaborByTask = new Map<string, number | null>();
      const remainingLaborByTask = new Map<string, number | null>();
      const outsourcedByTask = new Map<string, number>();
      const assignmentCoverageByTask = new Map<string, Coverage>();

      for (const task of projectTasks) {
        const metric = canonical.get(task.id);
        if (!metric?.isCanonicalHolder) continue;
        holderCount += 1;
        const outsourced = isOutsourcedBranch(task.id);
        if (outsourced) {
          const cost = (metric.branchEstimatedMinutes / 60) * outsourcedRate;
          projectedOutsourced += cost;
          outsourcedByTask.set(task.id, cost);
          assignmentCoverageByTask.set(task.id, "NOT_EXPECTED");
          completeAssignmentHolders += 1;
          continue;
        }

        laborHolderCount += 1;
        const assignment = collectBranchUserIds(task.id, metric.descendantTaskIds, rawByTaskId);
        const resolvedAssignment = resolveForecastAssignment(
          assignment,
          personCostRateByTeamworkId,
          jobRoleCostRateByTeamworkId,
        );
        const hasRemainingWork = metric.remainingMinutes > 0 && !metric.isBranchComplete;
        let assignmentCoverage: Coverage;
        if (!hasRemainingWork) assignmentCoverage = "NOT_EXPECTED";
        else if (resolvedAssignment.totalSelected === 0) assignmentCoverage = "MISSING";
        else if (resolvedAssignment.knownRateCount === resolvedAssignment.totalSelected)
          assignmentCoverage = "COMPLETE";
        else if (resolvedAssignment.knownRateCount > 0) assignmentCoverage = "PARTIAL";
        else assignmentCoverage = "MISSING";
        assignmentCoverageByTask.set(task.id, assignmentCoverage);
        if (assignmentCoverage === "COMPLETE" || assignmentCoverage === "NOT_EXPECTED")
          completeAssignmentHolders += 1;
        else if (assignmentCoverage === "PARTIAL") partialAssignmentHolders += 1;

        const projected =
          resolvedAssignment.averageRate === null
            ? null
            : (metric.branchEstimatedMinutes / 60) * resolvedAssignment.averageRate;
        const remaining = !hasRemainingWork
          ? 0
          : resolvedAssignment.averageRate === null
            ? null
            : (metric.remainingMinutes / 60) * resolvedAssignment.averageRate;
        projectedLaborByTask.set(task.id, projected);
        remainingLaborByTask.set(task.id, remaining);
        if (projected !== null) {
          projectedLaborKnown += projected;
          knownProjectedLaborHolderCount += 1;
        }
        if (remaining !== null) {
          remainingLaborKnown += remaining;
          knownRemainingLaborHolderCount += 1;
        }

        if (hasRemainingWork && resolvedAssignment.totalSelected === 0) {
          warningCount += 1;
          const hasNonCostedAssignment =
            assignment.teamIds.length + assignment.companyIds.length > 0;
          allIssues.push({
            projectId: project.id,
            taskId: task.id,
            severity: "WARNING",
            code: hasNonCostedAssignment
              ? "NON_COSTED_ASSIGNMENT_UNRESOLVED"
              : "MISSING_TASK_ASSIGNMENT",
            message: hasNonCostedAssignment
              ? "Remaining estimated work is assigned only to a team or company without a forecast cost rate."
              : "Remaining estimated work has no individual or job-role assignment; projected labor cost is incomplete.",
            details: { ...assignment, remainingMinutes: metric.remainingMinutes },
          });
        } else if (
          hasRemainingWork &&
          resolvedAssignment.knownRateCount < resolvedAssignment.totalSelected
        ) {
          warningCount += 1;
          const isRole = resolvedAssignment.source === "JOB_ROLE";
          allIssues.push({
            projectId: project.id,
            taskId: task.id,
            severity: "WARNING",
            code: isRole ? "MISSING_JOB_ROLE_COST_RATE" : "MISSING_EMPLOYEE_COST_RATE",
            message: isRole
              ? "At least one assigned Teamwork job role has no returned cost rate; remaining labor is partial."
              : "At least one assigned employee has no returned cost rate; remaining labor is partial.",
            details: {
              assignmentSource: resolvedAssignment.source,
              assigned: resolvedAssignment.totalSelected,
              withRate: resolvedAssignment.knownRateCount,
              remainingMinutes: metric.remainingMinutes,
              jobRoleNames: assignment.jobRoleIds.map(
                (id) => jobRoleByTeamworkId.get(id)?.name ?? `Job role ${id}`,
              ),
            },
          });
        }
      }

      const assignmentCoverage: Coverage =
        holderCount === 0
          ? "NOT_EXPECTED"
          : completeAssignmentHolders === holderCount
            ? "COMPLETE"
            : completeAssignmentHolders + partialAssignmentHolders > 0
              ? "PARTIAL"
              : "MISSING";

      const activeExpenseCosts = projectExpenses.map((expense) => numeric(expense.totalCost));
      const knownExpenseCostCount = activeExpenseCosts.filter((value) => value !== null).length;
      const actualNonLaborKnown = activeExpenseCosts.reduce<number>(
        (sum, value) => sum + (value ?? 0),
        0,
      );
      const projectTagNames = tagNamesByProject.get(project.id) ?? [];
      const hasOutsourcedTask = projectTasks.some((task) => isOutsourcedBranch(task.id));
      const expenseCoverage = resolveExpenseCoverage({
        hasOutsourcedTask,
        expenseValues: activeExpenseCosts,
      });
      const actualOutsourced = projectExpenses
        .filter((expense) => expense.isOutsourcedModeling)
        .reduce((sum, expense) => sum + (numeric(expense.totalCost) ?? 0), 0);
      const remainingOutsourced = Math.max(projectedOutsourced - actualOutsourced, 0);

      const budgetRequiredTaskListIds = new Set(
        projectTaskLists
          .filter((taskList) => taskList.operationalGroup !== "Admin")
          .map((taskList) => taskList.id),
      );

      const budgetedRequiredTaskListIds = new Set(
        plannedFinancials.knownTaskListBudgets
          .filter((budget) => budgetRequiredTaskListIds.has(budget.taskListId))
          .map((budget) => budget.taskListId),
      );

      const taskListBudgetCoverage = calculateTaskListBudgetCoverage(
        projectTaskLists,
        plannedFinancials.knownTaskListBudgets,
      );
      if (taskListBudgetCoverage === "MISSING" || taskListBudgetCoverage === "PARTIAL") {
        warningCount += 1;
        allIssues.push({
          projectId: project.id,
          severity: "WARNING",
          code: "TASK_LIST_BUDGET_COVERAGE_INCOMPLETE",
          message:
            "No complete set of Teamwork task-list target budgets was returned across the project Finance budgets.",
          details: {
            budgetRequiredTaskLists: budgetRequiredTaskListIds.size,
            taskListsWithTargetBudget: budgetedRequiredTaskListIds.size,
            coverage: taskListBudgetCoverage,
          },
        });
      }
      if (!currentBudget) {
        warningCount += 1;
        allIssues.push({
          projectId: project.id,
          severity: "WARNING",
          code: "PROJECT_BUDGET_MISSING",
          message: "No current Teamwork fixed-fee project budget was returned.",
        });
      }
      if (unallocatedMinutes > 0) {
        warningCount += 1;
        allIssues.push({
          projectId: project.id,
          severity: "WARNING",
          code: "UNALLOCATED_PROJECT_TIME",
          message:
            "Time logged directly to the project is included in project totals but excluded from group and task totals.",
          details: { minutes: unallocatedMinutes },
        });
      }
      if (laborCoverage === "MISSING" || laborCoverage === "PARTIAL") {
        warningCount += 1;
        allIssues.push({
          projectId: project.id,
          severity: "WARNING",
          code: "ACTUAL_LABOR_COST_INCOMPLETE",
          message:
            "Some historical time entries do not contain a usable Teamwork cost total or cost rate.",
          details: { entries: projectTime.length, entriesWithCost: actualLaborCompleteEntries },
        });
      }
      if (hasOutsourcedTask && projectExpenses.length === 0) {
        warningCount += 1;
        allIssues.push({
          projectId: project.id,
          severity: "WARNING",
          code: "OUTSOURCED_EXPENSE_MISSING",
          message:
            "An outsourced-cost task exists, but no matching Teamwork Finance expense was returned.",
          details: { projectedOutsourcedCost: projectedOutsourced },
        });
      }

      const projectedLaborValue =
        laborHolderCount === 0
          ? 0
          : knownProjectedLaborHolderCount === 0
            ? null
            : projectedLaborKnown;
      const remainingLaborValue =
        laborHolderCount === 0
          ? 0
          : knownRemainingLaborHolderCount === 0
            ? null
            : remainingLaborKnown;
      const actualLaborValue =
        projectTime.length === 0 ? 0 : actualLaborCompleteEntries === 0 ? null : actualLaborKnown;
      const actualNonLaborValue =
        projectExpenses.length === 0
          ? hasOutsourcedTask
            ? null
            : 0
          : knownExpenseCostCount === 0
            ? null
            : actualNonLaborKnown;
      const projectedNonLabor = projectedOutsourced;
      const remainingNonLabor = remainingOutsourced;
      // Totals remain known-subtotal values when one source is incomplete. Coverage and
      // isProvisional make that partial status explicit; missing components are never
      // represented as zero in their individual fields.
      const projectedTotal = projectedLaborKnown + projectedNonLabor;
      const actualTotal = actualLaborKnown + actualNonLaborKnown;
      const forecastCost =
        actualLaborKnown + actualNonLaborKnown + remainingLaborKnown + remainingNonLabor;
      const { clientFee, targetCost, targetProfit, targetMarginPercent } = plannedFinancials;
      const forecastProfit = clientFee === null ? null : clientFee - forecastCost;
      const forecastMarginPercent =
        clientFee === null || clientFee === 0 || forecastProfit === null
          ? null
          : (forecastProfit / clientFee) * 100;
      const totalTaskCount = projectTasks.length;
      const completedTaskCount = projectTasks.filter((task) =>
        completed(task.status, task.completedAt),
      ).length;
      const progressPercent =
        totalTaskCount === 0 ? 0 : (completedTaskCount / totalTaskCount) * 100;
      const estimateConsumptionPercent =
        canonicalEstimatedMinutes === 0
          ? null
          : (plannedTaskLinkedMinutes / canonicalEstimatedMinutes) * 100;
      const incompleteTasks = projectTasks.filter(
        (task) => !completed(task.status, task.completedAt),
      );
      const overdueIncompleteTaskCount = incompleteTasks.filter((task) =>
        isPastDue(task.dueDate, asOfDate),
      ).length;

      const completenessScore =
        ((clientFee !== null && targetCost !== null
          ? 100
          : clientFee !== null || targetCost !== null
            ? 50
            : 0) +
          (canonicalEstimatedMinutes > 0 ? 100 : 0) +
          coveragePoints(assignmentCoverage) +
          coveragePoints(laborCoverage) +
          (coveragePoints(expenseCoverage) + coveragePoints(taskListBudgetCoverage)) / 2) /
        5;
      const health = calculateHealth({
        clientFee,
        targetMarginPercent,
        forecastMarginPercent,
        startDate: project.startDate,
        endDate: project.endDate,
        progressPercent,
        estimateConsumptionPercent,
        incompleteTaskCount: incompleteTasks.length,
        overdueIncompleteTaskCount,
        completenessScore,
        asOfDate,
      });
      const isProvisional =
        !currentBudget ||
        (assignmentCoverage !== "COMPLETE" && assignmentCoverage !== "NOT_EXPECTED") ||
        laborCoverage === "MISSING" ||
        laborCoverage === "PARTIAL" ||
        expenseCoverage === "MISSING" ||
        expenseCoverage === "PARTIAL";

      const taskMetricRows: TaskMetricInsert[] = projectTasks.map((task) => {
        const metric = canonical.get(task.id)!;
        const branchIds = [task.id, ...metric.descendantTaskIds];
        const branchActualLabor = branchIds.reduce(
          (sum, taskId) => sum + (actualCostByTask.get(taskId) ?? 0),
          0,
        );
        const branchLoggedEntries = projectTime.filter(
          (entry) => entry.taskId !== null && branchIds.includes(entry.taskId),
        );
        const branchKnownCostEntries = branchLoggedEntries.filter((entry) => {
          const total = numeric(entry.historicalCostTotal);
          const rate = numeric(entry.historicalCostRate);
          return total !== null || rate !== null;
        }).length;
        const branchActualLaborValue =
          branchLoggedEntries.length === 0
            ? 0
            : branchKnownCostEntries === 0
              ? null
              : branchActualLabor;
        const outsourced = isOutsourcedBranch(task.id) && metric.isCanonicalHolder;
        return {
          taskId: task.id,
          projectId: project.id,
          calculationRunId: run.id,
          estimateSource: metric.estimateSource,
          ownEstimatedMinutes: metric.ownEstimatedMinutes,
          countedEstimatedMinutes: metric.countedEstimatedMinutes,
          branchEstimatedMinutes: metric.branchEstimatedMinutes,
          ownLoggedMinutes: metric.ownLoggedMinutes,
          branchLoggedMinutes: metric.branchLoggedMinutes,
          remainingMinutes: metric.remainingMinutes,
          isCanonicalHolder: metric.isCanonicalHolder,
          isBranchComplete: metric.isBranchComplete,
          isOutsourced: outsourced,
          projectedLaborCost: money(projectedLaborByTask.get(task.id) ?? null),
          actualLaborCost: money(branchActualLaborValue),
          remainingLaborCost: money(remainingLaborByTask.get(task.id) ?? null),
          projectedOutsourcedCost: money(outsourcedByTask.get(task.id) ?? 0),
          assignmentCoverage: assignmentCoverageByTask.get(task.id) ?? "NOT_EXPECTED",
          details: {
            descendantTaskCount: metric.descendantTaskIds.length,
            coveredByCanonicalTaskId: holderByCoveredTaskId.get(task.id) ?? null,
            isUnplannedTopLevelTask: unplannedTasks.some((item) => item.id === task.id),
          },
        };
      });
      allTaskMetrics.push(...taskMetricRows);

      const groups = [...new Set(projectTaskLists.map((taskList) => taskList.operationalGroup))];
      for (const groupName of groups) {
        const groupTaskListIds = new Set(
          projectTaskLists
            .filter((taskList) => taskList.operationalGroup === groupName)
            .map((taskList) => taskList.id),
        );
        const groupTasks = projectTasks.filter((task) => groupTaskListIds.has(task.taskListId));
        const groupTaskIds = new Set(groupTasks.map((task) => task.id));
        const groupTime = projectTime.filter(
          (entry) => entry.taskId && groupTaskIds.has(entry.taskId),
        );
        const groupEstimated = groupTasks.reduce(
          (sum, task) => sum + (canonical.get(task.id)?.countedEstimatedMinutes ?? 0),
          0,
        );
        const groupLogged = groupTime.reduce((sum, entry) => sum + entry.minutes, 0);
        const groupLaborHolders = groupTasks.filter(
          (task) => canonical.get(task.id)?.isCanonicalHolder && !isOutsourcedBranch(task.id),
        );
        const groupKnownProjectedLabor = groupLaborHolders.filter(
          (task) => projectedLaborByTask.get(task.id) !== null,
        );
        const groupKnownRemainingLabor = groupLaborHolders.filter(
          (task) => remainingLaborByTask.get(task.id) !== null,
        );
        const groupProjectedLaborKnown = groupTasks.reduce(
          (sum, task) => sum + (projectedLaborByTask.get(task.id) ?? 0),
          0,
        );
        const groupRemainingLaborKnown = groupTasks.reduce(
          (sum, task) => sum + (remainingLaborByTask.get(task.id) ?? 0),
          0,
        );
        const groupProjectedLabor =
          groupLaborHolders.length === 0
            ? 0
            : groupKnownProjectedLabor.length === 0
              ? null
              : groupProjectedLaborKnown;
        let groupActualLaborKnown = 0;
        let groupKnownCostEntries = 0;
        for (const entry of groupTime) {
          const total = numeric(entry.historicalCostTotal);
          const rate = numeric(entry.historicalCostRate);
          const cost = total ?? (rate === null ? null : (entry.minutes / 60) * rate);
          if (cost !== null) {
            groupActualLaborKnown += cost;
            groupKnownCostEntries += 1;
          }
        }
        const groupActualLabor =
          groupTime.length === 0 ? 0 : groupKnownCostEntries === 0 ? null : groupActualLaborKnown;
        const groupProjectedNonLabor = groupTasks.reduce(
          (sum, task) => sum + (outsourcedByTask.get(task.id) ?? 0),
          0,
        );
        const groupExpenseRows = projectExpenses.filter((expense) => {
          if (expense.taskListId) return groupTaskListIds.has(expense.taskListId);
          return expense.operationalGroup === groupName;
        });
        const groupKnownExpenseRows = groupExpenseRows.filter(
          (expense) => numeric(expense.totalCost) !== null,
        );
        const groupActualNonLaborKnown = groupExpenseRows.reduce(
          (sum, expense) => sum + (numeric(expense.totalCost) ?? 0),
          0,
        );
        const groupActualNonLabor =
          groupExpenseRows.length === 0
            ? 0
            : groupKnownExpenseRows.length === 0
              ? null
              : groupActualNonLaborKnown;
        const groupActualOutsourced = groupExpenseRows
          .filter((expense) => expense.isOutsourcedModeling)
          .reduce((sum, expense) => sum + (numeric(expense.totalCost) ?? 0), 0);
        const groupRemainingOutsourced = Math.max(
          groupProjectedNonLabor - groupActualOutsourced,
          0,
        );
        const groupForecast =
          groupActualLaborKnown +
          groupActualNonLaborKnown +
          groupRemainingLaborKnown +
          groupRemainingOutsourced;
        const groupBudgets = projectTaskListBudgets.filter((budget) =>
          groupTaskListIds.has(budget.taskListId),
        );
        const knownGroupBudgets = groupBudgets
          .map((budget) => numeric(budget.targetCost))
          .filter((value): value is number => value !== null);
        const groupTaskLists = projectTaskLists.filter((taskList) =>
          groupTaskListIds.has(taskList.id),
        );

        const groupTargetCoverage = calculateTaskListBudgetCoverage(groupTaskLists, groupBudgets);
        const groupTarget =
          knownGroupBudgets.length === 0
            ? null
            : knownGroupBudgets.reduce((sum, value) => sum + value, 0);
        const groupCompleted = groupTasks.filter((task) =>
          completed(task.status, task.completedAt),
        ).length;
        const groupProgress =
          groupTasks.length === 0 ? 0 : (groupCompleted / groupTasks.length) * 100;
        allGroupMetrics.push({
          projectId: project.id,
          groupName,
          calculationRunId: run.id,
          targetCost: money(groupTarget),
          targetCostCoverage: groupTargetCoverage,
          estimatedMinutes: groupEstimated,
          loggedMinutes: groupLogged,
          projectedLaborCost: money(groupProjectedLabor),
          actualLaborCost: money(groupActualLabor),
          projectedNonLaborCost: money(groupProjectedNonLabor),
          actualNonLaborCost: money(groupActualNonLabor),
          forecastCost: money(groupForecast),
          varianceToTarget: money(groupTarget === null ? null : groupTarget - groupForecast),
          progressPercent: decimal(groupProgress),
          details: {
            taskListCount: groupTaskListIds.size,
            taskCount: groupTasks.length,
            laborEstimateHolderCount: groupLaborHolders.length,
            laborEstimateHoldersWithProjectedCost: groupKnownProjectedLabor.length,
            laborEstimateHoldersWithRemainingCost: groupKnownRemainingLabor.length,
            timeEntryCount: groupTime.length,
            timeEntriesWithHistoricalCost: groupKnownCostEntries,
            expenseCount: groupExpenseRows.length,
            expensesWithCost: groupKnownExpenseRows.length,
            taskListsWithTargetBudget: new Set(
              groupBudgets
                .filter((budget) => numeric(budget.targetCost) !== null)
                .map((budget) => budget.taskListId),
            ).size,
          },
        });
      }

      await db.insert(projectMetrics).values({
        projectId: project.id,
        calculationRunId: run.id,
        clientFee: money(clientFee),
        targetCost: money(targetCost),
        targetProfit: money(targetProfit),
        targetMarginPercent: decimal(targetMarginPercent),
        canonicalEstimatedMinutes,
        loggedMinutes,
        taskLinkedMinutes,
        unallocatedMinutes,
        unestimatedLoggedMinutes: unplannedLoggedMinutes,
        completedTaskCount,
        totalTaskCount,
        projectedLaborCost: money(projectedLaborValue),
        actualLaborCost: money(actualLaborValue),
        remainingLaborCost: money(remainingLaborValue),
        projectedNonLaborCost: money(projectedNonLabor),
        actualNonLaborCost: money(actualNonLaborValue),
        remainingNonLaborCost: money(remainingNonLabor),
        projectedTotalCost: money(projectedTotal),
        actualTotalCost: money(actualTotal),
        forecastCost: money(forecastCost),
        forecastProfit: money(forecastProfit),
        forecastMarginPercent: decimal(forecastMarginPercent),
        estimateConsumptionPercent: decimal(estimateConsumptionPercent),
        progressPercent: decimal(progressPercent),
        financialScore: decimal(health.financialScore),
        scheduleScore: decimal(health.scheduleScore),
        effortScore: decimal(health.effortScore),
        overdueScore: decimal(health.overdueScore),
        completenessScore: decimal(completenessScore),
        healthScore: decimal(health.healthScore),
        healthBand: health.healthBand,
        laborCoverage,
        assignmentCoverage,
        taskListBudgetCoverage,
        expenseCoverage,
        isProvisional,
        details: {
          calculationVersion: CALCULATION_VERSION,
          asOfDate: asOfDate.toISOString(),
          outsourcedHourlyRate: outsourcedRate,
          outsourcedEstimatedMinutes: [...outsourcedByTask.keys()].reduce(
            (sum, taskId) => sum + (canonical.get(taskId)?.branchEstimatedMinutes ?? 0),
            0,
          ),
          projectedOutsourcedCost: projectedOutsourced,
          actualOutsourcedCost: actualOutsourced,
          remainingOutsourcedCost: remainingOutsourced,
          healthOverrides: health.overrides,
          currentBudgetTeamworkId: currentBudget?.teamworkId ?? null,
          laborEstimateHolderCount: laborHolderCount,
          laborEstimateHoldersWithProjectedCost: knownProjectedLaborHolderCount,
          laborEstimateHoldersWithRemainingCost: knownRemainingLaborHolderCount,
          plannedTaskLinkedMinutes,
          nonCanonicalLoggedMinutes,
          unplannedLoggedMinutes,
          unplannedTaskCount: unplannedTasks.length,
          timeEntryCount: projectTime.length,
          timeEntriesWithHistoricalCost: actualLaborCompleteEntries,
          expenseCount: projectExpenses.length,
          expensesWithCost: knownExpenseCostCount,
          tags: projectTagNames,
        },
      });

      projectSummaries.push({
        projectId: project.id,
        teamworkId: project.teamworkId,
        projectNumber: project.projectNumber,
        healthBand: health.healthBand,
        provisional: isProvisional,
        warnings: allIssues.filter((issue) => issue.projectId === project.id).length,
      });
    }

    await insertChunks(allTaskMetrics, async (chunk) => {
      await db.insert(taskMetrics).values(chunk);
    });
    await insertChunks(allGroupMetrics, async (chunk) => {
      await db.insert(operationalGroupMetrics).values(chunk);
    });
    await insertChunks(allIssues, async (chunk) => {
      await db.insert(dataQualityIssues).values(chunk);
    });

    const status = warningCount > 0 ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED";
    const summary = {
      projects: reportingProjects.length,
      taskMetrics: allTaskMetrics.length,
      groupMetrics: allGroupMetrics.length,
      dataQualityIssues: allIssues.length,
      outsourcedHourlyRate: outsourcedRate,
      healthBands: projectSummaries.reduce<Record<string, number>>((counts, item) => {
        const band = String(item.healthBand);
        counts[band] = (counts[band] ?? 0) + 1;
        return counts;
      }, {}),
    };
    await db
      .update(calculationRuns)
      .set({
        status,
        completedAt: new Date(),
        projectsRead: reportingProjects.length,
        projectsCalculated: reportingProjects.length,
        warnings: warningCount,
        errors: 0,
        summary,
      })
      .where(eq(calculationRuns.id, run.id));

    return { runId: run.id, status, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(calculationRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        errors: 1,
        summary: { message },
      })
      .where(eq(calculationRuns.id, run.id));
    throw error;
  }
}
