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

  it("counts Data Hall Admin as project management in Fieldwork, not Admin", () => {
    expect(
      classifyTaskList("Admin", {
        isDataHall: true,
      }),
    ).toBe("Fieldwork");
    expect(classifyTaskList("Model Setup", { isDataHall: true })).toBe("Modeling");
    expect(classifyTaskList("Modeling - Level 1", { isDataHall: true })).toBe("Modeling");
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

  it("counts Ready Set Admin and Project Setup as project management in Fieldwork", () => {
    expect(classifyTaskList("Project Setup", { isReadySet: true })).toBe("Fieldwork");
    expect(classifyTaskList("Admin", { isReadySet: true })).toBe("Fieldwork");
    expect(
      classifyTaskListFromTasks("Admin", ["Project Management (log time)"], { isReadySet: true }),
    ).toBe("Fieldwork");
  });

  it("treats Ready Set Model Setup as Modeling", () => {
    expect(
      classifyTaskList("Model Setup", {
        isReadySet: true,
      }),
    ).toBe("Modeling");
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

  it("keeps Ready Set Model Setup in Modeling despite task-name noise", () => {
    expect(
      classifyTaskListFromTasks("Model Setup", ["Static Scanning Operations"], {
        isReadySet: true,
      }),
    ).toBe("Modeling");
  });
});

describe("helpers", () => {
  it.each([
    "Admin",
    "Project Setup",
    "Model Setup",
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

describe("estimating app task-list names", () => {
  it.each([
    "Modeling - Project Setup & Sheeting",
    "Modeling - Level 1",
    "Modeling - Base Scope",
    "Modeling - Main House (Option A)",
    "Modeling",
  ])("files %s under Modeling, even with an admin phrase in the name", (name) => {
    expect(classifyTaskList(name)).toBe("Modeling");
    expect(
      classifyTaskListFromTasks(name, ["Prologue Model Management & Production (log time)"]),
    ).toBe("Modeling");
  });

  it("keeps Admin, Project Management and template Model Setup where they were", () => {
    expect(classifyTaskList("Admin")).toBe("Admin");
    expect(classifyTaskList("Project Management")).toBe("Admin");
    expect(classifyTaskList("Model Setup")).toBe("Admin");
    expect(classifyTaskList("Model Setup", { isReadySet: true })).toBe("Modeling");
  });

  it.each(["Mob 1 – Level 1 SOG", "Mob 10 SOG Pour 6 (11-19-26)", "Mob 3", "MOB 2 (trip 1 of 2)"])(
    "recognizes Ready Set mobilization list %s",
    (name) => {
      expect(isReadySetMobilizationTaskList(name)).toBe(true);
      expect(classifyTaskList(name, { isReadySet: true })).toBe("Fieldwork");
    },
  );

  it.each(["Mobilization", "Mobile Scanning", "Mob10x", "Mob 1a"])(
    "does not treat %s as a Mob list",
    (name) => {
      expect(isReadySetMobilizationTaskList(name)).toBe(false);
    },
  );
});

describe("Ready Set Project Management", () => {
  it("is budgeted delivery work: Fieldwork, not Admin and not a mobilization", () => {
    expect(classifyTaskList("Project Management", { isReadySet: true })).toBe("Fieldwork");
    expect(
      classifyTaskListFromTasks(
        "Project Management",
        ["Revit Project Setup (log time to task)", "Project Management (log time)"],
        { isReadySet: true },
      ),
    ).toBe("Fieldwork");
    expect(isReadySetMobilizationTaskList("Project Management")).toBe(false);
  });
});
