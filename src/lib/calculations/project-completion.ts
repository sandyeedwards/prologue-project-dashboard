export function isProjectFinished(project: {
  status: string;
  archivedAt?: Date | string | null;
  completedAt?: Date | string | null;
}): boolean {
  return (
    Boolean(project.archivedAt || project.completedAt) ||
    ["closed", "complete", "completed", "archived"].includes(project.status.trim().toLowerCase())
  );
}
