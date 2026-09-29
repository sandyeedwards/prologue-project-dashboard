import { describe, expect, it } from "vitest";
import {
  classifyTaskList,
  classifyTaskListFromTasks,
  isClearlyAdministrativeTaskList,
  isReadySetMobilizationTaskList,
  isTravelTask,
} from "./operational-group";

describe("classifyTaskList", () => {
  it.each([
    ["Mobilization", "Mobilization"],
    ["Mobilization - Return Trip", "Mobilization"],
    ["Travel", "Mobilization"],
    ["Fieldwork", "Fieldwork"],
    ["Field Operations - Phase 2", "Fieldwork"],
    ["Modeling - Priority 1 Areas", "Modeling"],
    ["Modelling Revisions", "Modeling"],
    ["Admin", "Admin"],
    ["Project Setup", "Admin"],
    ["OffBoarding", "Admin"],
    ["Unknown Work", "Unclassified"],
  ] as const)("maps %s to %s", (name, expected) => {
    expect(classifyTaskList(name)).toBe(expected);
  });

  it("treats non-admin Data Hall task lists as Fieldwork containers", () => {
    expect(
      classifyTaskList("DH1200", {
        isDataHall: true,
      }),
    ).toBe("Fieldwork");

    expect(
      classifyTaskList("DH1100 & DH2100", {
        isDataHall: true,
      }),
    ).toBe("Fieldwork");
  });

  it("keeps Data Hall Admin outside the area rollup", () => {
    expect(
      classifyTaskList("Admin", {
        isDataHall: true,
      }),
    ).toBe("Admin");
  });

  it("treats Ready Set Mob lists as Fieldwork containers", () => {
    expect(
      classifyTaskList("Mob 1", {
        isReadySet: true,
      }),
    ).toBe("Fieldwork");

    expect(
      classifyTaskList("Mob 23", {
        isReadySet: true,
      }),
    ).toBe("Fieldwork");
  });

  it("keeps Ready Set Project Setup as Admin", () => {
    expect(
      classifyTaskList("Project Setup", {
        isReadySet: true,
      }),
    ).toBe("Admin");
  });
});

describe("task-informed classification", () => {
  it("classifies a normal list as Modeling when its tasks contain modeling work", () => {
    expect(
      classifyTaskListFromTasks("Branch 1", [
        "Outsourced Modeling",
        "Prologue Production Modeling (log time)",
      ]),
    ).toBe("Modeling");
  });

  it("classifies a normal list as Fieldwork when its tasks contain scanning work", () => {
    expect(
      classifyTaskListFromTasks("Phase 1", ["Static Scanning Operations", "Data Processing"]),
    ).toBe("Fieldwork");
  });

  it("leaves conflicting normal task-list evidence Unclassified", () => {
    expect(
      classifyTaskListFromTasks("Phase 1", [
        "Static Scanning Operations",
        "Prologue Production Modeling (log time)",
      ]),
    ).toBe("Unclassified");
  });

  it("does not turn a Ready Set Mob into Modeling based on task contents", () => {
    expect(
      classifyTaskListFromTasks("Mob 1", ["Travel (log time)", "Static Scanning (log time)"], {
        isReadySet: true,
      }),
    ).toBe("Fieldwork");
  });
});

describe("helpers", () => {
  it.each([
    "Admin",
    "Project Setup",
    "Teamwork Setup",
    "General Project Management",
    "OffBoarding",
  ])("recognizes administrative task-list names: %s", (name) => {
    expect(isClearlyAdministrativeTaskList(name)).toBe(true);
  });

  it.each(["Mob 1", "Mob 2", "Mob 20"])("recognizes Ready Set mobilizations: %s", (name) => {
    expect(isReadySetMobilizationTaskList(name)).toBe(true);
  });

  it.each(["Travel", "Travel (log time)", "Travel - Return"])(
    "recognizes Travel tasks: %s",
    (name) => {
      expect(isTravelTask(name)).toBe(true);
    },
  );
});
