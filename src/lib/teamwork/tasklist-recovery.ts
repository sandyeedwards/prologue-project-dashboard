import { idAtPaths, type TeamworkRecord } from "./fields";
import { PROJECT_ID_PATHS, TASK_LIST_ID_PATHS } from "./relationships";

export interface TaskListProjectEvidence {
  projectTeamworkId: number | null;
  taskCount: number;
  projectEvidenceCount: number;
  conflicted: boolean;
}

export function buildTaskListProjectEvidence(
  taskRows: readonly TeamworkRecord[],
): Map<number, TaskListProjectEvidence> {
  const evidence = new Map<number, TaskListProjectEvidence>();

  for (const row of taskRows) {
    const taskListTeamworkId = idAtPaths(row, TASK_LIST_ID_PATHS);
    if (taskListTeamworkId === null) continue;

    const item = evidence.get(taskListTeamworkId) ?? {
      projectTeamworkId: null,
      taskCount: 0,
      projectEvidenceCount: 0,
      conflicted: false,
    };
    item.taskCount += 1;

    const projectTeamworkId = idAtPaths(row, PROJECT_ID_PATHS);
    if (projectTeamworkId !== null) {
      item.projectEvidenceCount += 1;
      if (!item.conflicted && item.projectTeamworkId === null) {
        item.projectTeamworkId = projectTeamworkId;
      } else if (item.projectTeamworkId !== projectTeamworkId) {
        item.projectTeamworkId = null;
        item.conflicted = true;
      }
    }

    evidence.set(taskListTeamworkId, item);
  }

  return evidence;
}
