/**
 * Teamwork keeps `deletedAt` on a task or task list after it is restored, and
 * reports the restored record with a normal status such as "reopened". The
 * status is therefore the reliable signal; `deletedAt` is only used when
 * Teamwork sends no status at all.
 */
export function isTeamworkRecordDeleted(
  status: string | null | undefined,
  deletedAt: Date | null,
): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized) return normalized === "deleted";
  return deletedAt !== null;
}
