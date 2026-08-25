export const REPORTING_RULES = {
  calculationPilotProjectNumber: "26-101",
  excludedProjectTags: ["NoReport"],
  dataHallProjectTag: "DataHall",
  readySetProjectTag: "Ready Set",
  timeReportingProjectName: "Internal Operations",

  projectTypeTags: {
    scanning: "Scanning",
    modeling: "Modeling",
  },

  outsourcedModelingHourlyRateUsd: 15,
  outsourcedTaskAliases: ["Outsourced Modeling", "Cosmere Modeling"],

  operationalGroupPatterns: {
    Mobilization: ["mobilization", "travel"],
    Fieldwork: [
      "fieldwork",
      "field work",
      "field ops",
      "field operations",
      "scanning",
      "field services",
      "total station",
      "data processing",
    ],
    Modeling: ["modeling", "modelling"],
  },

  administrativeTaskListPatterns: [
    "admin",
    "administration",
    "project setup",
    "teamwork setup",
    "project management",
    "general project management",
    "offboarding",
  ],

  modelingTaskPatterns: ["model", "modeling", "modelling"],

  fieldworkTaskPatterns: [
    "scanning",
    "field services",
    "field service",
    "total station",
    "data processing",
  ],

  travelTaskPatterns: ["travel"],
} as const;

export type StandardOperationalGroup =
  keyof typeof REPORTING_RULES.operationalGroupPatterns | "Admin" | "Unclassified";

export type OperationalGroup = StandardOperationalGroup;
