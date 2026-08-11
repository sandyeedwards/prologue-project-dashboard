import { describe, expect, it } from "vitest";
import {
  calculatePlannedFinancials,
  calculateTaskListBudgetCoverage,
  selectRevenueBudget,
  type ProjectBudgetSource,
  type TaskListBudgetSource,
} from "./planned-financials";

function budget(overrides: Partial<ProjectBudgetSource> = {}): ProjectBudgetSource {
  return {
    id: "budget-1",
    teamworkId: 1001,
    status: "ACTIVE",
    category: "FIXEDFEE",
    clientFee: "53200.00",
    isCurrent: true,
    ...overrides,
  };
}

describe("selectRevenueBudget", () => {
  it("uses the current fixed-fee budget as project revenue", () => {
    const result = selectRevenueBudget([
      budget({
        id: "original",
        teamworkId: 365005,
        clientFee: "53200.00",
        isCurrent: true,
      }),
      budget({
        id: "change-order",
        teamworkId: 400001,
        clientFee: "3000.00",
        isCurrent: false,
      }),
    ]);

    expect(result?.teamworkId).toBe(365005);
    expect(result?.clientFee).toBe("53200.00");
  });

  it("prefers the explicit current project budget over another active fixed-fee budget", () => {
    const result = selectRevenueBudget([
      budget({
        id: "project-pointer",
        teamworkId: 365005,
        category: null,
        clientFee: "53200.00",
        isCurrent: true,
      }),
      budget({
        id: "other-active-fixed-fee",
        teamworkId: 400001,
        category: "FIXEDFEE",
        clientFee: "3000.00",
        isCurrent: false,
      }),
    ]);

    expect(result?.teamworkId).toBe(365005);
    expect(result?.clientFee).toBe("53200.00");
  });

  it("does not add Finance-budget capacities together for revenue", () => {
    const result = calculatePlannedFinancials(
      [
        budget({
          id: "original",
          clientFee: "53200.00",
          isCurrent: true,
        }),
        budget({
          id: "change-order",
          clientFee: "3000.00",
          isCurrent: false,
        }),
      ],
      [],
    );

    expect(result.clientFee).toBe(53200);
  });
});

describe("calculatePlannedFinancials", () => {
  it("adds task-list budgets across multiple Finance budgets", () => {
    const projectBudgets = [
      budget({
        id: "original",
        clientFee: "50000.00",
        isCurrent: true,
      }),
      budget({
        id: "change-order",
        teamworkId: 1002,
        clientFee: "3000.00",
        isCurrent: false,
      }),
    ];

    const taskListBudgets: TaskListBudgetSource[] = [
      {
        projectBudgetId: "original",
        taskListId: "fieldwork",
        targetCost: "10000.00",
      },
      {
        projectBudgetId: "change-order",
        taskListId: "fieldwork",
        targetCost: "3000.00",
      },
    ];

    const result = calculatePlannedFinancials(projectBudgets, taskListBudgets);

    expect(result.targetCost).toBe(13000);
    expect(result.budgetedTaskListIds).toEqual(new Set(["fieldwork"]));
    expect(result.sourceProjectBudgetIds).toEqual(new Set(["original", "change-order"]));
  });

  it("recalculates planned profit and planned margin", () => {
    const result = calculatePlannedFinancials(
      [budget({ clientFee: "50000.00" })],
      [
        {
          projectBudgetId: "budget-1",
          taskListId: "fieldwork",
          targetCost: "10000.00",
        },
        {
          projectBudgetId: "budget-1",
          taskListId: "modeling",
          targetCost: "15000.00",
        },
      ],
    );

    expect(result.targetCost).toBe(25000);
    expect(result.targetProfit).toBe(25000);
    expect(result.targetMarginPercent).toBe(50);
  });

  it("returns no planned cost when no task-list budgets exist", () => {
    const result = calculatePlannedFinancials([budget()], []);

    expect(result.clientFee).toBe(53200);
    expect(result.targetCost).toBeNull();
    expect(result.targetProfit).toBeNull();
    expect(result.targetMarginPercent).toBeNull();
  });

  it("includes every real task-list budget in project planned cost", () => {
    const result = calculatePlannedFinancials(
      [budget()],
      [
        {
          projectBudgetId: "budget-1",
          taskListId: "admin",
          targetCost: "500.00",
        },
        {
          projectBudgetId: "budget-1",
          taskListId: "fieldwork",
          targetCost: "10000.00",
        },
      ],
    );

    expect(result.targetCost).toBe(10500);
    expect(result.budgetedTaskListIds).toEqual(new Set(["admin", "fieldwork"]));
  });
});

describe("AUB fixture financial rules", () => {
  it("uses $53,200 revenue and $17,084 additive planned cost", () => {
    const result = calculatePlannedFinancials(
      [
        budget({
          id: "aub-original",
          teamworkId: 365005,
          clientFee: "53200.00",
          isCurrent: true,
        }),
      ],
      [
        {
          projectBudgetId: "aub-original",
          taskListId: "fieldwork",
          targetCost: "7600.00",
        },
        {
          projectBudgetId: "aub-original",
          taskListId: "modeling-total",
          targetCost: "9484.00",
        },
      ],
    );

    expect(result.clientFee).toBe(53200);
    expect(result.targetCost).toBe(17084);
    expect(result.targetProfit).toBe(36116);
    expect(result.targetMarginPercent).toBeCloseTo(67.887218, 5);
  });
});

describe("calculateTaskListBudgetCoverage", () => {
  it("counts duplicate change-order budgets as one covered task list", () => {
    const result = calculateTaskListBudgetCoverage(
      [
        {
          id: "fieldwork",
          operationalGroup: "Fieldwork",
        },
      ],
      [
        {
          projectBudgetId: "original",
          taskListId: "fieldwork",
          targetCost: "10000.00",
        },
        {
          projectBudgetId: "change-order",
          taskListId: "fieldwork",
          targetCost: "3000.00",
        },
      ],
    );

    expect(result).toBe("COMPLETE");
  });

  it("does not require Admin to have a task-list budget", () => {
    const result = calculateTaskListBudgetCoverage(
      [
        {
          id: "admin",
          operationalGroup: "Admin",
        },
        {
          id: "fieldwork",
          operationalGroup: "Fieldwork",
        },
      ],
      [
        {
          projectBudgetId: "original",
          taskListId: "fieldwork",
          targetCost: "10000.00",
        },
      ],
    );

    expect(result).toBe("COMPLETE");
  });

  it("returns NOT_EXPECTED for an Admin-only project", () => {
    const result = calculateTaskListBudgetCoverage(
      [
        {
          id: "admin",
          operationalGroup: "Admin",
        },
      ],
      [],
    );

    expect(result).toBe("NOT_EXPECTED");
  });
});

describe("fixed-fee-only revenue fallback", () => {
  it("does not treat an active non-fixed-fee fallback budget as revenue", () => {
    const result = calculatePlannedFinancials(
      [
        budget({
          id: "non-fixed-fee",
          teamworkId: 999001,
          status: "ACTIVE",
          category: "TIME",
          clientFee: "99999.00",
          isCurrent: false,
        }),
      ],
      [],
    );

    expect(result.revenueBudget).toBeNull();
    expect(result.clientFee).toBeNull();
  });
});
