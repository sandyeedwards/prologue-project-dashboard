import { describe, expect, it } from "vitest";
import {
  buildTeamworkProjectTimePath,
  buildTeamworkTimeSyncPaths,
  buildTeamworkTimeSyncWindow,
  latestSuccessfulTeamworkSyncStartedAt,
  TIME_SYNC_OVERLAP_MS,
} from "./time-sync-window";

describe("buildTeamworkTimeSyncWindow", () => {
  it("uses a full sync when no previous successful sync exists", () => {
    expect(buildTeamworkTimeSyncWindow(null)).toEqual({
      mode: "FULL",
      checkpoint: null,
      updatedAfter: null,
      deletedAfter: null,
    });
  });

  it("forces a full sync for an initial import even when a checkpoint exists", () => {
    const lastSyncAt = new Date("2026-08-21T17:30:00.000Z");

    expect(buildTeamworkTimeSyncWindow(lastSyncAt, true).mode).toBe("FULL");
  });

  it("applies a five-minute overlap to incremental synchronization", () => {
    const lastSyncAt = new Date("2026-08-21T17:30:00.000Z");
    const result = buildTeamworkTimeSyncWindow(lastSyncAt);

    expect(TIME_SYNC_OVERLAP_MS).toBe(5 * 60 * 1000);
    expect(result).toEqual({
      mode: "INCREMENTAL",
      checkpoint: "2026-08-21T17:25:00Z",
      updatedAfter: "2026-08-21T17:25:00Z",
      deletedAfter: "2026-08-21T17:25:00Z",
    });
  });

  it("falls back to a full sync for an invalid checkpoint", () => {
    expect(buildTeamworkTimeSyncWindow(new Date("invalid")).mode).toBe("FULL");
  });

  it("does not mutate the stored last-sync timestamp", () => {
    const lastSyncAt = new Date("2026-08-21T17:30:00.000Z");
    const original = lastSyncAt.valueOf();

    buildTeamworkTimeSyncWindow(lastSyncAt);

    expect(lastSyncAt.valueOf()).toBe(original);
  });

  it("uses one unfiltered request for a full synchronization", () => {
    const window = buildTeamworkTimeSyncWindow(null);

    expect(
      buildTeamworkTimeSyncPaths("/projects/api/v3/time.json?showDeleted=true", window),
    ).toEqual(["/projects/api/v3/time.json?showDeleted=true"]);
  });

  it("uses separate updated and deleted requests for an incremental synchronization", () => {
    const window = buildTeamworkTimeSyncWindow(new Date("2026-08-21T17:30:00.000Z"));

    const paths = buildTeamworkTimeSyncPaths("/projects/api/v3/time.json?showDeleted=true", window);

    expect(paths).toEqual([
      "/projects/api/v3/time.json?showDeleted=true&updatedAfter=2026-08-21T17%3A25%3A00Z",
      "/projects/api/v3/time.json?showDeleted=true&deletedAfter=2026-08-21T17%3A25%3A00Z",
    ]);

    expect(
      paths.every((path) => !(path.includes("updatedAfter=") && path.includes("deletedAfter="))),
    ).toBe(true);
  });

  it("scopes a full reconciliation request to the configured Teamwork project", () => {
    expect(
      buildTeamworkProjectTimePath("/projects/api/v3/time.json?showDeleted=true", 1163244),
    ).toBe("/projects/api/v3/time.json?showDeleted=true&projectIds=1163244");
  });

  it("selects the latest prior successful synchronization start", () => {
    expect(
      latestSuccessfulTeamworkSyncStartedAt([
        {
          status: "SUCCEEDED",
          startedAt: new Date("2026-08-20T12:00:00.000Z"),
        },
        {
          status: "FAILED",
          startedAt: new Date("2026-08-24T15:00:00.000Z"),
        },
        {
          status: "SUCCEEDED_WITH_WARNINGS",
          startedAt: new Date("2026-08-24T13:00:00.000Z"),
        },
        {
          status: "RUNNING",
          startedAt: new Date("2026-08-24T16:00:00.000Z"),
        },
      ]),
    ).toEqual(new Date("2026-08-24T13:00:00.000Z"));
  });

  it("returns null when no successful synchronization run exists", () => {
    expect(
      latestSuccessfulTeamworkSyncStartedAt([
        {
          status: "FAILED",
          startedAt: new Date("2026-08-24T13:00:00.000Z"),
        },
        {
          status: "RUNNING",
          startedAt: new Date("2026-08-24T14:00:00.000Z"),
        },
      ]),
    ).toBeNull();
  });
});
