export const REPORTING_RULES = {
  calculationPilotProjectNumber: "26-101",
  excludedProjectTags: ["NoReport"],
  dataHallProjectTag: "DataHall",
  readySetProjectTag: "Ready Set",
  projectTypeTags: {
    scanning: "Scanning",
    modeling: "Modeling",
  },
  outsourcedModelingHourlyRateUsd: 15,
  outsourcedTaskAliases: ["Outsourced Modeling", "Cosmere Modeling"],
  operationalGroupPatterns: {
    Mobilization: ["mobilization"],
    Fieldwork: ["fieldwork", "field work", "field ops", "field operations"],
    Modeling: ["modeling", "modelling"],
  },
  dataHallAdministrativeTaskListPatterns: [
    "admin",
    "administration",
    "project setup",
    "project management",
    "general project management",
    "office time",
    "internal",
    "billing",
    "invoice",
    "invoicing",
    "quality control",
    "qa qc",
    "schedule",
    "gantt",
    "assign tasks",
    "add hours estimates",
    "link project",
    "purge unneeded tasks",
    "update milestones",
    "payapp",
  ],
} as const;

export type StandardOperationalGroup =
  keyof typeof REPORTING_RULES.operationalGroupPatterns | "Other / Unmapped";

export type OperationalGroup =
  StandardOperationalGroup | "Other / Administrative" | `Area: ${string}`;
