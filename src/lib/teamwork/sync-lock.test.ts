import { describe, expect, it } from "vitest";
import { isTeamworkSyncRunningConstraintError, TeamworkSyncAlreadyRunningError } from "./sync";

describe("Teamwork sync overlap protection", () => {
  it("recognizes the single-running-sync unique index violation", () => {
    expect(
      isTeamworkSyncRunningConstraintError({
        code: "23505",
        constraint_name: "sync_runs_single_running_unique",
      }),
    ).toBe(true);
  });

  it("ignores unrelated database errors", () => {
    expect(
      isTeamworkSyncRunningConstraintError({
        code: "23505",
        constraint_name: "another_unique_index",
      }),
    ).toBe(false);

    expect(
      isTeamworkSyncRunningConstraintError({
        code: "40001",
        constraint_name: "sync_runs_single_running_unique",
      }),
    ).toBe(false);
  });

  it("provides a stable overlap error", () => {
    const error = new TeamworkSyncAlreadyRunningError();

    expect(error.name).toBe("TeamworkSyncAlreadyRunningError");
    expect(error.message).toBe("A Teamwork synchronization is already running.");
  });
});
