import { idAtPaths, type TeamworkRecord } from "./fields";

export const ENTITY_ID_PATHS = ["id"] as const;
export const PROJECT_ID_PATHS = [
  "projectId",
  "project-id",
  "project.id",
  "project.idValue",
] as const;
export const TASK_LIST_ID_PATHS = [
  "tasklistId",
  "taskListId",
  "task-list-id",
  "todo-list-id",
  "tasklist.id",
  "taskList.id",
] as const;
export const TASK_ID_PATHS = ["taskId", "task-id", "todo-item-id", "task.id"] as const;
export const PARENT_TASK_ID_PATHS = [
  "parentTaskId",
  "parent-task-id",
  "parentTask.id",
  "parent-task.id",
] as const;
export const PERSON_ID_PATHS = [
  "userId",
  "personId",
  "user-id",
  "person-id",
  "user.id",
  "person.id",
] as const;

export interface ProjectLookupValue {
  id: string;
  teamworkId: number;
  startDate?: string | null;
  excludedFromReporting?: boolean;
}

export interface TaskListLookupValue {
  id: string;
  teamworkId: number;
  projectId: string;
  projectTeamworkId: number;
}

export interface TaskLookupValue {
  id: string;
  teamworkId: number;
  projectId: string;
  projectTeamworkId: number;
}

export interface TaskResolution {
  taskTeamworkId: number | null;
  taskListTeamworkId: number | null;
  projectTeamworkId: number | null;
  taskList: TaskListLookupValue | null;
  project: ProjectLookupValue | null;
  reason: string | null;
}

export function resolveTaskRelationships(
  row: TeamworkRecord,
  projectByTeamworkId: ReadonlyMap<number, ProjectLookupValue>,
  taskListByTeamworkId: ReadonlyMap<number, TaskListLookupValue>,
): TaskResolution {
  const taskTeamworkId = idAtPaths(row, ENTITY_ID_PATHS);
  const taskListTeamworkId = idAtPaths(row, TASK_LIST_ID_PATHS);
  const directProjectTeamworkId = idAtPaths(row, PROJECT_ID_PATHS);
  const taskList =
    taskListTeamworkId === null ? null : (taskListByTeamworkId.get(taskListTeamworkId) ?? null);
  const projectTeamworkId = directProjectTeamworkId ?? taskList?.projectTeamworkId ?? null;
  const project =
    projectTeamworkId === null ? null : (projectByTeamworkId.get(projectTeamworkId) ?? null);

  if (taskTeamworkId === null) {
    return {
      taskTeamworkId,
      taskListTeamworkId,
      projectTeamworkId,
      taskList,
      project,
      reason: "Task has no valid Teamwork ID.",
    };
  }
  if (taskListTeamworkId === null) {
    return {
      taskTeamworkId,
      taskListTeamworkId,
      projectTeamworkId,
      taskList,
      project,
      reason: "Task has no valid task-list relationship.",
    };
  }
  if (!taskList) {
    return {
      taskTeamworkId,
      taskListTeamworkId,
      projectTeamworkId,
      taskList,
      project,
      reason: `Task references task list ${taskListTeamworkId}, which was not imported.`,
    };
  }
  if (!project) {
    return {
      taskTeamworkId,
      taskListTeamworkId,
      projectTeamworkId,
      taskList,
      project,
      reason: "Task project could not be resolved directly or through its task list.",
    };
  }

  return {
    taskTeamworkId,
    taskListTeamworkId,
    projectTeamworkId,
    taskList,
    project,
    reason: null,
  };
}

export interface TimeResolution {
  timeTeamworkId: number | null;
  taskTeamworkId: number | null;
  projectTeamworkId: number | null;
  task: TaskLookupValue | null;
  project: ProjectLookupValue | null;
  reason: string | null;
}

export function resolveTimeRelationships(
  row: TeamworkRecord,
  projectByTeamworkId: ReadonlyMap<number, ProjectLookupValue>,
  taskByTeamworkId: ReadonlyMap<number, TaskLookupValue>,
): TimeResolution {
  const timeTeamworkId = idAtPaths(row, ENTITY_ID_PATHS);
  const taskTeamworkId = idAtPaths(row, TASK_ID_PATHS);
  const task = taskTeamworkId === null ? null : (taskByTeamworkId.get(taskTeamworkId) ?? null);
  const directProjectTeamworkId = idAtPaths(row, PROJECT_ID_PATHS);
  const projectTeamworkId = directProjectTeamworkId ?? task?.projectTeamworkId ?? null;
  const project =
    projectTeamworkId === null ? null : (projectByTeamworkId.get(projectTeamworkId) ?? null);

  if (timeTeamworkId === null) {
    return {
      timeTeamworkId,
      taskTeamworkId,
      projectTeamworkId,
      task,
      project,
      reason: "Time entry has no valid Teamwork ID.",
    };
  }
  if (!project) {
    return {
      timeTeamworkId,
      taskTeamworkId,
      projectTeamworkId,
      task,
      project,
      reason: "Time-entry project could not be resolved directly or through its task.",
    };
  }

  return {
    timeTeamworkId,
    taskTeamworkId,
    projectTeamworkId,
    task,
    project,
    reason: null,
  };
}
