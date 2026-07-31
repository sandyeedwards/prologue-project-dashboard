export type AssignmentIds = {
  userIds: readonly number[];
  jobRoleIds: readonly number[];
  teamIds: readonly number[];
  companyIds: readonly number[];
};

export type ForecastAssignmentResolution = {
  source: "USER" | "JOB_ROLE" | "UNRESOLVED";
  selectedIds: number[];
  totalSelected: number;
  knownRateCount: number;
  averageRate: number | null;
  unresolvedKinds: string[];
};

export function resolveForecastAssignment(
  assignment: AssignmentIds,
  personRates: ReadonlyMap<number, number | null>,
  jobRoleRates: ReadonlyMap<number, number | null>,
): ForecastAssignmentResolution {
  const source =
    assignment.userIds.length > 0
      ? "USER"
      : assignment.jobRoleIds.length > 0
        ? "JOB_ROLE"
        : "UNRESOLVED";
  const selectedIds =
    source === "USER"
      ? [...new Set(assignment.userIds)]
      : source === "JOB_ROLE"
        ? [...new Set(assignment.jobRoleIds)]
        : [];
  const rateMap = source === "USER" ? personRates : jobRoleRates;
  const knownRates = selectedIds
    .map((id) => rateMap.get(id) ?? null)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const averageRate =
    selectedIds.length === 0
      ? null
      : knownRates.reduce((sum, value) => sum + value, 0) / selectedIds.length;
  const unresolvedKinds = [
    assignment.teamIds.length > 0 ? "TEAM" : null,
    assignment.companyIds.length > 0 ? "COMPANY" : null,
  ].filter((value): value is string => value !== null);

  return {
    source,
    selectedIds,
    totalSelected: selectedIds.length,
    knownRateCount: knownRates.length,
    averageRate,
    unresolvedKinds,
  };
}
