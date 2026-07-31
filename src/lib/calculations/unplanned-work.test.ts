import { describe, expect, it } from "vitest";
import { identifyUnplannedTopLevelTasks } from "./unplanned-work";

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
});
