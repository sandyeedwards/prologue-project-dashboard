import { describe, expect, it } from "vitest";
import { latestIssuePerTask } from "./unplanned-dismissal";

describe("latestIssuePerTask", () => {
  it("keeps the first (latest-detected) issue for each task and skips issues without a task", () => {
    const issues = [
      { id: "new-a", taskId: "a", minutes: 300 },
      { id: "only-b", taskId: "b", minutes: 60 },
      { id: "old-a", taskId: "a", minutes: 120 },
      { id: "no-task", taskId: null, minutes: 30 },
    ];
    expect(latestIssuePerTask(issues).map((issue) => issue.id)).toEqual(["new-a", "only-b"]);
  });

  it("returns an empty list when nothing is open", () => {
    expect(latestIssuePerTask([])).toEqual([]);
  });
});
