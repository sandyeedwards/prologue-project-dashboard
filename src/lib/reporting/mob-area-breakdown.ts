import { isReadySetMobilizationTaskList, isTravelTask } from "@/lib/reporting/operational-group";

export type MobAreaKind = "READY_SET" | "DATA_HALL";

type MobAreaTask = {
  name: string;
  taskListName: string;
  operationalGroup: string;
  countedEstimatedMinutes: number;
  branchLoggedMinutes: number;
  remainingMinutes: number;
  projectedLaborCost: string | null;
  actualLaborCost: string | null;
  remainingLaborCost: string | null;
};

type MobAreaExpense = {
  taskListName: string | null;
  operationalGroup: string | null;
  totalCost: string | null;
};

export type MobAreaTaskRollup = {
  estimatedMinutes: number;
  loggedMinutes: number;
  remainingMinutes: number;
  actualLaborCost: string | null;
  remainingLaborCost: string | null;
  projectedLaborCost: string | null;
};

export type MobAreaBreakdownRow = MobAreaTaskRollup & {
  name: string;
  actualExpenseCost: string | null;
  actualTotalCost: string | null;
  travel: MobAreaTaskRollup;
  otherFieldwork: MobAreaTaskRollup;
};

function numberOrNull(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumCompleteCosts(values: readonly (string | null)[]): string | null {
  if (!values.length) return "0";

  const parsed = values.map(numberOrNull);
  if (parsed.some((value) => value === null)) return null;

  return parsed.reduce<number>((sum, value) => sum + (value ?? 0), 0).toString();
}

function addCompleteCosts(left: string | null, right: string | null): string | null {
  const leftNumber = numberOrNull(left);
  const rightNumber = numberOrNull(right);

  if (leftNumber === null || rightNumber === null) return null;

  return (leftNumber + rightNumber).toString();
}

function rollupTasks(tasks: readonly MobAreaTask[]): MobAreaTaskRollup {
  return {
    estimatedMinutes: tasks.reduce((sum, task) => sum + task.countedEstimatedMinutes, 0),
    loggedMinutes: tasks.reduce((sum, task) => sum + task.branchLoggedMinutes, 0),
    remainingMinutes: tasks.reduce((sum, task) => sum + task.remainingMinutes, 0),
    actualLaborCost: sumCompleteCosts(tasks.map((task) => task.actualLaborCost)),
    remainingLaborCost: sumCompleteCosts(tasks.map((task) => task.remainingLaborCost)),
    projectedLaborCost: sumCompleteCosts(tasks.map((task) => task.projectedLaborCost)),
  };
}

function isBreakdownList(
  kind: MobAreaKind,
  taskListName: string,
  operationalGroup: string | null,
): boolean {
  if (operationalGroup !== "Fieldwork") return false;

  if (kind === "DATA_HALL") return true;

  return isReadySetMobilizationTaskList(taskListName);
}

export function buildMobAreaBreakdown({
  kind,
  tasks,
  expenses,
}: {
  kind: MobAreaKind;
  tasks: readonly MobAreaTask[];
  expenses: readonly MobAreaExpense[];
}): MobAreaBreakdownRow[] {
  const names = new Set<string>();

  for (const task of tasks) {
    if (isBreakdownList(kind, task.taskListName, task.operationalGroup)) {
      names.add(task.taskListName);
    }
  }

  for (const expense of expenses) {
    if (
      expense.taskListName &&
      isBreakdownList(kind, expense.taskListName, expense.operationalGroup)
    ) {
      names.add(expense.taskListName);
    }
  }

  return [...names]
    .sort((left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    )
    .map((name) => {
      const taskListTasks = tasks.filter(
        (task) => task.taskListName === name && task.operationalGroup === "Fieldwork",
      );

      const taskListExpenses = expenses.filter((expense) => expense.taskListName === name);

      const travelTasks = taskListTasks.filter((task) => isTravelTask(task.name));

      const otherFieldworkTasks = taskListTasks.filter((task) => !isTravelTask(task.name));

      const taskRollup = rollupTasks(taskListTasks);
      const actualExpenseCost = sumCompleteCosts(
        taskListExpenses.map((expense) => expense.totalCost),
      );

      return {
        name,
        ...taskRollup,
        actualExpenseCost,
        actualTotalCost: addCompleteCosts(taskRollup.actualLaborCost, actualExpenseCost),
        travel: rollupTasks(travelTasks),
        otherFieldwork: rollupTasks(otherFieldworkTasks),
      };
    });
}
