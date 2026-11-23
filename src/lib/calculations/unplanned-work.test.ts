import { describe, expect, it } from "vitest";
import { identifyUnplannedTopLevelTasks, unbudgetedAdminTaskIds } from "./unplanned-work";

const tasks = [
  { id: "top-unplanned", parentTaskId: null, estimatedMinutes: 0 },
  { id: "subtask-no-estimate", parentTaskId: "parent", estimatedMinutes: 0 },
  { id: "estimated", parentTaskId: null, estimatedMinutes: 120 },
  { id: "covered", parentTaskId: null, estimatedMinutes: 0 },
];

describe("unplanned-work classification", () => {
  it("flags every top-level task with logged time and no estimate", () => {
    const result = identifyUnplannedTopLevelTasks(
      tasks,
      new Map([
        ["top-unplanned", 60],
        ["subtask-no-estimate", 45],
        ["estimated", 30],
        ["covered", 30],
      ]),
      new Set(["covered"]),
    );
    expect(result.map((task) => task.id)).toEqual(["top-unplanned"]);
  });

  it("never flags subtasks solely because they have no estimate", () => {
    const result = identifyUnplannedTopLevelTasks(
      tasks,
      new Map([["subtask-no-estimate", 240]]),
      new Set(),
    );
    expect(result).toEqual([]);
  });

  it("treats time on an unestimated subtask as planned when its top-level task is estimated", () => {
    const parent = { id: "estimated-parent", parentTaskId: null, estimatedMinutes: 480 };
    const child = { id: "unestimated-child", parentTaskId: parent.id, estimatedMinutes: 0 };
    const result = identifyUnplannedTopLevelTasks(
      [parent, child],
      new Map([[child.id, 180]]),
      new Set([parent.id, child.id]),
    );

    expect(result).toEqual([]);
  });
});

describe("unbudgetedAdminTaskIds", () => {
  const lists = [
    { id: "admin", operationalGroup: "Admin" },
    { id: "field", operationalGroup: "Fieldwork" },
  ];

  it("treats Admin with no estimates as expected time, not unplanned", () => {
    const ids = unbudgetedAdminTaskIds(
      [
        { id: "pm", taskListId: "admin", estimatedMinutes: null },
        { id: "setup", taskListId: "admin", estimatedMinutes: 0 },
        { id: "scan", taskListId: "field", estimatedMinutes: 0 },
      ],
      lists,
    );
    expect([...ids].sort()).toEqual(["pm", "setup"]);
  });

  it("judges each Admin list on its own: budgeted Project Management, $0 Admin", () => {
    const ids = unbudgetedAdminTaskIds(
      [
        { id: "pm", taskListId: "pm-list", estimatedMinutes: 600 },
        { id: "pm-other", taskListId: "pm-list", estimatedMinutes: 0 },
        { id: "admin-time", taskListId: "admin", estimatedMinutes: null },
      ],
      [...lists, { id: "pm-list", operationalGroup: "Admin" }],
    );
    expect([...ids]).toEqual(["admin-time"]);
  });

  it("reviews an Admin list like other work once one of its tasks has an estimate", () => {
    const ids = unbudgetedAdminTaskIds(
      [
        { id: "pm", taskListId: "admin", estimatedMinutes: 600 },
        { id: "setup", taskListId: "admin", estimatedMinutes: 0 },
      ],
      lists,
    );
    expect(ids.size).toBe(0);
  });
});
