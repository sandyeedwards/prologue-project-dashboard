import { describe, expect, it } from "vitest";
import { collectBranchUserIds, extractAssignments } from "./assignments";

describe("Teamwork assignment extraction", () => {
  it("reads numeric, string, and object user IDs without duplicates", () => {
    expect(
      extractAssignments({
        assigneeUserIds: [1, "2"],
        assigneeUsers: [{ id: 2 }, { id: "3" }],
      }).userIds,
    ).toEqual([1, 2, 3]);
  });

  it("keeps non-user assignment types separate", () => {
    const result = extractAssignments({
      assignees: [
        { id: 4, type: "teams" },
        { id: 5, type: "companies" },
        { id: 6, type: "jobRoles" },
      ],
    });
    expect(result.teamIds).toEqual([4]);
    expect(result.companyIds).toEqual([5]);
    expect(result.jobRoleIds).toEqual([6]);
  });

  it("reads job-role IDs from nested and ID-keyed Teamwork collections", () => {
    const result = extractAssignments({
      assigneeJobRoleIds: { "7": true },
      assigneeJobRoles: { "8": { id: "8" }, "9": { jobRoleId: 9 } },
    });
    expect(result.jobRoleIds).toEqual([7, 8, 9]);
  });

  it("collects unique branch users for equal allocation", () => {
    const result = collectBranchUserIds(
      "parent",
      ["child"],
      new Map([
        ["parent", { assigneeUserIds: [1] }],
        ["child", { assigneeUserIds: [1, 2] }],
      ]),
    );
    expect(result.userIds).toEqual([1, 2]);
  });
});
