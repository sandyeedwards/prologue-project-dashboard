import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  appSessions,
  appUsers,
  calculationRuns,
  dataQualityIssues,
  expenses,
  jobRoles,
  operationalGroupMetrics,
  projectBudgets,
  projectMetrics,
  projects,
  projectSnapshots,
  syncRuns,
  taskListBudgets,
  taskLists,
  taskMetrics,
  tasks,
  timeEntries,
  unplannedWorkReviews,
} from "./schema";

describe("database schema", () => {
  it("stores unusually high estimate consumption without numeric overflow", () => {
    expect(projectMetrics.estimateConsumptionPercent.getSQLType()).toBe("numeric(18, 4)");
    expect(projectSnapshots.estimateConsumptionPercent.getSQLType()).toBe("numeric(18, 4)");
  });

  it("uses stable table names for the reporting model", () => {
    expect([
      getTableName(appUsers),
      getTableName(appSessions),
      getTableName(projects),
      getTableName(taskLists),
      getTableName(tasks),
      getTableName(timeEntries),
      getTableName(projectBudgets),
      getTableName(taskListBudgets),
      getTableName(expenses),
      getTableName(jobRoles),
      getTableName(syncRuns),
      getTableName(dataQualityIssues),
      getTableName(unplannedWorkReviews),
      getTableName(projectSnapshots),
      getTableName(calculationRuns),
      getTableName(projectMetrics),
      getTableName(taskMetrics),
      getTableName(operationalGroupMetrics),
    ]).toEqual([
      "app_users",
      "app_sessions",
      "projects",
      "task_lists",
      "tasks",
      "time_entries",
      "project_budgets",
      "task_list_budgets",
      "expenses",
      "job_roles",
      "sync_runs",
      "data_quality_issues",
      "unplanned_work_reviews",
      "project_snapshots",
      "calculation_runs",
      "project_metrics",
      "task_metrics",
      "operational_group_metrics",
    ]);
  });
});
