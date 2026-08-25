export const TIME_SYNC_OVERLAP_MS = 5 * 60 * 1000;

export type TeamworkTimeSyncWindow =
  | {
      mode: "FULL";
      checkpoint: null;
      updatedAfter: null;
      deletedAfter: null;
    }
  | {
      mode: "INCREMENTAL";
      checkpoint: string;
      updatedAfter: string;
      deletedAfter: string;
    };

/**
 * Builds the checkpoint used for incremental Teamwork time synchronization.
 *
 * A small overlap is deliberately applied so records edited or deleted near
 * the previous successful sync boundary are safely fetched again. Existing
 * Teamwork-ID upserts make that overlap idempotent.
 */
export function buildTeamworkTimeSyncWindow(
  lastSyncAt: Date | null | undefined,
  forceFull = false,
): TeamworkTimeSyncWindow {
  if (forceFull || !lastSyncAt || Number.isNaN(lastSyncAt.valueOf())) {
    return {
      mode: "FULL",
      checkpoint: null,
      updatedAfter: null,
      deletedAfter: null,
    };
  }

  const checkpoint = new Date(lastSyncAt.valueOf() - TIME_SYNC_OVERLAP_MS)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  return {
    mode: "INCREMENTAL",
    checkpoint,
    updatedAfter: checkpoint,
    deletedAfter: checkpoint,
  };
}

export function buildTeamworkTimeSyncPaths(
  basePath: string,
  window: TeamworkTimeSyncWindow,
): string[] {
  if (window.mode === "FULL") return [basePath];

  const separator = basePath.includes("?") ? "&" : "?";

  return [
    `${basePath}${separator}updatedAfter=${encodeURIComponent(window.updatedAfter)}`,
    `${basePath}${separator}deletedAfter=${encodeURIComponent(window.deletedAfter)}`,
  ];
}

export function buildTeamworkProjectTimePath(basePath: string, projectTeamworkId: number): string {
  const separator = basePath.includes("?") ? "&" : "?";

  return `${basePath}${separator}projectIds=${encodeURIComponent(String(projectTeamworkId))}`;
}

export function latestSuccessfulTeamworkSyncStartedAt(
  runs: readonly {
    status: string;
    startedAt: Date;
  }[],
): Date | null {
  let latest: Date | null = null;

  for (const run of runs) {
    if (run.status !== "SUCCEEDED" && run.status !== "SUCCEEDED_WITH_WARNINGS") {
      continue;
    }

    if (Number.isNaN(run.startedAt.valueOf())) continue;

    if (!latest || run.startedAt.valueOf() > latest.valueOf()) {
      latest = run.startedAt;
    }
  }

  return latest;
}
