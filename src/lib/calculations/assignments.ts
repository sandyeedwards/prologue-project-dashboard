interface AssignmentSummary {
  userIds: number[];
  teamIds: number[];
  companyIds: number[];
  jobRoleIds: number[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function positiveId(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function idsFrom(value: unknown): number[] {
  const direct = positiveId(value);
  if (direct !== null) return [direct];

  if (Array.isArray(value)) return value.flatMap(idsFrom);

  const source = record(value);
  if (!source) return [];
  const nested = positiveId(
    source.id ??
      source.userId ??
      source.personId ??
      source.teamId ??
      source.companyId ??
      source.jobRoleId ??
      source.roleId,
  );
  if (nested !== null) return [nested];

  return Object.entries(source).flatMap(([key, item]) => {
    const itemIds = idsFrom(item);
    if (itemIds.length > 0) return itemIds;
    const keyedId = positiveId(key);
    return keyedId !== null && (item === true || record(item) !== null) ? [keyedId] : [];
  });
}

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

export function extractAssignments(raw: unknown): AssignmentSummary {
  const source = record(raw) ?? {};
  const userIds = [...idsFrom(source.assigneeUserIds), ...idsFrom(source.assigneeUsers)];
  const teamIds = [...idsFrom(source.assigneeTeamIds), ...idsFrom(source.assigneeTeams)];
  const companyIds = [...idsFrom(source.assigneeCompanyIds), ...idsFrom(source.assigneeCompanies)];
  const jobRoleIds = [...idsFrom(source.assigneeJobRoleIds), ...idsFrom(source.assigneeJobRoles)];

  if (Array.isArray(source.assignees)) {
    for (const item of source.assignees) {
      const itemRecord = record(item);
      if (!itemRecord) continue;
      const id = positiveId(itemRecord.id);
      const type = String(itemRecord.type ?? "").toLowerCase();
      if (id === null) continue;
      if (type.includes("team")) teamIds.push(id);
      else if (type.includes("compan")) companyIds.push(id);
      else if (type.includes("role")) jobRoleIds.push(id);
      else userIds.push(id);
    }
  }

  return {
    userIds: unique(userIds),
    teamIds: unique(teamIds),
    companyIds: unique(companyIds),
    jobRoleIds: unique(jobRoleIds),
  };
}

export function collectBranchUserIds(
  taskId: string,
  descendantTaskIds: readonly string[],
  rawByTaskId: ReadonlyMap<string, unknown>,
): AssignmentSummary {
  const summaries = [taskId, ...descendantTaskIds].map((id) =>
    extractAssignments(rawByTaskId.get(id)),
  );
  return {
    userIds: unique(summaries.flatMap((item) => item.userIds)),
    teamIds: unique(summaries.flatMap((item) => item.teamIds)),
    companyIds: unique(summaries.flatMap((item) => item.companyIds)),
    jobRoleIds: unique(summaries.flatMap((item) => item.jobRoleIds)),
  };
}
