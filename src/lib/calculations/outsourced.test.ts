import { describe, expect, it } from "vitest";
import type { CanonicalTaskMetric } from "./types";
import { createOutsourcedBranchResolver, sumInternalCanonicalEstimatedMinutes } from "./outsourced";

describe("outsourced modeling hierarchy", () => {
  it("treats an estimated child under an outsourced parent as outsourced", () => {
    const resolve = createOutsourcedBranchResolver(
      [
        { id: "parent", parentTaskId: null, name: "Cosmere Modeling" },
        { id: "child", parentTaskId: "parent", name: "Guest room models" },
      ],
      (name) => name.toLowerCase().includes("cosmere modeling"),
    );

    expect(resolve("parent")).toBe(true);
    expect(resolve("child")).toBe(true);
  });

  it("does not cross into unrelated branches", () => {
    const resolve = createOutsourcedBranchResolver(
      [
        { id: "parent", parentTaskId: null, name: "Modeling" },
        { id: "child", parentTaskId: "parent", name: "In-house drafting" },
      ],
      (name) => name.toLowerCase().includes("cosmere modeling"),
    );

    expect(resolve("child")).toBe(false);
  });

  it("excludes outsourced estimates from internal effort totals", () => {
    const resolve = createOutsourcedBranchResolver(
      [
        { id: "internal", parentTaskId: null, name: "Prologue Production Modeling" },
        { id: "vendor", parentTaskId: null, name: "Cosmere Modeling" },
      ],
      (name) => name.toLowerCase().includes("cosmere modeling"),
    );

    const metrics = new Map<string, CanonicalTaskMetric>([
      [
        "internal",
        {
          taskId: "internal",
          estimateSource: "OWN",
          ownEstimatedMinutes: 600,
          countedEstimatedMinutes: 600,
          branchEstimatedMinutes: 600,
          ownLoggedMinutes: 0,
          branchLoggedMinutes: 0,
          remainingMinutes: 600,
          isCanonicalHolder: true,
          isBranchComplete: false,
          descendantTaskIds: [],
        },
      ],
      [
        "vendor",
        {
          taskId: "vendor",
          estimateSource: "OWN",
          ownEstimatedMinutes: 6000,
          countedEstimatedMinutes: 6000,
          branchEstimatedMinutes: 6000,
          ownLoggedMinutes: 0,
          branchLoggedMinutes: 0,
          remainingMinutes: 6000,
          isCanonicalHolder: true,
          isBranchComplete: false,
          descendantTaskIds: [],
        },
      ],
    ]);

    expect(sumInternalCanonicalEstimatedMinutes(["internal", "vendor"], metrics, resolve)).toBe(
      600,
    );

    expect(metrics.get("vendor")?.countedEstimatedMinutes).toBe(6000);
    expect(metrics.get("vendor")?.remainingMinutes).toBe(6000);
  });
});
