import { describe, expect, it } from "vitest";
import { resolveTaskRelationships, resolveTimeRelationships } from "./relationships";

const projects = new Map([
  [1226371, { id: "project-db-id", teamworkId: 1226371 }],
]);
const taskLists = new Map([
  [3765749, { id: "list-db-id", teamworkId: 3765749, projectId: "project-db-id", projectTeamworkId: 1226371 }],
]);
const tasks = new Map([
  [42254221, { id: "task-db-id", teamworkId: 42254221, projectId: "project-db-id", projectTeamworkId: 1226371 }],
]);

describe("resolveTaskRelationships", () => {
  it("uses direct scalar relationships", () => {
    const result = resolveTaskRelationships(
      { id: 42254221, projectId: 1226371, tasklistId: 3765749 },
      projects,
      taskLists,
    );
    expect(result.reason).toBeNull();
    expect(result.project?.id).toBe("project-db-id");
    expect(result.taskList?.id).toBe("list-db-id");
  });

  it("accepts nested Teamwork relationship objects", () => {
    const result = resolveTaskRelationships(
      { id: "42254221", project: { id: "1226371" }, tasklist: { id: "3765749" } },
      projects,
      taskLists,
    );
    expect(result.reason).toBeNull();
  });

  it("infers the project from the imported task list", () => {
    const result = resolveTaskRelationships(
      { id: 42254221, tasklist: { id: 3765749 } },
      projects,
      taskLists,
    );
    expect(result.reason).toBeNull();
    expect(result.projectTeamworkId).toBe(1226371);
  });
});

describe("resolveTimeRelationships", () => {
  it("infers a missing project through the task relationship", () => {
    const result = resolveTimeRelationships(
      { id: 9001, task: { id: 42254221 } },
      projects,
      tasks,
    );
    expect(result.reason).toBeNull();
    expect(result.projectTeamworkId).toBe(1226371);
  });
});
