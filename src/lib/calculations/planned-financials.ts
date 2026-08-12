import type { Coverage } from "./types";

export type ProjectBudgetSource = {
  id: string;
  teamworkId: number;
  status: string;
  category: string | null;
  clientFee: string | number | null;
  isCurrent: boolean;
};

export type TaskListBudgetSource = {
  projectBudgetId: string;
  taskListId: string;
  targetCost: string | number | null;
};

function numeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function selectRevenueBudget(
  projectBudgets: readonly ProjectBudgetSource[],
): ProjectBudgetSource | null {
  const explicitCurrent = projectBudgets.find(
    (budget) =>
      budget.isCurrent &&
      (normalized(budget.category) === "" || normalized(budget.category) === "FIXEDFEE"),
  );

  if (explicitCurrent) {
    return explicitCurrent;
  }

  const activeFixedFee = projectBudgets.find(
    (budget) =>
      normalized(budget.category) === "FIXEDFEE" && normalized(budget.status) === "ACTIVE",
  );

  if (activeFixedFee) {
    return activeFixedFee;
  }

  return projectBudgets.find((budget) => normalized(budget.category) === "FIXEDFEE") ?? null;
}
export type TaskListCoverageSource = {
  id: string;
  operationalGroup: string;
};

export function calculateTaskListBudgetCoverage(
  taskLists: readonly TaskListCoverageSource[],
  taskListBudgets: readonly TaskListBudgetSource[],
): Coverage {
  const requiredTaskListIds = new Set(
    taskLists
      .filter((taskList) => taskList.operationalGroup !== "Admin")
      .map((taskList) => taskList.id),
  );

  if (requiredTaskListIds.size === 0) {
    return "NOT_EXPECTED";
  }

  const coveredTaskListIds = new Set(
    taskListBudgets
      .filter(
        (budget) =>
          requiredTaskListIds.has(budget.taskListId) && numeric(budget.targetCost) !== null,
      )
      .map((budget) => budget.taskListId),
  );

  if (coveredTaskListIds.size === 0) {
    return "MISSING";
  }

  if (coveredTaskListIds.size === requiredTaskListIds.size) {
    return "COMPLETE";
  }

  return "PARTIAL";
}

export function calculatePlannedFinancials(
  projectBudgets: readonly ProjectBudgetSource[],
  taskListBudgets: readonly TaskListBudgetSource[],
) {
  const revenueBudget = selectRevenueBudget(projectBudgets);

  const activeFixedFeeBudgets = projectBudgets.filter(
    (budget) =>
      normalized(budget.category) === "FIXEDFEE" && normalized(budget.status) === "ACTIVE",
  );

  const revenueBudgets =
    activeFixedFeeBudgets.length > 0 ? activeFixedFeeBudgets : revenueBudget ? [revenueBudget] : [];

  const revenueFeeValues = revenueBudgets.map((budget) => numeric(budget.clientFee));

  const clientFee =
    revenueBudgets.length === 0 || revenueFeeValues.some((value) => value === null)
      ? null
      : revenueFeeValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);

  const projectBudgetIds = new Set(projectBudgets.map((budget) => budget.id));

  const applicableTaskListBudgets = taskListBudgets.filter((budget) =>
    projectBudgetIds.has(budget.projectBudgetId),
  );

  const knownTaskListBudgets = applicableTaskListBudgets
    .map((budget) => ({
      ...budget,
      numericTargetCost: numeric(budget.targetCost),
    }))
    .filter(
      (
        budget,
      ): budget is typeof budget & {
        numericTargetCost: number;
      } => budget.numericTargetCost !== null,
    );

  const targetCost =
    knownTaskListBudgets.length === 0
      ? null
      : knownTaskListBudgets.reduce((sum, budget) => sum + budget.numericTargetCost, 0);

  const targetProfit = clientFee === null || targetCost === null ? null : clientFee - targetCost;

  const targetMarginPercent =
    clientFee === null || clientFee === 0 || targetProfit === null
      ? null
      : (targetProfit / clientFee) * 100;

  const budgetedTaskListIds = new Set(knownTaskListBudgets.map((budget) => budget.taskListId));

  const sourceProjectBudgetIds = new Set(
    knownTaskListBudgets.map((budget) => budget.projectBudgetId),
  );

  return {
    revenueBudget,
    revenueBudgets,
    clientFee,
    targetCost,
    targetProfit,
    targetMarginPercent,
    applicableTaskListBudgets,
    knownTaskListBudgets,
    budgetedTaskListIds,
    sourceProjectBudgetIds,
  };
}
