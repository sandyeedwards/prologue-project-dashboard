import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  companies,
  people,
  projects,
  syncRuns,
  taskLists,
  tasks,
  teamworkConnections,
  timeEntries,
} from "@/db/schema";

interface DatasetSummary {
  read?: number;
  created?: number;
  updated?: number;
  skipped?: number;
}

interface SyncSummary {
  datasets?: Record<string, DatasetSummary>;
  warningCodes?: Record<string, number>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSummary(value: unknown): SyncSummary {
  if (!isObject(value)) return {};
  return value as SyncSummary;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function verifyTeamworkImport() {
  const db = getDb();
  const [connection] = await db
    .select({ id: teamworkConnections.id })
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);
  const [lastRun] = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
  const [[companyCount], [peopleCount], [projectCount], [taskListCount], [taskCount], [timeCount]] =
    await Promise.all([
      db.select({ value: count() }).from(companies),
      db.select({ value: count() }).from(people),
      db.select({ value: count() }).from(projects),
      db.select({ value: count() }).from(taskLists),
      db.select({ value: count() }).from(tasks),
      db.select({ value: count() }).from(timeEntries),
    ]);

  const counts = {
    companies: companyCount.value,
    people: peopleCount.value,
    projects: projectCount.value,
    taskLists: taskListCount.value,
    tasks: taskCount.value,
    timeEntries: timeCount.value,
  };
  const summary = parseSummary(lastRun?.summary);
  const datasets = summary.datasets ?? {};
  const datasetCoverage = Object.fromEntries(
    Object.entries(datasets).map(([name, dataset]) => {
      const read = numeric(dataset.read);
      const imported = numeric(dataset.created) + numeric(dataset.updated);
      return [
        name,
        {
          read,
          imported,
          skipped: numeric(dataset.skipped),
          coveragePercent: read === 0 ? 100 : Math.round((imported / read) * 10000) / 100,
        },
      ];
    }),
  );

  const taskCoverage = datasetCoverage.tasks?.coveragePercent ?? 0;
  const timeCoverage = datasetCoverage.timeEntries?.coveragePercent ?? 0;
  const checks = {
    connected: Boolean(connection),
    latestRunCompleted:
      lastRun?.status === "SUCCEEDED" || lastRun?.status === "SUCCEEDED_WITH_WARNINGS",
    projectsImported: counts.projects > 0,
    taskListsImported: counts.taskLists > 0,
    tasksImported: counts.tasks > 0,
    timeEntriesImported: counts.timeEntries > 0,
    taskCoverageAcceptable: taskCoverage >= 90,
    timeCoverageAcceptable: timeCoverage >= 90,
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    status: passed ? "PASS" : "FAIL",
    checks,
    counts,
    latestRun: lastRun
      ? {
          id: lastRun.id,
          kind: lastRun.kind,
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          completedAt: lastRun.completedAt,
          warnings: lastRun.warnings,
          errors: lastRun.errors,
        }
      : null,
    datasetCoverage,
    warningCodes: summary.warningCodes ?? {},
  };
}
