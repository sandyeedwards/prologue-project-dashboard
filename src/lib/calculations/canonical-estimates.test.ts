import { describe, expect, it } from "vitest";
import { calculateCanonicalTaskMetrics, rootTaskIds } from "./canonical-estimates";
import type { CalculationTaskInput } from "./types";
import { isProjectFinished } from "./project-completion";

function task(
  id: string,
  estimatedMinutes: number | null,
  parentTaskId: string | null = null,
  status = "new",
): CalculationTaskInput {
  return {
    id,
    teamworkId: Number(id.replace(/\D/g, "")) || 1,
    projectId: "project",
    taskListId: "list",
    parentTaskId,
    name: id,
    status,
    completedAt: status === "completed" ? new Date("2026-01-01") : null,
    dueDate: null,
    estimatedMinutes,
    isDeleted: false,
    raw: {},
  };
}

describe("canonical estimate hierarchy", () => {
  it("clears remaining work for finished projects without changing actual hours or estimates", () => {
    for (const project of [
      { status: "closed" },
      { status: "completed" },
      { status: "archived" },
      { status: "active", archivedAt: new Date() },
      { status: "active", completedAt: new Date() },
    ]) {
      const finished = isProjectFinished(project);
      const rows = [task("p1", 600), task("c2", 300, "p1")];
      const metrics = calculateCanonicalTaskMetrics(rows, new Map([["c2", 100]]), finished);
      expect(metrics.get("c2")).toMatchObject({
        remainingMinutes: 0,
        ownLoggedMinutes: 100,
        branchEstimatedMinutes: 300,
      });
      expect(rows[1].status).toBe("new");
    }
    expect(isProjectFinished({ status: "active" })).toBe(false);
  });
  it("uses estimated subtasks instead of the parent estimate", () => {
    const rows = [task("p1", 600), task("c2", 240, "p1"), task("c3", 180, "p1")];
    const metrics = calculateCanonicalTaskMetrics(rows, new Map());
    expect(metrics.get("p1")).toMatchObject({
      estimateSource: "CHILDREN",
      branchEstimatedMinutes: 420,
      countedEstimatedMinutes: 0,
    });
    expect(metrics.get("c2")?.countedEstimatedMinutes).toBe(240);
    expect(rootTaskIds(rows)).toEqual(["p1"]);
  });

  it("uses the parent estimate when subtasks have no estimates", () => {
    const rows = [task("p1", 600), task("c2", null, "p1")];
    const metrics = calculateCanonicalTaskMetrics(rows, new Map([["c2", 120]]));
    expect(metrics.get("p1")).toMatchObject({
      estimateSource: "OWN",
      branchEstimatedMinutes: 600,
      branchLoggedMinutes: 120,
      remainingMinutes: 480,
    });
    expect(metrics.get("c2")?.branchEstimatedMinutes).toBe(0);
  });

  it("sets remaining time to zero for a completed branch", () => {
    const rows = [task("p1", 600, null, "completed")];
    const metrics = calculateCanonicalTaskMetrics(rows, new Map([["p1", 100]]));
    expect(metrics.get("p1")?.remainingMinutes).toBe(0);
  });
});
