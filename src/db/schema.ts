import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const dashboardRole = pgEnum("dashboard_role", ["VIEWER", "MANAGER", "ADMIN"]);
export const syncStatus = pgEnum("sync_status", [
  "RUNNING",
  "SUCCEEDED",
  "SUCCEEDED_WITH_WARNINGS",
  "FAILED",
]);
export const syncKind = pgEnum("sync_kind", ["INITIAL_IMPORT", "NIGHTLY", "MANUAL", "SNAPSHOT"]);
export const sourceKind = pgEnum("source_kind", [
  "TEAMWORK",
  "DASHBOARD_OVERRIDE",
  "DERIVED",
  "NOTEBOOK_FALLBACK",
]);
export const assignmentKind = pgEnum("assignment_kind", ["USER", "TEAM", "COMPANY", "JOB_ROLE"]);
export const financialCoverage = pgEnum("financial_coverage", [
  "COMPLETE",
  "PARTIAL",
  "MISSING",
  "NOT_EXPECTED",
]);
export const healthBand = pgEnum("health_band", ["GREEN", "AMBER", "RED", "GRAY"]);
export const issueSeverity = pgEnum("issue_severity", ["INFO", "WARNING", "ERROR"]);
export const snapshotKind = pgEnum("snapshot_kind", ["NIGHTLY", "MONTH_END", "RECONSTRUCTED"]);
export const estimateSource = pgEnum("estimate_source", ["OWN", "CHILDREN", "NONE"]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkUserId: bigint("teamwork_user_id", { mode: "number" }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: dashboardRole("role").default("VIEWER").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("app_users_email_unique").on(sql`lower(${table.email})`),
    uniqueIndex("app_users_teamwork_user_unique")
      .on(table.teamworkUserId)
      .where(sql`${table.teamworkUserId} is not null`),
  ],
);

export const appSessions = pgTable(
  "app_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_sessions_token_hash_unique").on(table.tokenHash),
    index("app_sessions_user_idx").on(table.userId),
    index("app_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    isOwnerCompany: boolean("is_owner_company").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("companies_teamwork_id_unique").on(table.teamworkId)],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    isActive: boolean("is_active").default(true).notNull(),
    isClientUser: boolean("is_client_user").default(false).notNull(),
    isServiceAccount: boolean("is_service_account").default(false).notNull(),
    isSiteAdmin: boolean("is_site_admin").default(false).notNull(),
    costRate: numeric("cost_rate", { precision: 14, scale: 4 }),
    costCurrency: text("cost_currency").default("USD"),
    costRateReturned: boolean("cost_rate_returned").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("people_teamwork_id_unique").on(table.teamworkId),
    index("people_company_idx").on(table.companyId),
  ],
);

export const jobRoles = pgTable(
  "job_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    costRate: numeric("cost_rate", { precision: 14, scale: 4 }),
    costCurrency: text("cost_currency").default("USD"),
    costRateReturned: boolean("cost_rate_returned").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("job_roles_teamwork_id_unique").on(table.teamworkId),
    index("job_roles_active_idx").on(table.isActive),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    ownerPersonId: uuid("owner_person_id").references(() => people.id),
    name: text("name").notNull(),
    projectNumber: text("project_number"),
    status: text("status").notNull(),
    projectType: text("project_type"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    excludedFromReporting: boolean("excluded_from_reporting").default(false).notNull(),
    exclusionReason: text("exclusion_reason"),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("projects_teamwork_id_unique").on(table.teamworkId),
    index("projects_company_idx").on(table.companyId),
    index("projects_status_idx").on(table.status),
    index("projects_project_number_idx").on(table.projectNumber),
    index("projects_archived_at_idx").on(table.archivedAt),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    color: text("color"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("tags_teamwork_id_unique").on(table.teamworkId),
    index("tags_normalized_name_idx").on(table.normalizedName),
  ],
);

export const projectTags = pgTable(
  "project_tags",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.tagId] })],
);

export const taskLists = pgTable(
  "task_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    isBillable: boolean("is_billable"),
    operationalGroup: text("operational_group").notNull(),
    operationalGroupSource: sourceKind("operational_group_source").default("DERIVED").notNull(),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("task_lists_teamwork_id_unique").on(table.teamworkId),
    index("task_lists_project_idx").on(table.projectId),
    index("task_lists_group_idx").on(table.operationalGroup),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskListId: uuid("task_list_id")
      .notNull()
      .references(() => taskLists.id, { onDelete: "cascade" }),
    parentTaskId: uuid("parent_task_id"),
    parentTeamworkId: bigint("parent_teamwork_id", { mode: "number" }),
    name: text("name").notNull(),
    status: text("status").notNull(),
    estimatedMinutes: integer("estimated_minutes"),
    accumulatedEstimatedMinutes: integer("accumulated_estimated_minutes"),
    progressPercent: integer("progress_percent"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    isOutsourcedCandidate: boolean("is_outsourced_candidate").default(false).notNull(),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("tasks_teamwork_id_unique").on(table.teamworkId),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_task_list_idx").on(table.taskListId),
    index("tasks_parent_teamwork_idx").on(table.parentTeamworkId),
    check(
      "tasks_estimated_minutes_nonnegative",
      sql`${table.estimatedMinutes} is null or ${table.estimatedMinutes} >= 0`,
    ),
    check(
      "tasks_progress_valid",
      sql`${table.progressPercent} is null or (${table.progressPercent} >= 0 and ${table.progressPercent} <= 100)`,
    ),
  ],
);

export const taskAssignments = pgTable(
  "task_assignments",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: assignmentKind("kind").notNull(),
    teamworkAssigneeId: bigint("teamwork_assignee_id", { mode: "number" }).notNull(),
    personId: uuid("person_id").references(() => people.id),
    label: text("label"),
    ...auditColumns,
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.kind, table.teamworkAssigneeId] }),
    index("task_assignments_person_idx").on(table.personId),
  ],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id),
    personId: uuid("person_id").references(() => people.id),
    loggedDate: date("logged_date").notNull(),
    minutes: integer("minutes").notNull(),
    isBillable: boolean("is_billable").default(false).notNull(),
    description: text("description"),
    historicalCostRate: numeric("historical_cost_rate", {
      precision: 14,
      scale: 4,
    }),
    historicalCostTotal: numeric("historical_cost_total", {
      precision: 16,
      scale: 4,
    }),
    costInfoReturned: boolean("cost_info_returned").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("time_entries_teamwork_id_unique").on(table.teamworkId),
    index("time_entries_project_date_idx").on(table.projectId, table.loggedDate),
    index("time_entries_task_idx").on(table.taskId),
    index("time_entries_person_date_idx").on(table.personId, table.loggedDate),
    check("time_entries_minutes_nonnegative", sql`${table.minutes} >= 0`),
  ],
);

export const projectBudgets = pgTable(
  "project_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    category: text("category"),
    currencyCode: text("currency_code").default("USD"),
    clientFee: numeric("client_fee", { precision: 16, scale: 2 }),
    targetCost: numeric("target_cost", { precision: 16, scale: 2 }),
    targetProfit: numeric("target_profit", { precision: 16, scale: 2 }),
    targetMarginPercent: numeric("target_margin_percent", {
      precision: 9,
      scale: 4,
    }),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    isCurrent: boolean("is_current").default(false).notNull(),
    financialDetailsHidden: boolean("financial_details_hidden").default(false).notNull(),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("project_budgets_teamwork_id_unique").on(table.teamworkId),
    index("project_budgets_project_idx").on(table.projectId),
  ],
);

export const taskListBudgets = pgTable(
  "task_list_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }),
    projectBudgetId: uuid("project_budget_id")
      .notNull()
      .references(() => projectBudgets.id, { onDelete: "cascade" }),
    taskListId: uuid("task_list_id")
      .notNull()
      .references(() => taskLists.id, { onDelete: "cascade" }),
    targetCost: numeric("target_cost", { precision: 16, scale: 2 }),
    source: sourceKind("source").default("TEAMWORK").notNull(),
    coverage: financialCoverage("coverage").default("COMPLETE").notNull(),
    overrideReason: text("override_reason"),
    overriddenByUserId: uuid("overridden_by_user_id").references(() => appUsers.id),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("task_list_budgets_period_list_unique").on(table.projectBudgetId, table.taskListId),
    uniqueIndex("task_list_budgets_teamwork_id_unique")
      .on(table.teamworkId)
      .where(sql`${table.teamworkId} is not null`),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamworkId: bigint("teamwork_id", { mode: "number" }).notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    projectBudgetId: uuid("project_budget_id").references(() => projectBudgets.id, {
      onDelete: "set null",
    }),
    taskListId: uuid("task_list_id").references(() => taskLists.id),
    operationalGroup: text("operational_group"),
    title: text("title").notNull(),
    category: text("category"),
    expenseDate: date("expense_date"),
    totalCost: numeric("total_cost", { precision: 16, scale: 2 }),
    totalBillable: numeric("total_billable", { precision: 16, scale: 2 }),
    markupPercent: numeric("markup_percent", { precision: 9, scale: 4 }),
    isOutsourcedModeling: boolean("is_outsourced_modeling").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    teamworkUpdatedAt: timestamp("teamwork_updated_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("expenses_teamwork_id_unique").on(table.teamworkId),
    index("expenses_project_date_idx").on(table.projectId, table.expenseDate),
    index("expenses_budget_idx").on(table.projectBudgetId),
  ],
);

export const operationalGroupRules = pgTable(
  "operational_group_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    priority: integer("priority").notNull(),
    pattern: text("pattern").notNull(),
    groupName: text("group_name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("operational_group_rules_priority_unique").on(table.priority)],
);

export const outsourcedTaskAliases = pgTable(
  "outsourced_task_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("outsourced_task_aliases_normalized_unique").on(table.normalizedAlias)],
);

export const outsourcedRates = pgTable(
  "outsourced_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    hourlyRate: numeric("hourly_rate", { precision: 14, scale: 4 }).notNull(),
    currencyCode: text("currency_code").default("USD").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => appUsers.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("outsourced_rates_effective_from_unique").on(table.effectiveFrom),
    check("outsourced_rates_nonnegative", sql`${table.hourlyRate} >= 0`),
  ],
);

export const projectArchiveOverrides = pgTable(
  "project_archive_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => appUsers.id),
    ...auditColumns,
  },
  (table) => [uniqueIndex("project_archive_overrides_project_unique").on(table.projectId)],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: syncKind("kind").notNull(),
    status: syncStatus("status").default("RUNNING").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    recordsRead: integer("records_read").default(0).notNull(),
    recordsCreated: integer("records_created").default(0).notNull(),
    recordsUpdated: integer("records_updated").default(0).notNull(),
    warnings: integer("warnings").default(0).notNull(),
    errors: integer("errors").default(0).notNull(),
    cursor: jsonb("cursor"),
    summary: jsonb("summary"),
    triggeredByUserId: uuid("triggered_by_user_id").references(() => appUsers.id),
  },
  (table) => [index("sync_runs_started_at_idx").on(table.startedAt)],
);

export const syncIssues = pgTable(
  "sync_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    syncRunId: uuid("sync_run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    severity: issueSeverity("severity").notNull(),
    entityType: text("entity_type"),
    teamworkEntityId: bigint("teamwork_entity_id", { mode: "number" }),
    code: text("code").notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sync_issues_run_idx").on(table.syncRunId)],
);

export const dataQualityIssues = pgTable(
  "data_quality_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskListId: uuid("task_list_id").references(() => taskLists.id),
    taskId: uuid("task_id").references(() => tasks.id),
    severity: issueSeverity("severity").notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    details: jsonb("details"),
  },
  (table) => [
    index("data_quality_project_idx").on(table.projectId),
    index("data_quality_open_idx")
      .on(table.projectId, table.code)
      .where(sql`${table.resolvedAt} is null`),
  ],
);

export const unplannedWorkReviews = pgTable(
  "unplanned_work_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dismissedByUserId: uuid("dismissed_by_user_id")
      .notNull()
      .references(() => appUsers.id),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).defaultNow().notNull(),
    dismissedLoggedMinutes: integer("dismissed_logged_minutes").default(0).notNull(),
    dismissedLaborCost: numeric("dismissed_labor_cost", { precision: 16, scale: 2 }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("unplanned_work_reviews_task_unique").on(table.taskId),
    index("unplanned_work_reviews_project_idx").on(table.projectId),
  ],
);

export const projectSnapshots = pgTable(
  "project_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    kind: snapshotKind("kind").notNull(),
    clientFee: numeric("client_fee", { precision: 16, scale: 2 }),
    targetCost: numeric("target_cost", { precision: 16, scale: 2 }),
    projectedLaborCost: numeric("projected_labor_cost", {
      precision: 16,
      scale: 2,
    }),
    projectedNonLaborCost: numeric("projected_non_labor_cost", {
      precision: 16,
      scale: 2,
    }),
    actualLaborCost: numeric("actual_labor_cost", { precision: 16, scale: 2 }),
    actualNonLaborCost: numeric("actual_non_labor_cost", {
      precision: 16,
      scale: 2,
    }),
    forecastCost: numeric("forecast_cost", { precision: 16, scale: 2 }),
    forecastProfit: numeric("forecast_profit", { precision: 16, scale: 2 }),
    forecastMarginPercent: numeric("forecast_margin_percent", {
      precision: 9,
      scale: 4,
    }),
    estimatedMinutes: integer("estimated_minutes"),
    loggedMinutes: integer("logged_minutes"),
    completedTaskCount: integer("completed_task_count"),
    totalTaskCount: integer("total_task_count"),
    estimateConsumptionPercent: numeric("estimate_consumption_percent", {
      precision: 18,
      scale: 4,
    }),
    healthScore: numeric("health_score", { precision: 6, scale: 2 }),
    healthBand: healthBand("health_band").notNull(),
    taskListBudgetCoverage: financialCoverage("task_list_budget_coverage")
      .default("MISSING")
      .notNull(),
    expenseCoverage: financialCoverage("expense_coverage").default("MISSING").notNull(),
    isProvisional: boolean("is_provisional").default(true).notNull(),
    calculationVersion: text("calculation_version").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_snapshots_unique").on(table.projectId, table.snapshotDate, table.kind),
    index("project_snapshots_date_idx").on(table.snapshotDate),
  ],
);

export const calculationRuns = pgTable(
  "calculation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: syncStatus("status").default("RUNNING").notNull(),
    calculationVersion: text("calculation_version").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    projectsRead: integer("projects_read").default(0).notNull(),
    projectsCalculated: integer("projects_calculated").default(0).notNull(),
    warnings: integer("warnings").default(0).notNull(),
    errors: integer("errors").default(0).notNull(),
    summary: jsonb("summary"),
  },
  (table) => [index("calculation_runs_started_at_idx").on(table.startedAt)],
);

export const projectMetrics = pgTable(
  "project_metrics",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    calculationRunId: uuid("calculation_run_id")
      .notNull()
      .references(() => calculationRuns.id, { onDelete: "cascade" }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
    clientFee: numeric("client_fee", { precision: 16, scale: 2 }),
    targetCost: numeric("target_cost", { precision: 16, scale: 2 }),
    targetProfit: numeric("target_profit", { precision: 16, scale: 2 }),
    targetMarginPercent: numeric("target_margin_percent", { precision: 9, scale: 4 }),
    canonicalEstimatedMinutes: integer("canonical_estimated_minutes").default(0).notNull(),
    loggedMinutes: integer("logged_minutes").default(0).notNull(),
    taskLinkedMinutes: integer("task_linked_minutes").default(0).notNull(),
    unallocatedMinutes: integer("unallocated_minutes").default(0).notNull(),
    unestimatedLoggedMinutes: integer("unestimated_logged_minutes").default(0).notNull(),
    completedTaskCount: integer("completed_task_count").default(0).notNull(),
    totalTaskCount: integer("total_task_count").default(0).notNull(),
    projectedLaborCost: numeric("projected_labor_cost", { precision: 16, scale: 2 }),
    actualLaborCost: numeric("actual_labor_cost", { precision: 16, scale: 2 }),
    remainingLaborCost: numeric("remaining_labor_cost", { precision: 16, scale: 2 }),
    projectedNonLaborCost: numeric("projected_non_labor_cost", { precision: 16, scale: 2 }),
    actualNonLaborCost: numeric("actual_non_labor_cost", { precision: 16, scale: 2 }),
    remainingNonLaborCost: numeric("remaining_non_labor_cost", { precision: 16, scale: 2 }),
    projectedTotalCost: numeric("projected_total_cost", { precision: 16, scale: 2 }),
    actualTotalCost: numeric("actual_total_cost", { precision: 16, scale: 2 }),
    forecastCost: numeric("forecast_cost", { precision: 16, scale: 2 }),
    forecastProfit: numeric("forecast_profit", { precision: 16, scale: 2 }),
    forecastMarginPercent: numeric("forecast_margin_percent", { precision: 9, scale: 4 }),
    estimateConsumptionPercent: numeric("estimate_consumption_percent", {
      precision: 18,
      scale: 4,
    }),
    progressPercent: numeric("progress_percent", { precision: 9, scale: 4 }),
    financialScore: numeric("financial_score", { precision: 6, scale: 2 }),
    scheduleScore: numeric("schedule_score", { precision: 6, scale: 2 }),
    effortScore: numeric("effort_score", { precision: 6, scale: 2 }),
    overdueScore: numeric("overdue_score", { precision: 6, scale: 2 }),
    completenessScore: numeric("completeness_score", { precision: 6, scale: 2 }),
    healthScore: numeric("health_score", { precision: 6, scale: 2 }),
    healthBand: healthBand("health_band").notNull(),
    laborCoverage: financialCoverage("labor_coverage").default("MISSING").notNull(),
    assignmentCoverage: financialCoverage("assignment_coverage").default("MISSING").notNull(),
    taskListBudgetCoverage: financialCoverage("task_list_budget_coverage")
      .default("MISSING")
      .notNull(),
    expenseCoverage: financialCoverage("expense_coverage").default("MISSING").notNull(),
    isProvisional: boolean("is_provisional").default(true).notNull(),
    details: jsonb("details"),
  },
  (table) => [
    index("project_metrics_health_idx").on(table.healthBand, table.healthScore),
    index("project_metrics_run_idx").on(table.calculationRunId),
  ],
);

export const taskMetrics = pgTable(
  "task_metrics",
  {
    taskId: uuid("task_id")
      .primaryKey()
      .references(() => tasks.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    calculationRunId: uuid("calculation_run_id")
      .notNull()
      .references(() => calculationRuns.id, { onDelete: "cascade" }),
    estimateSource: estimateSource("estimate_source").notNull(),
    ownEstimatedMinutes: integer("own_estimated_minutes").default(0).notNull(),
    countedEstimatedMinutes: integer("counted_estimated_minutes").default(0).notNull(),
    branchEstimatedMinutes: integer("branch_estimated_minutes").default(0).notNull(),
    ownLoggedMinutes: integer("own_logged_minutes").default(0).notNull(),
    branchLoggedMinutes: integer("branch_logged_minutes").default(0).notNull(),
    remainingMinutes: integer("remaining_minutes").default(0).notNull(),
    isCanonicalHolder: boolean("is_canonical_holder").default(false).notNull(),
    isBranchComplete: boolean("is_branch_complete").default(false).notNull(),
    isOutsourced: boolean("is_outsourced").default(false).notNull(),
    projectedLaborCost: numeric("projected_labor_cost", { precision: 16, scale: 2 }),
    actualLaborCost: numeric("actual_labor_cost", { precision: 16, scale: 2 }),
    remainingLaborCost: numeric("remaining_labor_cost", { precision: 16, scale: 2 }),
    projectedOutsourcedCost: numeric("projected_outsourced_cost", { precision: 16, scale: 2 }),
    assignmentCoverage: financialCoverage("assignment_coverage").default("MISSING").notNull(),
    details: jsonb("details"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("task_metrics_project_idx").on(table.projectId),
    index("task_metrics_run_idx").on(table.calculationRunId),
  ],
);

export const operationalGroupMetrics = pgTable(
  "operational_group_metrics",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    groupName: text("group_name").notNull(),
    calculationRunId: uuid("calculation_run_id")
      .notNull()
      .references(() => calculationRuns.id, { onDelete: "cascade" }),
    targetCost: numeric("target_cost", { precision: 16, scale: 2 }),
    targetCostCoverage: financialCoverage("target_cost_coverage").default("MISSING").notNull(),
    estimatedMinutes: integer("estimated_minutes").default(0).notNull(),
    loggedMinutes: integer("logged_minutes").default(0).notNull(),
    projectedLaborCost: numeric("projected_labor_cost", { precision: 16, scale: 2 }),
    actualLaborCost: numeric("actual_labor_cost", { precision: 16, scale: 2 }),
    projectedNonLaborCost: numeric("projected_non_labor_cost", { precision: 16, scale: 2 }),
    actualNonLaborCost: numeric("actual_non_labor_cost", { precision: 16, scale: 2 }),
    forecastCost: numeric("forecast_cost", { precision: 16, scale: 2 }),
    varianceToTarget: numeric("variance_to_target", { precision: 16, scale: 2 }),
    progressPercent: numeric("progress_percent", { precision: 9, scale: 4 }),
    details: jsonb("details"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.groupName] }),
    index("operational_group_metrics_run_idx").on(table.calculationRunId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => appUsers.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_log_created_at_idx").on(table.createdAt)],
);

export const teamworkConnections = pgTable(
  "teamwork_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    installationName: text("installation_name").notNull(),
    apiEndpoint: text("api_endpoint").notNull(),
    region: text("region"),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    tokenIv: text("token_iv").notNull(),
    tokenAuthTag: text("token_auth_tag").notNull(),
    connectedByTeamworkUserId: bigint("connected_by_teamwork_user_id", { mode: "number" }),
    connectedByEmail: text("connected_by_email"),
    connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("teamwork_connections_installation_unique").on(table.installationId),
    index("teamwork_connections_active_idx").on(table.isActive),
  ],
);

export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stateHash: text("state_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    purpose: text("purpose").default("CONNECTION").notNull(),
    returnTo: text("return_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("oauth_states_hash_unique").on(table.stateHash)],
);
