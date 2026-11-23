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

/**
 * Ready Set mobilization lists: "Mob 3", and the names used since Nov 2026 such as
 * "Mob 1 – Level 1 SOG" or "Mob 10 SOG Pour 6 (11-19-26)".
 */
export function isReadySetMobilizationTaskList(taskListName: string): boolean {
  return /^mob\s*\d+(?!\d)(?![a-z])/i.test(taskListName.replace(/\s+/g, " ").trim());
}

/**
 * Lists the estimating app names "Modeling", "Modeling - <group>" (including
 * "Modeling - Project Setup & Sheeting") are modeling work, even when the group name contains
 * an admin phrase such as "project setup".
 */
export function isNamedModelingTaskList(taskListName: string): boolean {
  return /^model(l)?ing(?![a-z0-9])/.test(normalizedWords(taskListName));
}

/**
 * Ready Set and Data Hall projects have no Admin: their Admin, Project Setup and "Project
 * Management" lists are project management, counted as Fieldwork (never a mobilization or an
 * area), so they carry no Admin cost or budget. ("Model Setup" stays Modeling.)
 */
export function isSpecialProjectManagementTaskList(
  taskListName: string,
  context: { isDataHall?: boolean; isReadySet?: boolean } = {},
): boolean {
  if (!context.isReadySet && !context.isDataHall) return false;
  if (isReadySetModelSetupTaskList(taskListName) || isNamedModelingTaskList(taskListName))
    return false;
  return (
    normalizedWords(taskListName) === "project management" ||
    isClearlyAdministrativeTaskList(taskListName)
  );
}

function isReadySetModelSetupTaskList(taskListName: string): boolean {
  return normalizedWords(taskListName) === "model setup";
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

  if ((context.isReadySet || context.isDataHall) && isReadySetModelSetupTaskList(cleanName)) {
    return "Modeling";
  }

  if (isNamedModelingTaskList(cleanName)) {
    return "Modeling";
  }

  if (isSpecialProjectManagementTaskList(cleanName, context)) {
    return "Fieldwork";
  }

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
    (baseGroup === "Modeling" && isNamedModelingTaskList(taskListName)) ||
    isSpecialProjectManagementTaskList(taskListName, context) ||
    context.isDataHall ||
    (context.isReadySet &&
      (isReadySetMobilizationTaskList(taskListName) || isReadySetModelSetupTaskList(taskListName)))
  ) {
    return baseGroup;
  }

  const taskSignal = taskListSignalFromTasks(taskNames);

  if (taskSignal) {
    return taskSignal;
  }

  return baseGroup;
}
