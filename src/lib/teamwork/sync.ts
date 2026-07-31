import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "@/db/client";
import {
  companies,
  jobRoles,
  people,
  projects,
  projectTags,
  syncIssues,
  syncRuns,
  tags,
  taskLists,
  tasks,
  teamworkConnections,
  timeEntries,
} from "@/db/schema";
import { classifyTaskList } from "@/lib/reporting/operational-group";
import { parseProjectNumber } from "@/lib/reporting/project-number";
import { activeConnection, teamworkFetch } from "./client";
import { collectionRows } from "./collections";
import {
  booleanAtPaths,
  firstValue,
  idAtPaths,
  numberAtPaths,
  textAtPaths,
  type TeamworkRecord,
} from "./fields";
import { teamworkNumericId } from "./id";
import { parseJobRoleCostRate } from "./job-role-rates";
import { teamworkDateText } from "./date";
import { normalizeTeamworkLabel, teamworkLabelText } from "./normalize";
import { projectReportingPolicy } from "./project-inclusion";
import { buildTaskListProjectEvidence } from "./tasklist-recovery";
import {
  ENTITY_ID_PATHS,
  PARENT_TASK_ID_PATHS,
  PERSON_ID_PATHS,
  PROJECT_ID_PATHS,
  resolveTaskRelationships,
  resolveTimeRelationships,
  type ProjectLookupValue,
  type TaskListLookupValue,
  type TaskLookupValue,
} from "./relationships";

const MAX_PAGES = 100;
const MAX_SAVED_ISSUES_PER_CODE = 10;

type SyncKind = "INITIAL_IMPORT" | "NIGHTLY" | "MANUAL";
type DatasetName =
  | "companies"
  | "tags"
  | "projects"
  | "people"
  | "jobRoles"
  | "taskLists"
  | "tasks"
  | "timeEntries";

interface DatasetStats {
  read: number;
  created: number;
  updated: number;
  skipped: number;
}

interface PendingIssue {
  severity: "INFO" | "WARNING" | "ERROR";
  entityType: string | null;
  teamworkEntityId: number | null;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

function emptyStats(): Record<DatasetName, DatasetStats> {
  return {
    companies: { read: 0, created: 0, updated: 0, skipped: 0 },
    tags: { read: 0, created: 0, updated: 0, skipped: 0 },
    projects: { read: 0, created: 0, updated: 0, skipped: 0 },
    people: { read: 0, created: 0, updated: 0, skipped: 0 },
    jobRoles: { read: 0, created: 0, updated: 0, skipped: 0 },
    taskLists: { read: 0, created: 0, updated: 0, skipped: 0 },
    tasks: { read: 0, created: 0, updated: 0, skipped: 0 },
    timeEntries: { read: 0, created: 0, updated: 0, skipped: 0 },
  };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d{10,13}$/.test(trimmed)) {
    const numeric = Number(trimmed);
    const milliseconds = trimmed.length <= 10 ? numeric * 1000 : numeric;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function dateText(value: unknown): string | null {
  return teamworkDateText(value);
}

function integerOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.max(0, Math.round(value));
}

function rawRecord(value: TeamworkRecord): Record<string, unknown> {
  return value;
}

class IssueCollector {
  totalWarnings = 0;
  private readonly samples: PendingIssue[] = [];
  private readonly codeCounts = new Map<string, number>();

  warn(
    code: string,
    message: string,
    entityType: string,
    teamworkEntityId: number | null,
    details?: Record<string, unknown>,
  ) {
    this.totalWarnings += 1;
    const count = (this.codeCounts.get(code) ?? 0) + 1;
    this.codeCounts.set(code, count);
    if (count <= MAX_SAVED_ISSUES_PER_CODE) {
      this.samples.push({
        severity: "WARNING",
        entityType,
        teamworkEntityId,
        code,
        message,
        details,
      });
    }
  }

  summary(): Record<string, number> {
    return Object.fromEntries([...this.codeCounts.entries()].sort((a, b) => b[1] - a[1]));
  }

  async save(syncRunId: string) {
    if (this.samples.length === 0) return;
    const db = getDb();
    await db.insert(syncIssues).values(
      this.samples.map((issue) => ({
        syncRunId,
        severity: issue.severity,
        entityType: issue.entityType,
        teamworkEntityId: issue.teamworkEntityId,
        code: issue.code,
        message: issue.message,
        details: issue.details ?? null,
      })),
    );
  }
}

async function paged(
  connection: Awaited<ReturnType<typeof activeConnection>>,
  path: string,
  keys: readonly string[],
  pageSize = 250,
): Promise<TeamworkRecord[]> {
  const rows: TeamworkRecord[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await teamworkFetch<TeamworkRecord>(
      connection,
      `${path}${separator}page=${page}&pageSize=${pageSize}&skipCounts=true`,
    );
    let pageRows: TeamworkRecord[] = [];
    for (const key of keys) {
      pageRows = collectionRows<TeamworkRecord>(result[key]);
      if (pageRows.length > 0 || key in result) break;
    }
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;
  }
  throw new Error(`Teamwork paging exceeded ${MAX_PAGES} pages for ${path}.`);
}

async function loadProjectMap(): Promise<Map<number, ProjectLookupValue>> {
  const db = getDb();
  const rows = await db
    .select({
      id: projects.id,
      teamworkId: projects.teamworkId,
      startDate: projects.startDate,
      excludedFromReporting: projects.excludedFromReporting,
    })
    .from(projects);
  return new Map(rows.map((row) => [row.teamworkId, row]));
}

async function loadTaskListMap(
  projectMap: ReadonlyMap<number, ProjectLookupValue>,
): Promise<Map<number, TaskListLookupValue>> {
  const db = getDb();
  const rows = await db
    .select({ id: taskLists.id, teamworkId: taskLists.teamworkId, projectId: taskLists.projectId })
    .from(taskLists);
  const projectTeamworkByDbId = new Map(
    [...projectMap.values()].map((project) => [project.id, project.teamworkId]),
  );
  return new Map(
    rows.flatMap((row) => {
      const projectTeamworkId = projectTeamworkByDbId.get(row.projectId);
      return projectTeamworkId === undefined
        ? []
        : [[row.teamworkId, { ...row, projectTeamworkId }] as const];
    }),
  );
}

async function loadTaskMap(
  projectMap: ReadonlyMap<number, ProjectLookupValue>,
): Promise<Map<number, TaskLookupValue>> {
  const db = getDb();
  const rows = await db
    .select({ id: tasks.id, teamworkId: tasks.teamworkId, projectId: tasks.projectId })
    .from(tasks);
  const projectTeamworkByDbId = new Map(
    [...projectMap.values()].map((project) => [project.id, project.teamworkId]),
  );
  return new Map(
    rows.flatMap((row) => {
      const projectTeamworkId = projectTeamworkByDbId.get(row.projectId);
      return projectTeamworkId === undefined
        ? []
        : [[row.teamworkId, { ...row, projectTeamworkId }] as const];
    }),
  );
}

function markUpsert(stats: DatasetStats, existed: boolean) {
  if (existed) stats.updated += 1;
  else stats.created += 1;
}

export async function runTeamworkSync(kind: SyncKind = "MANUAL") {
  const db = getDb();
  const sqlClient = getSqlClient();
  const connection = await activeConnection();
  const stats = emptyStats();
  const issues = new IssueCollector();
  const excludedNoReportRecords = {
    taskLists: 0,
    tasks: 0,
    timeEntries: 0,
  };
  const taskListRelationshipRecovery = {
    recoveredFromTaskEvidence: 0,
    ignoredUnreferenced: 0,
    referencedWithoutProjectEvidence: 0,
    conflictingTaskEvidence: 0,
  };

  await db
    .update(syncRuns)
    .set({
      status: "FAILED",
      completedAt: new Date(),
      errors: 1,
      summary: { message: "Previous synchronization process ended unexpectedly." },
    })
    .where(eq(syncRuns.status, "RUNNING"));

  const [run] = await db.insert(syncRuns).values({ kind }).returning();

  try {
    console.log("[1/6] Importing companies, tags, and projects...");
    const projectPayload = await teamworkFetch<TeamworkRecord>(
      connection,
      "/projects/api/v3/projects.json?includeArchivedProjects=true&includeProjectDates=true&includeProjectProfitability=true&includeCustomFields=true&skipCounts=true&include=companies,tags,projectBudgets,projectOwners&page=1&pageSize=500",
    );
    const included = (projectPayload.included ?? {}) as TeamworkRecord;
    const companyRows = collectionRows<TeamworkRecord>(included.companies);
    const tagRows = collectionRows<TeamworkRecord>(included.tags);
    const projectRows = collectionRows<TeamworkRecord>(projectPayload.projects);
    stats.companies.read = companyRows.length;
    stats.tags.read = tagRows.length;
    stats.projects.read = projectRows.length;

    const existingCompanies = new Set(
      (await db.select({ teamworkId: companies.teamworkId }).from(companies)).map((row) => row.teamworkId),
    );
    for (const row of companyRows) {
      const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
      if (teamworkId === null) {
        stats.companies.skipped += 1;
        issues.warn("COMPANY_ID_MISSING", "Company has no valid Teamwork ID.", "company", null);
        continue;
      }
      const name = textAtPaths(row, ["name", "companyName", "company-name"]) ?? "Unnamed company";
      await db
        .insert(companies)
        .values({ teamworkId, name, raw: rawRecord(row) })
        .onConflictDoUpdate({
          target: companies.teamworkId,
          set: { name, raw: rawRecord(row), updatedAt: new Date() },
        });
      markUpsert(stats.companies, existingCompanies.has(teamworkId));
      existingCompanies.add(teamworkId);
    }

    const existingTags = new Set(
      (await db.select({ teamworkId: tags.teamworkId }).from(tags)).map((row) => row.teamworkId),
    );
    const tagNameByTeamworkId = new Map<number, string>();
    for (const row of tagRows) {
      const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
      if (teamworkId === null) {
        stats.tags.skipped += 1;
        issues.warn("TAG_ID_MISSING", "Tag has no valid Teamwork ID.", "tag", null);
        continue;
      }
      const name = textAtPaths(row, ["name", "label", "title"]) ?? "Unnamed tag";
      tagNameByTeamworkId.set(teamworkId, name);
      await db
        .insert(tags)
        .values({
          teamworkId,
          name,
          normalizedName: name.replace(/[^a-z0-9]/gi, "").toLowerCase(),
          color: textAtPaths(row, ["color"]),
        })
        .onConflictDoUpdate({
          target: tags.teamworkId,
          set: {
            name,
            normalizedName: name.replace(/[^a-z0-9]/gi, "").toLowerCase(),
            color: textAtPaths(row, ["color"]),
            updatedAt: new Date(),
          },
        });
      markUpsert(stats.tags, existingTags.has(teamworkId));
      existingTags.add(teamworkId);
    }

    const companyByTeamworkId = new Map(
      (await db.select({ id: companies.id, teamworkId: companies.teamworkId }).from(companies)).map(
        (row) => [row.teamworkId, row.id],
      ),
    );
    const savedTagRows = await db
      .select({ id: tags.id, teamworkId: tags.teamworkId, normalizedName: tags.normalizedName })
      .from(tags);
    const tagByTeamworkId = new Map(savedTagRows.map((row) => [row.teamworkId, row.id]));
    const tagByNormalizedName = new Map(
      savedTagRows.map((row) => [row.normalizedName, row.id]),
    );
    const existingProjects = new Set(
      (await db.select({ teamworkId: projects.teamworkId }).from(projects)).map((row) => row.teamworkId),
    );
    const dataHallProjectIds = new Set<string>();

    for (const row of projectRows) {
      const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
      if (teamworkId === null) {
        stats.projects.skipped += 1;
        issues.warn("PROJECT_ID_MISSING", "Project has no valid Teamwork ID.", "project", null);
        continue;
      }
      const companyTeamworkId = idAtPaths(row, ["companyId", "company.id", "company.idValue"]);
      const projectTagRefs = Array.isArray(row.tags)
        ? row.tags
        : collectionRows<TeamworkRecord>(row.tags);
      const tagNames = projectTagRefs
        .map((tagRef) => {
          const tagId = teamworkNumericId(tagRef);
          return (tagId === null ? null : tagNameByTeamworkId.get(tagId)) ?? teamworkLabelText(tagRef);
        })
        .filter(Boolean);
      const reportingPolicy = projectReportingPolicy(tagNames);
      const excluded = reportingPolicy.excluded;
      const name = textAtPaths(row, ["name", "projectName", "project-name"]) ?? "Unnamed project";
      const [saved] = await db
        .insert(projects)
        .values({
          teamworkId,
          companyId: companyTeamworkId === null ? null : (companyByTeamworkId.get(companyTeamworkId) ?? null),
          name,
          projectNumber: parseProjectNumber(name),
          status: textAtPaths(row, ["status"]) ?? "unknown",
          projectType: reportingPolicy.projectType,
          startDate: dateText(firstValue(row, ["startDate", "startAt"])),
          endDate: dateText(firstValue(row, ["endDate", "endAt"])),
          archivedAt: toDate(firstValue(row, ["archivedAt"])),
          completedAt: toDate(firstValue(row, ["completedAt"])),
          excludedFromReporting: excluded,
          exclusionReason: reportingPolicy.exclusionReason,
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
          lastSyncedAt: new Date(),
          raw: rawRecord(row),
        })
        .onConflictDoUpdate({
          target: projects.teamworkId,
          set: {
            companyId: companyTeamworkId === null ? null : (companyByTeamworkId.get(companyTeamworkId) ?? null),
            name,
            projectNumber: parseProjectNumber(name),
            status: textAtPaths(row, ["status"]) ?? "unknown",
            projectType: reportingPolicy.projectType,
            startDate: dateText(firstValue(row, ["startDate", "startAt"])),
            endDate: dateText(firstValue(row, ["endDate", "endAt"])),
            archivedAt: toDate(firstValue(row, ["archivedAt"])),
            completedAt: toDate(firstValue(row, ["completedAt"])),
            excludedFromReporting: excluded,
            exclusionReason: reportingPolicy.exclusionReason,
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
            lastSyncedAt: new Date(),
            raw: rawRecord(row),
            updatedAt: new Date(),
          },
        })
        .returning({ id: projects.id });
      markUpsert(stats.projects, existingProjects.has(teamworkId));
      existingProjects.add(teamworkId);
      if (reportingPolicy.isDataHall) dataHallProjectIds.add(saved.id);

      await db.delete(projectTags).where(eq(projectTags.projectId, saved.id));
      for (const tagRef of projectTagRefs) {
        const tagTeamworkId = teamworkNumericId(tagRef);
        const normalizedTagName = normalizeTeamworkLabel(tagRef);
        const tagId =
          (tagTeamworkId === null ? null : (tagByTeamworkId.get(tagTeamworkId) ?? null)) ??
          (normalizedTagName ? (tagByNormalizedName.get(normalizedTagName) ?? null) : null);
        if (tagId) {
          await db.insert(projectTags).values({ projectId: saved.id, tagId }).onConflictDoNothing();
        }
      }
    }

    console.log("[2/6] Importing employees and job roles...");
    const peopleRows = await paged(
      connection,
      "/projects/api/v3/people.json?onlyOwnerCompany=true&excludeContacts=true&includeClients=false&includeServiceAccounts=true&showDeleted=true&include=companies&fields[people]=id,firstName,lastName,email,companyId,company,isAdmin,isClientUser,isServiceAccount,type,deleted,deletedAt,updatedAt,userCost",
      ["people"],
      100,
    );
    stats.people.read = peopleRows.length;
    const existingPeople = new Set(
      (await db.select({ teamworkId: people.teamworkId }).from(people)).map((row) => row.teamworkId),
    );
    for (const row of peopleRows) {
      const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
      if (teamworkId === null) {
        stats.people.skipped += 1;
        issues.warn("PERSON_ID_MISSING", "Person has no valid Teamwork ID.", "person", null);
        continue;
      }
      const companyTeamworkId = idAtPaths(row, ["companyId", "company.id"]);
      const costRate = numberAtPaths(row, ["userCost", "costRate"]);
      await db
        .insert(people)
        .values({
          teamworkId,
          companyId: companyTeamworkId === null ? null : (companyByTeamworkId.get(companyTeamworkId) ?? null),
          firstName: textAtPaths(row, ["firstName", "first-name"]),
          lastName: textAtPaths(row, ["lastName", "last-name"]),
          email: textAtPaths(row, ["email", "email-address"]),
          isActive: !(booleanAtPaths(row, ["deleted"]) ?? false),
          isClientUser: booleanAtPaths(row, ["isClientUser"]) ?? false,
          isServiceAccount: booleanAtPaths(row, ["isServiceAccount"]) ?? false,
          isSiteAdmin: booleanAtPaths(row, ["isAdmin", "administrator"]) ?? false,
          costRate: costRate === null ? null : String(costRate),
          costRateReturned: costRate !== null,
          deletedAt: toDate(firstValue(row, ["deletedAt"])),
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
          raw: rawRecord(row),
        })
        .onConflictDoUpdate({
          target: people.teamworkId,
          set: {
            companyId: companyTeamworkId === null ? null : (companyByTeamworkId.get(companyTeamworkId) ?? null),
            firstName: textAtPaths(row, ["firstName", "first-name"]),
            lastName: textAtPaths(row, ["lastName", "last-name"]),
            email: textAtPaths(row, ["email", "email-address"]),
            isActive: !(booleanAtPaths(row, ["deleted"]) ?? false),
            isClientUser: booleanAtPaths(row, ["isClientUser"]) ?? false,
            isServiceAccount: booleanAtPaths(row, ["isServiceAccount"]) ?? false,
            isSiteAdmin: booleanAtPaths(row, ["isAdmin", "administrator"]) ?? false,
            costRate: costRate === null ? null : String(costRate),
            costRateReturned: costRate !== null,
            deletedAt: toDate(firstValue(row, ["deletedAt"])),
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
            raw: rawRecord(row),
            updatedAt: new Date(),
          },
        });
      markUpsert(stats.people, existingPeople.has(teamworkId));
      existingPeople.add(teamworkId);
    }

    try {
      const jobRolePayload = await teamworkFetch<TeamworkRecord>(
        connection,
        "/projects/api/v3/jobroles.json?include=currencies&showDeleted=true&skipCounts=true&page=1&pageSize=250",
      );
      const jobRoleRows = collectionRows<TeamworkRecord>(
        jobRolePayload.jobRoles ?? jobRolePayload.jobroles,
      );
      stats.jobRoles.read = jobRoleRows.length;
      const existingJobRoles = new Set(
        (await db.select({ teamworkId: jobRoles.teamworkId }).from(jobRoles)).map(
          (row) => row.teamworkId,
        ),
      );
      for (const row of jobRoleRows) {
        const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
        if (teamworkId === null) {
          stats.jobRoles.skipped += 1;
          issues.warn("JOB_ROLE_ID_MISSING", "Job role has no valid Teamwork ID.", "jobRole", null);
          continue;
        }
        const parsedRate = parseJobRoleCostRate(row);
        const deletedAt = toDate(firstValue(row, ["deletedAt"]));
        const isActive =
          deletedAt === null &&
          !(booleanAtPaths(row, ["deleted"]) ?? false) &&
          (booleanAtPaths(row, ["isActive", "active"]) ?? true);
        await db
          .insert(jobRoles)
          .values({
            teamworkId,
            name: textAtPaths(row, ["name", "title"]) ?? `Job role ${teamworkId}`,
            isActive,
            costRate: parsedRate.costRate === null ? null : String(parsedRate.costRate),
            costCurrency: parsedRate.currencyCode ?? "USD",
            costRateReturned: parsedRate.costRate !== null,
            deletedAt,
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
            raw: rawRecord(row),
          })
          .onConflictDoUpdate({
            target: jobRoles.teamworkId,
            set: {
              name: textAtPaths(row, ["name", "title"]) ?? `Job role ${teamworkId}`,
              isActive,
              costRate: parsedRate.costRate === null ? null : String(parsedRate.costRate),
              costCurrency: parsedRate.currencyCode ?? "USD",
              costRateReturned: parsedRate.costRate !== null,
              deletedAt,
              teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
              raw: rawRecord(row),
              updatedAt: new Date(),
            },
          });
        markUpsert(stats.jobRoles, existingJobRoles.has(teamworkId));
        existingJobRoles.add(teamworkId);
      }
    } catch (error) {
      issues.warn(
        "JOB_ROLE_SYNC_UNAVAILABLE",
        "Teamwork job roles or their cost rates could not be refreshed; role-only forecasts may remain provisional.",
        "jobRole",
        null,
        { message: error instanceof Error ? error.message : String(error) },
      );
    }

    console.log("[3/6] Importing task lists...");
    const projectMap = await loadProjectMap();
    const taskListRows = await paged(
      connection,
      "/projects/api/v3/tasklists.json?projectType=normal&includeArchivedProjects=true&showCompleted=true&showDeleted=true&getEmptyLists=true&calculateDates=true&include=projects",
      ["tasklists", "taskLists"],
    );
    stats.taskLists.read = taskListRows.length;
    const existingTaskLists = new Set(
      (await db.select({ teamworkId: taskLists.teamworkId }).from(taskLists)).map((row) => row.teamworkId),
    );
    const excludedTaskListTeamworkIds = new Set<number>();
    const deferredTaskLists = new Map<number, TeamworkRecord>();

    const upsertTaskList = async (
      row: TeamworkRecord,
      teamworkId: number,
      project: ProjectLookupValue,
    ) => {
      const name = textAtPaths(row, ["name", "title"]) ?? "Unnamed task list";
      await db
        .insert(taskLists)
        .values({
          teamworkId,
          projectId: project.id,
          name,
          status: textAtPaths(row, ["status"]),
          isDeleted:
            (textAtPaths(row, ["status"]) ?? "").toLowerCase() === "deleted" ||
            toDate(firstValue(row, ["deletedAt"])) !== null,
          isBillable: booleanAtPaths(row, ["isBillable", "billable"]),
          operationalGroup: classifyTaskList(name, { isDataHall: dataHallProjectIds.has(project.id) }),
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
          raw: rawRecord(row),
        })
        .onConflictDoUpdate({
          target: taskLists.teamworkId,
          set: {
            projectId: project.id,
            name,
            status: textAtPaths(row, ["status"]),
            isDeleted:
              (textAtPaths(row, ["status"]) ?? "").toLowerCase() === "deleted" ||
              toDate(firstValue(row, ["deletedAt"])) !== null,
            isBillable: booleanAtPaths(row, ["isBillable", "billable"]),
            operationalGroup: classifyTaskList(name, { isDataHall: dataHallProjectIds.has(project.id) }),
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt"])),
            raw: rawRecord(row),
            updatedAt: new Date(),
          },
        });
      markUpsert(stats.taskLists, existingTaskLists.has(teamworkId));
      existingTaskLists.add(teamworkId);
    };

    for (const row of taskListRows) {
      const teamworkId = idAtPaths(row, ENTITY_ID_PATHS);
      if (teamworkId === null) {
        stats.taskLists.skipped += 1;
        issues.warn(
          "TASK_LIST_ID_MISSING",
          "Task list has no valid Teamwork ID.",
          "taskList",
          null,
        );
        continue;
      }

      const projectTeamworkId = idAtPaths(row, PROJECT_ID_PATHS);
      const project = projectTeamworkId === null ? null : (projectMap.get(projectTeamworkId) ?? null);
      if (project?.excludedFromReporting) {
        stats.taskLists.skipped += 1;
        excludedNoReportRecords.taskLists += 1;
        excludedTaskListTeamworkIds.add(teamworkId);
        continue;
      }
      if (!project) {
        deferredTaskLists.set(teamworkId, row);
        continue;
      }
      await upsertTaskList(row, teamworkId, project);
    }

    console.log("[4/6] Importing tasks and subtasks...");
    const taskRows = await paged(
      connection,
      "/projects/api/v3/tasks.json?projectType=normal&taskFilter=all&includeArchivedProjects=true&includeCompletedTasks=true&showCompletedLists=true&showDeleted=true&includeTasksFromDeletedLists=true&includeCustomFields=true&includeRelatedTasks=true&getSubTasks=true&includeAssigneeJobRoles=true&includeAssigneeTeams=true&includeAssigneeCompanies=true&include=projects,tasklists,parentTasks,users,jobRoles,tags,timeTotals,subtaskStats",
      ["tasks"],
    );
    stats.tasks.read = taskRows.length;

    const taskListEvidence = buildTaskListProjectEvidence(taskRows);
    for (const [teamworkId, row] of deferredTaskLists) {
      const evidence = taskListEvidence.get(teamworkId);
      if (!evidence) {
        stats.taskLists.skipped += 1;
        taskListRelationshipRecovery.ignoredUnreferenced += 1;
        continue;
      }
      if (evidence.conflicted) {
        stats.taskLists.skipped += 1;
        taskListRelationshipRecovery.conflictingTaskEvidence += 1;
        issues.warn(
          "TASK_LIST_PROJECT_CONFLICT",
          "Tasks reference the same task list through multiple projects.",
          "taskList",
          teamworkId,
          { taskCount: evidence.taskCount },
        );
        continue;
      }

      const projectTeamworkId = evidence.projectTeamworkId;
      const project = projectTeamworkId === null ? null : (projectMap.get(projectTeamworkId) ?? null);
      if (project?.excludedFromReporting) {
        stats.taskLists.skipped += 1;
        excludedNoReportRecords.taskLists += 1;
        excludedTaskListTeamworkIds.add(teamworkId);
        continue;
      }
      if (project) {
        await upsertTaskList(row, teamworkId, project);
        taskListRelationshipRecovery.recoveredFromTaskEvidence += 1;
        continue;
      }

      stats.taskLists.skipped += 1;
      taskListRelationshipRecovery.referencedWithoutProjectEvidence += 1;
    }

    const taskListMap = await loadTaskListMap(projectMap);
    const existingTasks = new Set(
      (await db.select({ teamworkId: tasks.teamworkId }).from(tasks)).map((row) => row.teamworkId),
    );
    const excludedTaskTeamworkIds = new Set<number>();
    for (const row of taskRows) {
      const resolved = resolveTaskRelationships(row, projectMap, taskListMap);
      if (
        resolved.project?.excludedFromReporting ||
        (resolved.taskListTeamworkId !== null && excludedTaskListTeamworkIds.has(resolved.taskListTeamworkId))
      ) {
        stats.tasks.skipped += 1;
        excludedNoReportRecords.tasks += 1;
        if (resolved.taskTeamworkId !== null) excludedTaskTeamworkIds.add(resolved.taskTeamworkId);
        continue;
      }
      if (resolved.reason || !resolved.project || !resolved.taskList || resolved.taskTeamworkId === null) {
        stats.tasks.skipped += 1;
        issues.warn(
          "TASK_RELATIONSHIP_MISSING",
          resolved.reason ?? "Task relationship could not be resolved.",
          "task",
          resolved.taskTeamworkId,
          {
            taskListTeamworkId: resolved.taskListTeamworkId,
            projectTeamworkId: resolved.projectTeamworkId,
          },
        );
        continue;
      }
      const estimate = numberAtPaths(row, [
        "estimatedMinutes",
        "estimateMinutes",
        "estimated-minutes",
        "estimatedTimeMinutes",
        "estimate.minutes",
      ]);
      const estimatedHours = numberAtPaths(row, ["estimatedHours", "estimated-hours", "estimate.hours"]);
      const estimatedMinutes = estimate ?? (estimatedHours === null ? null : estimatedHours * 60);
      const accumulatedEstimatedMinutes = numberAtPaths(row, ["accumulatedEstimatedMinutes"]);
      const progressPercent = numberAtPaths(row, ["progress", "progressPercent"]);
      const status = textAtPaths(row, ["status"]) ?? "unknown";
      await db
        .insert(tasks)
        .values({
          teamworkId: resolved.taskTeamworkId,
          projectId: resolved.project.id,
          taskListId: resolved.taskList.id,
          parentTeamworkId: idAtPaths(row, PARENT_TASK_ID_PATHS),
          name: textAtPaths(row, ["name", "content", "title"]) ?? "Unnamed task",
          status,
          estimatedMinutes: integerOrNull(estimatedMinutes),
          accumulatedEstimatedMinutes: integerOrNull(accumulatedEstimatedMinutes),
          progressPercent: integerOrNull(progressPercent),
          startDate: dateText(firstValue(row, ["startDate"])),
          dueDate: dateText(firstValue(row, ["dueDate"])),
          completedAt: toDate(firstValue(row, ["completedAt", "completedOn"])),
          isDeleted: toDate(firstValue(row, ["deletedAt"])) !== null || status.toLowerCase() === "deleted",
          teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
          raw: rawRecord(row),
        })
        .onConflictDoUpdate({
          target: tasks.teamworkId,
          set: {
            projectId: resolved.project.id,
            taskListId: resolved.taskList.id,
            parentTeamworkId: idAtPaths(row, PARENT_TASK_ID_PATHS),
            name: textAtPaths(row, ["name", "content", "title"]) ?? "Unnamed task",
            status,
            estimatedMinutes: integerOrNull(estimatedMinutes),
            accumulatedEstimatedMinutes: integerOrNull(accumulatedEstimatedMinutes),
            progressPercent: integerOrNull(progressPercent),
            startDate: dateText(firstValue(row, ["startDate"])),
            dueDate: dateText(firstValue(row, ["dueDate"])),
            completedAt: toDate(firstValue(row, ["completedAt", "completedOn"])),
            isDeleted: toDate(firstValue(row, ["deletedAt"])) !== null || status.toLowerCase() === "deleted",
            teamworkUpdatedAt: toDate(firstValue(row, ["updatedAt", "dateUpdated"])),
            raw: rawRecord(row),
            updatedAt: new Date(),
          },
        });
      markUpsert(stats.tasks, existingTasks.has(resolved.taskTeamworkId));
      existingTasks.add(resolved.taskTeamworkId);
    }
    await sqlClient`
      update tasks as child
      set parent_task_id = parent.id
      from tasks as parent
      where child.parent_teamwork_id = parent.teamwork_id
        and child.parent_task_id is distinct from parent.id
    `;

    console.log("[5/6] Importing historical time entries...");
    const taskMap = await loadTaskMap(projectMap);
    const peopleByTeamworkId = new Map(
      (await db.select({ id: people.id, teamworkId: people.teamworkId }).from(people)).map((row) => [
        row.teamworkId,
        row.id,
      ]),
    );
    const timeRows = await paged(
      connection,
      "/projects/api/v3/time.json?includeArchivedProjects=true&showDeleted=true&returnCostInfo=true&returnBillableInfo=true&includeTotals=true&useFallbackMethod=true&include=projects,projects.companies,tasks,tasks.parentTasks,tasks.tasklists,tasks.users,users,project.billing,project.billing.currencies",
      ["timelogs", "timeEntries", "time"],
    );
    stats.timeEntries.read = timeRows.length;
    const existingTimeEntries = new Set(
      (await db.select({ teamworkId: timeEntries.teamworkId }).from(timeEntries)).map(
        (row) => row.teamworkId,
      ),
    );
    for (const row of timeRows) {
      const resolved = resolveTimeRelationships(row, projectMap, taskMap);
      if (
        resolved.project?.excludedFromReporting ||
        (resolved.taskTeamworkId !== null && excludedTaskTeamworkIds.has(resolved.taskTeamworkId))
      ) {
        stats.timeEntries.skipped += 1;
        excludedNoReportRecords.timeEntries += 1;
        continue;
      }
      if (resolved.reason || !resolved.project || resolved.timeTeamworkId === null) {
        stats.timeEntries.skipped += 1;
        issues.warn(
          "TIME_RELATIONSHIP_MISSING",
          resolved.reason ?? "Time-entry relationship could not be resolved.",
          "timeEntry",
          resolved.timeTeamworkId,
          {
            taskTeamworkId: resolved.taskTeamworkId,
            projectTeamworkId: resolved.projectTeamworkId,
          },
        );
        continue;
      }
      const personTeamworkId = idAtPaths(row, PERSON_ID_PATHS);
      const directMinutes = numberAtPaths(row, ["minutes", "durationMinutes", "minutesLogged"]);
      const hours = numberAtPaths(row, ["hours", "durationHours"]);
      const minutesPart = numberAtPaths(row, ["minutesPart"]);
      const calculatedMinutes =
        directMinutes ?? (hours === null ? 0 : hours * 60 + (minutesPart ?? 0));
      const costRate = numberAtPaths(row, ["costRate", "userCost", "costInfo.rate"]);
      const costTotal = numberAtPaths(row, ["cost", "costTotal", "costInfo.total"]);
      const sourceLoggedDate = dateText(firstValue(row, [
        "timeLogged",
        "time-logged",
        "timelog.timeLogged",
        "date",
        "loggedDate",
        "dateUserPerspective",
        "dateUTC",
        "dateUtc",
        "loggedAt",
      ]));
      const loggedDate = sourceLoggedDate ??
        dateText(firstValue(row, ["createdAt", "dateCreated", "created-at", "updatedAt"])) ??
        dateText(resolved.project.startDate) ??
        new Date().toISOString().slice(0, 10);
      if (!sourceLoggedDate) {
        issues.warn(
          "TIME_DATE_FALLBACK",
          "Time entry had no valid Teamwork logged date. A created date, project start date, or import date was used instead.",
          "timeEntry",
          resolved.timeTeamworkId,
          {
            loggedDate,
            projectTeamworkId: resolved.project.teamworkId,
            availableDateFields: Object.keys(row)
              .filter((key) => /date|time|logged/i.test(key))
              .sort(),
          },
        );
      }
      await db
        .insert(timeEntries)
        .values({
          teamworkId: resolved.timeTeamworkId,
          projectId: resolved.project.id,
          taskId: resolved.task?.id ?? null,
          personId:
            personTeamworkId === null ? null : (peopleByTeamworkId.get(personTeamworkId) ?? null),
          loggedDate,
          minutes: integerOrNull(calculatedMinutes) ?? 0,
          isBillable: booleanAtPaths(row, ["isBillable", "billable"]) ?? false,
          description: textAtPaths(row, ["description"]),
          historicalCostRate: costRate === null ? null : String(costRate),
          historicalCostTotal: costTotal === null ? null : String(costTotal),
          costInfoReturned: costRate !== null || costTotal !== null,
          isDeleted:
            (booleanAtPaths(row, ["deleted", "isDeleted"]) ?? false) ||
            toDate(firstValue(row, ["dateDeleted", "deletedAt"])) !== null,
          teamworkUpdatedAt: toDate(firstValue(row, ["dateEdited", "updatedAt", "dateCreated"])),
          raw: rawRecord(row),
        })
        .onConflictDoUpdate({
          target: timeEntries.teamworkId,
          set: {
            projectId: resolved.project.id,
            taskId: resolved.task?.id ?? null,
            personId:
              personTeamworkId === null ? null : (peopleByTeamworkId.get(personTeamworkId) ?? null),
            loggedDate,
            minutes: integerOrNull(calculatedMinutes) ?? 0,
            isBillable: booleanAtPaths(row, ["isBillable", "billable"]) ?? false,
            description: textAtPaths(row, ["description"]),
            historicalCostRate: costRate === null ? null : String(costRate),
            historicalCostTotal: costTotal === null ? null : String(costTotal),
            costInfoReturned: costRate !== null || costTotal !== null,
            isDeleted:
              (booleanAtPaths(row, ["deleted", "isDeleted"]) ?? false) ||
              toDate(firstValue(row, ["dateDeleted", "deletedAt"])) !== null,
            teamworkUpdatedAt: toDate(firstValue(row, ["dateEdited", "updatedAt", "dateCreated"])),
            raw: rawRecord(row),
            updatedAt: new Date(),
          },
        });
      markUpsert(stats.timeEntries, existingTimeEntries.has(resolved.timeTeamworkId));
      existingTimeEntries.add(resolved.timeTeamworkId);
    }

    console.log("[6/6] Verifying import counts and saving diagnostics...");
    await issues.save(run.id);
    const totals = Object.values(stats).reduce(
      (sum, dataset) => ({
        read: sum.read + dataset.read,
        created: sum.created + dataset.created,
        updated: sum.updated + dataset.updated,
        skipped: sum.skipped + dataset.skipped,
      }),
      { read: 0, created: 0, updated: 0, skipped: 0 },
    );
    const status = issues.totalWarnings > 0 ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED";
    const summary = {
      datasets: stats,
      excludedNoReportRecords,
      taskListRelationshipRecovery,
      warningCodes: issues.summary(),
    };

    await db
      .update(teamworkConnections)
      .set({ lastSyncAt: new Date(), lastVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(teamworkConnections.id, connection.id));
    await db
      .update(syncRuns)
      .set({
        status,
        completedAt: new Date(),
        recordsRead: totals.read,
        recordsCreated: totals.created,
        recordsUpdated: totals.updated,
        warnings: issues.totalWarnings,
        errors: 0,
        summary,
      })
      .where(eq(syncRuns.id, run.id));

    return {
      runId: run.id,
      status,
      totals,
      datasets: stats,
      excludedNoReportRecords,
      taskListRelationshipRecovery,
      warningCodes: issues.summary(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(syncIssues).values({
      syncRunId: run.id,
      severity: "ERROR",
      code: "SYNC_FAILED",
      message,
    });
    await db
      .update(syncRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        recordsRead: Object.values(stats).reduce((sum, item) => sum + item.read, 0),
        recordsCreated: Object.values(stats).reduce((sum, item) => sum + item.created, 0),
        recordsUpdated: Object.values(stats).reduce((sum, item) => sum + item.updated, 0),
        warnings: issues.totalWarnings,
        errors: 1,
        summary: {
          message,
          datasets: stats,
          excludedNoReportRecords,
          taskListRelationshipRecovery,
          warningCodes: issues.summary(),
        },
      })
      .where(eq(syncRuns.id, run.id));
    throw error;
  }
}
