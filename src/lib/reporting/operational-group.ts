import { REPORTING_RULES, type OperationalGroup } from "@/config/reporting-rules";

function normalizedWords(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(value: string, patterns: readonly string[]): boolean {
  const normalized = normalizedWords(value);

  return patterns.some((pattern) => normalized.includes(normalizedWords(pattern)));
}

export function isClearlyAdministrativeTaskList(taskListName: string): boolean {
  return containsAny(taskListName, REPORTING_RULES.administrativeTaskListPatterns);
}

export function isReadySetMobilizationTaskList(taskListName: string): boolean {
  return /^mob\s+\d+$/i.test(taskListName.replace(/\s+/g, " ").trim());
}

export function isTravelTask(taskName: string): boolean {
  return containsAny(taskName, REPORTING_RULES.travelTaskPatterns);
}

function taskListSignalFromTasks(
  taskNames: readonly string[],
): "Fieldwork" | "Modeling" | "Unclassified" | null {
  const modeling = taskNames.some((name) =>
    containsAny(name, REPORTING_RULES.modelingTaskPatterns),
  );

  const fieldwork = taskNames.some((name) =>
    containsAny(name, REPORTING_RULES.fieldworkTaskPatterns),
  );

  // If a future Teamwork list contains strong signals for both services,
  // do not guess. Surface it as Unclassified instead.
  if (modeling && fieldwork) return "Unclassified";
  if (modeling) return "Modeling";
  if (fieldwork) return "Fieldwork";

  return null;
}

export function classifyTaskList(
  taskListName: string,
  context: {
    isDataHall?: boolean;
    isReadySet?: boolean;
  } = {},
): OperationalGroup {
  const cleanName = taskListName.replace(/\s+/g, " ").trim() || "Unnamed task list";

  if (isClearlyAdministrativeTaskList(cleanName)) {
    return "Admin";
  }

  // Ready Set Mobs and Data Hall areas are Fieldwork containers.
  // Travel is split from Fieldwork later at task level while preserving
  // the Mob/area task-list name for drill-down reporting.
  if (context.isDataHall) {
    return "Fieldwork";
  }

  if (context.isReadySet && isReadySetMobilizationTaskList(cleanName)) {
    return "Fieldwork";
  }

  const normalizedName = normalizedWords(cleanName);

  for (const [group, patterns] of Object.entries(REPORTING_RULES.operationalGroupPatterns)) {
    if (patterns.some((pattern) => normalizedName.includes(normalizedWords(pattern)))) {
      return group as OperationalGroup;
    }
  }

  return "Unclassified";
}

export function classifyTaskListFromTasks(
  taskListName: string,
  taskNames: readonly string[],
  context: {
    isDataHall?: boolean;
    isReadySet?: boolean;
  } = {},
): OperationalGroup {
  const baseGroup = classifyTaskList(taskListName, context);

  if (
    baseGroup === "Admin" ||
    context.isDataHall ||
    (context.isReadySet && isReadySetMobilizationTaskList(taskListName))
  ) {
    return baseGroup;
  }

  const taskSignal = taskListSignalFromTasks(taskNames);

  if (taskSignal) {
    return taskSignal;
  }

  return baseGroup;
}
