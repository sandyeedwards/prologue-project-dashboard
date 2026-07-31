import { describe, expect, it } from "vitest";
import { buildTaskListProjectEvidence } from "./tasklist-recovery";

describe("buildTaskListProjectEvidence", () => {
  it("recovers a task-list project from task rows", () => {
    const evidence = buildTaskListProjectEvidence([
      { id: 1, taskListId: 100, projectId: 200 },
      { id: 2, tasklistId: 100, project: { id: 200 } },
    ]);

    expect(evidence.get(100)).toEqual({
      projectTeamworkId: 200,
      taskCount: 2,
      projectEvidenceCount: 2,
      conflicted: false,
    });
  });

  it("marks conflicting project evidence as unresolved", () => {
    const evidence = buildTaskListProjectEvidence([
      { id: 1, taskListId: 100, projectId: 200 },
      { id: 2, taskListId: 100, projectId: 201 },
    ]);

    expect(evidence.get(100)).toEqual({
      projectTeamworkId: null,
      taskCount: 2,
      projectEvidenceCount: 2,
      conflicted: true,
    });
  });

  it("retains task-list references that have no direct project evidence", () => {
    const evidence = buildTaskListProjectEvidence([
      { id: 1, taskListId: 100 },
      { id: 2, taskListId: 100 },
      { id: 3, projectId: 200 },
    ]);

    expect(evidence.get(100)).toEqual({
      projectTeamworkId: null,
      taskCount: 2,
      projectEvidenceCount: 0,
      conflicted: false,
    });
    expect(evidence.size).toBe(1);
  });
});
