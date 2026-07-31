import { getDb } from "@/db/client";
import {
  expenses,
  outsourcedTaskAliases,
  projectBudgets,
  projects,
  taskListBudgets,
  taskLists,
  tasks,
} from "@/db/schema";
import { REPORTING_RULES } from "@/config/reporting-rules";
import { collectionRows } from "@/lib/teamwork/collections";
import {
  firstValue,
  idAtPaths,
  numberAtPaths,
  textAtPaths,
  type TeamworkRecord,
} from "@/lib/teamwork/fields";
import { activeConnection, teamworkFetch } from "@/lib/teamwork/client";
import { normalizeTeamworkLabel } from "@/lib/teamwork/normalize";
import {
  teamworkBudgetMoney,
  teamworkExpenseMoney,
  type TeamworkExpenseSource,
} from "./money-units";

type ExpenseCandidate = {
  row: TeamworkRecord;
  source: TeamworkExpenseSource;
};

interface FinancialSyncResult {
  projectBudgetsRead: number;
  projectBudgetsImported: number;
  taskListBudgetsRead: number;
  taskListBudgetsImported: number;
  expensesRead: number;
  expensesImported: number;
  warnings: string[];
}

function dateText(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.slice(0, 10);
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function outsourcedTitleMatcher(normalizedAliases: readonly string[]) {
  return (title: string): boolean => {
    const normalized = normalizeTeamworkLabel(title);
    return normalizedAliases.some(
      (alias) => normalized === alias || (alias.length >= 8 && normalized.includes(alias)),
    );
  };
}

export async function syncFinancialSources(): Promise<FinancialSyncResult> {
  const db = getDb();
  const connection = await activeConnection();
  const configuredAliases = await db.select().from(outsourcedTaskAliases);
  const normalizedAliases = configuredAliases
    .filter((row) => row.isActive)
    .map((row) => row.normalizedAlias || normalizeTeamworkLabel(row.alias))
    .filter((value) => value.length > 0);
  if (normalizedAliases.length === 0) {
    normalizedAliases.push(
      ...REPORTING_RULES.outsourcedTaskAliases.map((alias) => normalizeTeamworkLabel(alias)),
    );
  }
  const isOutsourcedTitle = outsourcedTitleMatcher(normalizedAliases);
  const result: FinancialSyncResult = {
    projectBudgetsRead: 0,
    projectBudgetsImported: 0,
    taskListBudgetsRead: 0,
    taskListBudgetsImported: 0,
    expensesRead: 0,
    expensesImported: 0,
    warnings: [],
  };

  const projectPayload = await teamworkFetch<TeamworkRecord>(
    connection,
    "/projects/api/v3/projects.json?includeArchivedProjects=true&includeProjectDates=true&includeProjectProfitability=true&skipCounts=true&include=projectBudgets&page=1&pageSize=500",
  );
  const included = (projectPayload.included ?? {}) as TeamworkRecord;
  const budgetRows = collectionRows<TeamworkRecord>(included.projectBudgets);
  const projectRows = collectionRows<TeamworkRecord>(projectPayload.projects);
  result.projectBudgetsRead = budgetRows.length;

  const projectByTeamworkId = new Map(
    (await db.select({ id: projects.id, teamworkId: projects.teamworkId }).from(projects)).map(
      (row) => [row.teamworkId, row.id],
    ),
  );
  await db.update(projectBudgets).set({ isCurrent: false, updatedAt: new Date() });
  const currentBudgetByProjectTeamworkId = new Map<number, number>();
  for (const row of projectRows) {
    const projectTeamworkId = idAtPaths(row, ["id", "projectId"]);
    const budgetTeamworkId = idAtPaths(row, [
      "financialBudgetId",
      "financialBudget.id",
      "budgetId",
    ]);
    if (projectTeamworkId !== null && budgetTeamworkId !== null) {
      currentBudgetByProjectTeamworkId.set(projectTeamworkId, budgetTeamworkId);
    }
  }

  for (const row of budgetRows) {
    const teamworkId = idAtPaths(row, ["id", "budgetId"]);
    const projectTeamworkId = idAtPaths(row, ["projectId", "project.id"]);
    const projectId = projectTeamworkId === null ? null : projectByTeamworkId.get(projectTeamworkId);
    if (teamworkId === null || projectTeamworkId === null || !projectId) {
      result.warnings.push("A project budget was skipped because its project relationship was missing.");
      continue;
    }
    const status = textAtPaths(row, ["status"]) ?? "UNKNOWN";
    const isCurrent =
      currentBudgetByProjectTeamworkId.get(projectTeamworkId) === teamworkId ||
      status.toUpperCase() === "ACTIVE";
    await db
      .insert(projectBudgets)
      .values({
        teamworkId,
        projectId,
        status,
        category: textAtPaths(row, ["budgetCategory", "category", "type"]),
        currencyCode: textAtPaths(row, ["currencyCode", "currency.code"]) ?? "USD",
        clientFee:
          teamworkBudgetMoney(numberAtPaths(row, ["capacity", "budgetAmountFinancial", "amount"]))?.toString() ?? null,
        targetCost: teamworkBudgetMoney(numberAtPaths(row, ["budgetExpectedCost", "expectedCost"]))?.toString() ?? null,
        targetProfit:
          teamworkBudgetMoney(numberAtPaths(row, ["budgetExpectedProfit", "expectedProfit"]))?.toString() ?? null,
        targetMarginPercent:
          numberAtPaths(row, ["budgetProfitMargin", "profitMargin"])?.toString() ?? null,
        startsOn: dateText(firstValue(row, ["startDate", "startDateTime"])),
        endsOn: dateText(firstValue(row, ["endDate", "endDateTime"])),
        isCurrent,
        financialDetailsHidden:
          firstValue(row, ["financialDetailsHidden"]) === true,
        teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
        raw: row,
      })
      .onConflictDoUpdate({
        target: projectBudgets.teamworkId,
        set: {
          projectId,
          status,
          category: textAtPaths(row, ["budgetCategory", "category", "type"]),
          currencyCode: textAtPaths(row, ["currencyCode", "currency.code"]) ?? "USD",
          clientFee:
            teamworkBudgetMoney(numberAtPaths(row, ["capacity", "budgetAmountFinancial", "amount"]))?.toString() ?? null,
          targetCost:
            teamworkBudgetMoney(numberAtPaths(row, ["budgetExpectedCost", "expectedCost"]))?.toString() ?? null,
          targetProfit:
            teamworkBudgetMoney(numberAtPaths(row, ["budgetExpectedProfit", "expectedProfit"]))?.toString() ?? null,
          targetMarginPercent:
            numberAtPaths(row, ["budgetProfitMargin", "profitMargin"])?.toString() ?? null,
          startsOn: dateText(firstValue(row, ["startDate", "startDateTime"])),
          endsOn: dateText(firstValue(row, ["endDate", "endDateTime"])),
          isCurrent,
          financialDetailsHidden: firstValue(row, ["financialDetailsHidden"]) === true,
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
          raw: row,
          updatedAt: new Date(),
        },
      });
    result.projectBudgetsImported += 1;
  }

  const budgetMap = new Map<
    number,
    { id: string; teamworkId: number; projectId: string }
  >(
    (await db
      .select({
        id: projectBudgets.id,
        teamworkId: projectBudgets.teamworkId,
        projectId: projectBudgets.projectId,
      })
      .from(projectBudgets)).map((row) => [row.teamworkId, row]),
  );
  const taskListRows = await db
    .select({
      id: taskLists.id,
      teamworkId: taskLists.teamworkId,
      projectId: taskLists.projectId,
      name: taskLists.name,
      operationalGroup: taskLists.operationalGroup,
    })
    .from(taskLists);
  const taskListMap = new Map(taskListRows.map((row) => [row.teamworkId, row]));
  const taskListsByProjectAndName = new Map<string, typeof taskListRows>();
  for (const taskList of taskListRows) {
    const key = `${taskList.projectId}:${normalizeTeamworkLabel(taskList.name)}`;
    const current = taskListsByProjectAndName.get(key) ?? [];
    current.push(taskList);
    taskListsByProjectAndName.set(key, current);
  }
  const outsourcedTaskListIds = new Set(
    (await db
      .select({ taskListId: tasks.taskListId, isOutsourcedCandidate: tasks.isOutsourcedCandidate })
      .from(tasks))
      .filter((row) => row.isOutsourcedCandidate)
      .map((row) => row.taskListId),
  );

  for (const [budgetTeamworkId, budget] of budgetMap) {
    try {
      const payload = await teamworkFetch<TeamworkRecord>(
        connection,
        `/projects/api/v3/projects/budgets/${budgetTeamworkId}/tasklists/budgets.json?include=tasklists,projectBudgets&page=1&pageSize=250`,
      );
      const rows = collectionRows<TeamworkRecord>(payload.tasklistBudgets ?? payload.taskListBudgets);
      result.taskListBudgetsRead += rows.length;
      for (const row of rows) {
        const teamworkId = idAtPaths(row, ["id", "tasklistBudgetId", "taskListBudgetId"]);
        const taskListTeamworkId = idAtPaths(row, [
          "tasklistId",
          "taskListId",
          "tasklist.id",
          "taskList.id",
        ]);
        const taskList = taskListTeamworkId === null ? null : taskListMap.get(taskListTeamworkId);
        if (!taskList || taskList.projectId !== budget.projectId) {
          result.warnings.push(
            `A task-list budget for Teamwork budget ${budgetTeamworkId} was skipped because its task list was missing.`,
          );
          continue;
        }
        await db
          .insert(taskListBudgets)
          .values({
            teamworkId,
            projectBudgetId: budget.id,
            taskListId: taskList.id,
            targetCost:
              teamworkBudgetMoney(
                numberAtPaths(row, ["capacity", "targetCost", "budgetExpectedCost", "amount"]),
              )?.toString() ?? null,
            source: "TEAMWORK",
            coverage: "COMPLETE",
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
            raw: row,
          })
          .onConflictDoUpdate({
            target: [taskListBudgets.projectBudgetId, taskListBudgets.taskListId],
            set: {
              teamworkId,
              targetCost:
                teamworkBudgetMoney(
                  numberAtPaths(row, ["capacity", "targetCost", "budgetExpectedCost", "amount"]),
                )?.toString() ?? null,
              source: "TEAMWORK",
              coverage: "COMPLETE",
              teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
              raw: row,
              updatedAt: new Date(),
            },
          });
        result.taskListBudgetsImported += 1;
      }
    } catch (error) {
      result.warnings.push(
        `Task-list budgets could not be read for Teamwork budget ${budgetTeamworkId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const expenseRows: ExpenseCandidate[] = [];
  try {
    const legacyPayload = await teamworkFetch<TeamworkRecord>(connection, "/expenses.json");
    expenseRows.push(
      ...collectionRows<TeamworkRecord>(legacyPayload.expenses).map((row) => ({
        row,
        source: "LEGACY" as const,
      })),
    );
  } catch (error) {
    result.warnings.push(
      `Legacy expenses could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  for (const [budgetTeamworkId] of budgetMap) {
    try {
      const payload = await teamworkFetch<TeamworkRecord>(
        connection,
        `/projects/api/v3/projects/budgets/${budgetTeamworkId}/expenses.json?page=1&pageSize=250&showDeleted=true`,
      );
      expenseRows.push(
        ...collectionRows<TeamworkRecord>(
          payload.budgetExpenses ?? payload.expenses,
        ).map((row) => ({ row, source: "BUDGET" as const })),
      );
    } catch (error) {
      result.warnings.push(
        `Budget expenses could not be read for Teamwork budget ${budgetTeamworkId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // When both endpoints return the same expense, prefer the budget endpoint.
  // It is current, carries the budget relationship, and has an explicitly known
  // minor-unit money contract.
  const uniqueExpenseRows = new Map<number, ExpenseCandidate>();
  for (const candidate of expenseRows) {
    const teamworkId = idAtPaths(candidate.row, ["id", "expenseId"]);
    if (teamworkId === null) continue;
    const existing = uniqueExpenseRows.get(teamworkId);
    if (!existing || candidate.source === "BUDGET") {
      uniqueExpenseRows.set(teamworkId, candidate);
    }
  }
  result.expensesRead = uniqueExpenseRows.size;

  for (const [teamworkId, candidate] of uniqueExpenseRows) {
    const { row, source } = candidate;
    const budgetTeamworkId = idAtPaths(row, ["projectBudgetId", "budgetId", "projectBudget.id"]);
    const budget = budgetTeamworkId === null ? null : budgetMap.get(budgetTeamworkId);
    const projectTeamworkId = idAtPaths(row, ["projectId", "project-id", "project.id"]);
    const projectId =
      (projectTeamworkId === null ? null : projectByTeamworkId.get(projectTeamworkId)) ??
      budget?.projectId ??
      null;
    if (!projectId) {
      result.warnings.push(`Expense ${teamworkId} was skipped because its project was missing.`);
      continue;
    }
    const title = textAtPaths(row, ["name", "title", "description"]) ?? `Expense ${teamworkId}`;
    const taskListTeamworkId = idAtPaths(row, [
      "tasklistId",
      "taskListId",
      "tasklist.id",
      "taskList.id",
    ]);
    let taskList = taskListTeamworkId === null ? null : taskListMap.get(taskListTeamworkId) ?? null;
    let taskListInferredFromTitle = false;
    if (!taskList || taskList.projectId !== projectId) {
      const candidates =
        taskListsByProjectAndName.get(`${projectId}:${normalizeTeamworkLabel(title)}`) ?? [];
      if (candidates.length === 1) {
        taskList = candidates[0];
        taskListInferredFromTitle = true;
      } else {
        taskList = null;
      }
    }
    const isOutsourcedModeling =
      isOutsourcedTitle(title) ||
      (taskList !== null && outsourcedTaskListIds.has(taskList.id));
    const totalCost = teamworkExpenseMoney(
      numberAtPaths(row, ["totalCost", "cost", "amount", "price"]),
      source,
    );
    const totalBillable = teamworkExpenseMoney(
      numberAtPaths(row, ["totalBillable", "billableAmount", "billable"]),
      source,
    );
    const raw = {
      ...row,
      _dashboardExpenseSource: source,
      _dashboardTaskListInferredFromTitle: taskListInferredFromTitle,
      _dashboardMoneyNormalized: true,
    };
    await db
      .insert(expenses)
      .values({
        teamworkId,
        projectId,
        projectBudgetId: budget?.id ?? null,
        taskListId: taskList?.id ?? null,
        operationalGroup:
          taskList && taskList.projectId === projectId
            ? taskList.operationalGroup
            : textAtPaths(row, ["operationalGroup"]),
        title,
        category: textAtPaths(row, ["category", "category.name", "type"]),
        expenseDate: dateText(firstValue(row, ["date", "expenseDate", "dateCreated"])),
        totalCost: totalCost?.toString() ?? null,
        totalBillable: totalBillable?.toString() ?? null,
        markupPercent: numberAtPaths(row, ["markupPercent", "markup"])?.toString() ?? null,
        isOutsourcedModeling,
        isDeleted:
          firstValue(row, ["deleted"]) === true || toDate(firstValue(row, ["deletedAt"])) !== null,
        teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
        raw,
      })
      .onConflictDoUpdate({
        target: expenses.teamworkId,
        set: {
          projectId,
          projectBudgetId: budget?.id ?? null,
          taskListId: taskList?.id ?? null,
          operationalGroup:
            taskList && taskList.projectId === projectId
              ? taskList.operationalGroup
              : textAtPaths(row, ["operationalGroup"]),
          title,
          category: textAtPaths(row, ["category", "category.name", "type"]),
          expenseDate: dateText(firstValue(row, ["date", "expenseDate", "dateCreated"])),
          totalCost: totalCost?.toString() ?? null,
          totalBillable: totalBillable?.toString() ?? null,
          markupPercent: numberAtPaths(row, ["markupPercent", "markup"])?.toString() ?? null,
          isOutsourcedModeling,
          isDeleted:
            firstValue(row, ["deleted"]) === true || toDate(firstValue(row, ["deletedAt"])) !== null,
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
          raw,
          updatedAt: new Date(),
        },
      });
    result.expensesImported += 1;
  }

  return result;
}
