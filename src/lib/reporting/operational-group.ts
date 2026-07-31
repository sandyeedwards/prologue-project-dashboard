import { REPORTING_RULES, type OperationalGroup } from "@/config/reporting-rules";

function normalizedWords(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isClearlyAdministrativeTaskList(taskListName: string): boolean {
  const normalizedName = normalizedWords(taskListName);
  return REPORTING_RULES.dataHallAdministrativeTaskListPatterns.some((pattern) =>
    normalizedName.includes(normalizedWords(pattern)),
  );
}

export function classifyTaskList(
  taskListName: string,
  context: { isDataHall?: boolean } = {},
): OperationalGroup {
  const cleanName = taskListName.replace(/\s+/g, " ").trim() || "Unnamed area";

  if (context.isDataHall) {
    return isClearlyAdministrativeTaskList(cleanName)
      ? "Other / Administrative"
      : `Area: ${cleanName}`;
  }

  const normalizedName = normalizedWords(cleanName);
  for (const [group, patterns] of Object.entries(REPORTING_RULES.operationalGroupPatterns)) {
    if (patterns.some((pattern) => normalizedName.includes(normalizedWords(pattern)))) {
      return group as OperationalGroup;
    }
  }

  return "Other / Unmapped";
}
