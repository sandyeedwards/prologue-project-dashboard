import { describe, expect, it } from "vitest";
import { classifyTaskList, isClearlyAdministrativeTaskList } from "./operational-group";

describe("classifyTaskList", () => {
  it.each([
    ["Mobilization", "Mobilization"],
    ["Mobilization - Return Trip", "Mobilization"],
    ["Fieldwork", "Fieldwork"],
    ["Field Operations - Phase 2", "Fieldwork"],
    ["Modeling - Priority 1 Areas", "Modeling"],
    ["Modelling Revisions", "Modeling"],
    ["Admin", "Other / Unmapped"],
  ] as const)("maps %s to %s", (name, expected) => {
    expect(classifyTaskList(name)).toBe(expected);
  });

  it("treats each non-administrative DataHall task list as its own area", () => {
    expect(classifyTaskList("Building A - Level 1", { isDataHall: true })).toBe(
      "Area: Building A - Level 1",
    );
    expect(classifyTaskList("Building A - Level 2", { isDataHall: true })).toBe(
      "Area: Building A - Level 2",
    );
  });

  it.each([
    "Admin",
    "General Project Management (log time)",
    "Project Setup",
    "Adjust Start and Due Dates (Gantt)",
  ])("keeps clearly administrative DataHall lists outside the area rollup: %s", (name) => {
    expect(isClearlyAdministrativeTaskList(name)).toBe(true);
    expect(classifyTaskList(name, { isDataHall: true })).toBe("Other / Administrative");
  });
});
