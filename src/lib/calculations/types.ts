export type Coverage = "COMPLETE" | "PARTIAL" | "MISSING" | "NOT_EXPECTED";
export type HealthBand = "GREEN" | "AMBER" | "RED" | "GRAY";
export type EstimateSource = "OWN" | "CHILDREN" | "NONE";

export interface CalculationTaskInput {
  id: string;
  teamworkId: number;
  projectId: string;
  taskListId: string;
  parentTaskId: string | null;
  name: string;
  status: string;
  completedAt: Date | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  isDeleted: boolean;
  raw: unknown;
}

export interface CanonicalTaskMetric {
  taskId: string;
  estimateSource: EstimateSource;
  ownEstimatedMinutes: number;
  countedEstimatedMinutes: number;
  branchEstimatedMinutes: number;
  ownLoggedMinutes: number;
  branchLoggedMinutes: number;
  remainingMinutes: number;
  isCanonicalHolder: boolean;
  isBranchComplete: boolean;
  descendantTaskIds: string[];
}

export interface HealthInput {
  clientFee: number | null;
  targetMarginPercent: number | null;
  forecastMarginPercent: number | null;
  startDate: string | null;
  endDate: string | null;
  progressPercent: number;
  estimateConsumptionPercent: number | null;
  incompleteTaskCount: number;
  overdueIncompleteTaskCount: number;
  completenessScore: number;
  asOfDate: Date;
}

export interface HealthResult {
  financialScore: number | null;
  scheduleScore: number | null;
  effortScore: number | null;
  overdueScore: number | null;
  completenessScore: number;
  healthScore: number | null;
  healthBand: HealthBand;
  overrides: string[];
}
