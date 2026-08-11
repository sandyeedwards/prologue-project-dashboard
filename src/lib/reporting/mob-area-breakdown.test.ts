import { describe, expect, it } from "vitest";
import { buildMobAreaBreakdown } from "@/lib/reporting/mob-area-breakdown";

type TestTask = Parameters<typeof buildMobAreaBreakdown>[0]["tasks"][number];

type TestExpense = Parameters<typeof buildMobAreaBreakdown>[0]["expenses"][number];

function task(overrides: Partial<TestTask> = {}): TestTask {
  return {
    name: "Static Scanning (log time)",
    taskListName: "Mob 1",
    operationalGroup: "Fieldwork",
    countedEstimatedMinutes: 120,
    branchLoggedMinutes: 60,
    remainingMinutes: 60,
    projectedLaborCost: "20",
    actualLaborCost: "10",
    remainingLaborCost: "10",
    ...overrides,
  };
}

function expense(overrides: Partial<TestExpense> = {}): TestExpense {
  return {
    taskListName: "Mob 1",
    operationalGroup: "Fieldwork",
    totalCost: "5",
    ...overrides,
  };
}

describe("Mob / Area breakdown", () => {
  it("keeps Ready Set mobilizations in natural numeric order", () => {
    const rows = buildMobAreaBreakdown({
      kind: "READY_SET",
      tasks: [
        task({ taskListName: "Mob 10" }),
        task({ taskListName: "Mob 2" }),
        task({
          taskListName: "Project Setup",
          operationalGroup: "Admin",
        }),
        task({ taskListName: "Fieldwork" }),
      ],
      expenses: [],
    });

    expect(rows.map((row) => row.name)).toEqual(["Mob 2", "Mob 10"]);
  });

  it("preserves Data Hall area names", () => {
    const rows = buildMobAreaBreakdown({
      kind: "DATA_HALL",
      tasks: [
        task({ taskListName: "DH1300" }),
        task({ taskListName: "DH1200" }),
        task({
          taskListName: "Admin",
          operationalGroup: "Admin",
        }),
      ],
      expenses: [],
    });

    expect(rows.map((row) => row.name)).toEqual(["DH1200", "DH1300"]);
  });

  it("splits Travel from other Fieldwork without assigning task-list expenses to Travel", () => {
    const rows = buildMobAreaBreakdown({
      kind: "READY_SET",
      tasks: [
        task({
          name: "Travel (log time)",
          taskListName: "Mob 1",
          actualLaborCost: "10",
          projectedLaborCost: "15",
        }),
        task({
          name: "Data Processing",
          taskListName: "Mob 1",
          actualLaborCost: "20",
          projectedLaborCost: "30",
        }),
      ],
      expenses: [
        expense({
          taskListName: "Mob 1",
          totalCost: "5",
        }),
      ],
    });

    expect(rows).toHaveLength(1);

    const row = rows[0];

    expect(row?.travel.actualLaborCost).toBe("10");
    expect(row?.otherFieldwork.actualLaborCost).toBe("20");
    expect(row?.actualExpenseCost).toBe("5");
    expect(row?.actualTotalCost).toBe("35");
  });

  it("keeps incomplete task cost rollups incomplete instead of silently summing partial cost", () => {
    const rows = buildMobAreaBreakdown({
      kind: "DATA_HALL",
      tasks: [
        task({
          taskListName: "DH1200",
          actualLaborCost: "10",
        }),
        task({
          taskListName: "DH1200",
          actualLaborCost: null,
        }),
      ],
      expenses: [],
    });

    expect(rows[0]?.actualLaborCost).toBeNull();
    expect(rows[0]?.actualTotalCost).toBeNull();
  });
});
