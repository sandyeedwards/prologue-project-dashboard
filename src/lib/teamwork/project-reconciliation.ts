export function missingTeamworkProjectIds(
  existingProjectIds: Iterable<number>,
  returnedProjectIds: ReadonlySet<number>,
): number[] {
  return [...existingProjectIds]
    .filter((teamworkId) => !returnedProjectIds.has(teamworkId))
    .sort((left, right) => left - right);
}

export function isCompleteSinglePageProjectFetch(returnedCount: number, pageSize: number): boolean {
  return (
    Number.isInteger(returnedCount) &&
    returnedCount >= 0 &&
    Number.isInteger(pageSize) &&
    pageSize > 0 &&
    returnedCount < pageSize
  );
}
