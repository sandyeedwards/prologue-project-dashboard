import { getSqlClient } from "@/db/client";
import { getDealPipelines, searchOpenDeals, searchWonDeals } from "@/lib/hosting/hubspot";
import { getMeetingReport } from "@/lib/reporting/mmm-data";
import { getTimeReportingReport } from "@/lib/reporting/time-reporting-data";
import { currentTimeReportingDate } from "@/lib/reporting/time-reporting-rules";
import {
  addWeeks,
  carryForward,
  easternMidnight,
  emptyNotes,
  parseNotes,
  type AllHandsNotes,
} from "./agenda";
import {
  summarizePipelines,
  summarizeWonDeals,
  type PipelineSummary,
  type WonDeals,
} from "./pipeline";

export type AgendaNotesState = {
  notes: AllHandsNotes;
  /** Saved row version; 0 when this week has not been saved yet. */
  version: number;
  /** Week the unsaved notes were carried from, when this week has not been saved yet. */
  carriedFrom: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

export async function getAgendaNotes(weekStart: string): Promise<AgendaNotesState> {
  const sql = getSqlClient();
  const rows = await sql<
    Array<{
      weekStart: string;
      notes: unknown;
      version: number;
      updatedAt: Date;
      updatedBy: string | null;
    }>
  >`
    select n.week_start::text as "weekStart", n.notes, n.version, n.updated_at as "updatedAt",
      u.display_name as "updatedBy"
    from all_hands_notes n
    left join app_users u on u.id = n.updated_by_user_id
    where n.week_start <= ${weekStart}::date
    order by n.week_start desc
    limit 1
  `;
  const row = rows[0];
  if (row && row.weekStart === weekStart) {
    return {
      notes: parseNotes(row.notes),
      version: row.version,
      carriedFrom: null,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }
  return {
    notes: row ? carryForward(parseNotes(row.notes)) : emptyNotes(),
    version: 0,
    carriedFrom: row?.weekStart ?? null,
    updatedAt: null,
    updatedBy: null,
  };
}

export type PipelineState =
  | { ok: true; pipelines: PipelineSummary[]; wonLastWeek: WonDeals; loadedAt: Date }
  | { ok: false; message: string };

const PIPELINE_CACHE_MS = 10 * 60_000;
const pipelineCache = new Map<string, { at: number; value: PipelineState }>();

/**
 * Open HubSpot deals plus deals won in the week before the meeting, read-only. Failures are
 * reported, never shown as an empty pipeline.
 */
export async function getPipelineState(
  weekStart: string,
  now = new Date(),
): Promise<PipelineState> {
  const cached = pipelineCache.get(weekStart);
  if (cached && now.getTime() - cached.at < PIPELINE_CACHE_MS) return cached.value;
  let value: PipelineState;
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    value = { ok: false, message: "HubSpot is not connected (no access token is set)." };
  } else {
    try {
      const properties = ["dealname", "amount", "dealstage", "pipeline", "closedate"];
      const [pipelines, deals, won] = await Promise.all([
        getDealPipelines(),
        searchOpenDeals(properties),
        searchWonDeals(
          easternMidnight(addWeeks(weekStart, -1)),
          easternMidnight(weekStart),
          properties,
        ),
      ]);
      value = {
        ok: true,
        pipelines: summarizePipelines(deals, pipelines, currentTimeReportingDate(now)),
        wonLastWeek: summarizeWonDeals(won),
        loadedAt: now,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      value = {
        ok: false,
        message: /\b(401|403)\b/.test(detail)
          ? "HubSpot refused the request. The access token may need permission to read deals and pipelines."
          : "HubSpot could not be reached. Try again in a few minutes.",
      };
      // Do not cache failures for long: retry on the next load after a minute.
      pipelineCache.set(weekStart, { at: now.getTime() - PIPELINE_CACHE_MS + 60_000, value });
      return value;
    }
  }
  pipelineCache.set(weekStart, { at: now.getTime(), value });
  return value;
}

export type ProjectInsights = {
  activeProjects: number;
  needingAttention: number;
  overdueTasks: number;
  dueThisWeek: number;
  watchList: Array<{ id: string; name: string; projectNumber: string | null; reason: string }>;
};

export async function getProjectInsights(): Promise<ProjectInsights> {
  const { projects } = await getMeetingReport();
  const red = projects
    .filter((project) => project.signals.some((signal) => signal.tone === "red"))
    .sort((a, b) => b.overdueTasks - a.overdueTasks || a.name.localeCompare(b.name));
  return {
    activeProjects: projects.length,
    needingAttention: projects.filter((project) => project.signals.length > 0).length,
    overdueTasks: projects.reduce((sum, project) => sum + project.overdueTasks, 0),
    dueThisWeek: projects.reduce((sum, project) => sum + project.dueThisWeek, 0),
    watchList: red.slice(0, 8).map((project) => ({
      id: project.id,
      name: project.name,
      projectNumber: project.projectNumber,
      reason: project.signals.find((signal) => signal.tone === "red")?.label ?? "",
    })),
  };
}

export type UtilizationSnapshot = {
  startDate: string;
  endDate: string;
  totalMinutes: number;
  billableMinutes: number;
  expectedMinutes: number;
  /** Team hours logged the week before, for the week-over-week trend; null if unavailable. */
  priorTotalMinutes: number | null;
  /** Per person: only filled in for Managers and Admins, like Time Reporting. */
  people: Array<{ name: string; totalMinutes: number; billableMinutes: number }> | null;
};

/** The week before the meeting: billable ÷ logged, the same rule as Time Reporting. */
export async function getLastWeekUtilization(
  weekStart: string,
  canSeePeople: boolean,
): Promise<UtilizationSnapshot> {
  const startDate = addWeeks(weekStart, -1);
  const endDate = shiftDays(weekStart, -1);
  const [report, prior] = await Promise.all([
    getTimeReportingReport({ preset: "custom", startDate, endDate }),
    getTimeReportingReport({
      preset: "custom",
      startDate: addWeeks(weekStart, -2),
      endDate: shiftDays(startDate, -1),
    }).catch(() => null),
  ]);
  return {
    startDate: report.range.startDate,
    endDate: report.range.endDate,
    totalMinutes: report.totals.totalMinutes,
    billableMinutes: report.totals.billableMinutes,
    expectedMinutes: report.totals.expectedMinutes,
    priorTotalMinutes: prior ? prior.totals.totalMinutes : null,
    people: canSeePeople
      ? report.employees
          .filter((employee) => employee.totalMinutes > 0)
          .map((employee) => ({
            name: employee.name,
            totalMinutes: employee.totalMinutes,
            billableMinutes: employee.billableMinutes,
          }))
          .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name))
      : null,
  };
}

export async function getLastSyncAt(): Promise<Date | null> {
  const rows = await getSqlClient()<{ lastSyncAt: Date | null }[]>`
    select max(last_sync_at) as "lastSyncAt" from teamwork_connections where is_active = true
  `;
  return rows[0]?.lastSyncAt ?? null;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export type DueTask = {
  id: string;
  teamworkId: number;
  name: string;
  dueDate: string;
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  assignees: string[];
};

type ProjectRef = { id: string; name: string; projectNumber: string | null };

export type WeekHighlights = {
  lastWeekStart: string;
  lastWeekEnd: string;
  tasksCompleted: number;
  projectsCompleted: ProjectRef[];
  projectsStarted: ProjectRef[];
  /** Open tasks due Monday–Sunday of the meeting week on active reporting projects. */
  dueThisWeek: DueTask[];
};

/** What happened last week and what is due this week, from Teamwork data (reporting projects). */
export async function getWeekHighlights(weekStart: string): Promise<WeekHighlights> {
  const sql = getSqlClient();
  const lastWeekStart = addWeeks(weekStart, -1);
  const lastWeekEnd = shiftDays(weekStart, -1);
  const weekEnd = shiftDays(weekStart, 6);
  const [completedTasks, completedProjects, startedProjects, due] = await Promise.all([
    sql<{ count: number }[]>`
      select count(*)::int as count
      from tasks t
      join projects p on p.id = t.project_id
      where t.is_deleted = false and p.excluded_from_reporting = false
        and (t.completed_at at time zone 'America/New_York')::date
          between ${lastWeekStart}::date and ${lastWeekEnd}::date
    `,
    sql<ProjectRef[]>`
      select id, name, project_number as "projectNumber"
      from projects
      where excluded_from_reporting = false
        and (completed_at at time zone 'America/New_York')::date
          between ${lastWeekStart}::date and ${lastWeekEnd}::date
      order by name
    `,
    sql<ProjectRef[]>`
      select id, name, project_number as "projectNumber"
      from projects
      where excluded_from_reporting = false
        and start_date between ${lastWeekStart}::date and ${lastWeekEnd}::date
      order by name
    `,
    sql<DueTask[]>`
      select t.id, t.teamwork_id as "teamworkId", t.name, t.due_date::text as "dueDate",
        p.id as "projectId", p.name as "projectName", p.project_number as "projectNumber",
        coalesce(ta.labels, array[]::text[]) as assignees
      from tasks t
      join task_lists tl on tl.id = t.task_list_id and tl.is_deleted = false
      join projects p on p.id = t.project_id
      left join lateral (
        select array_agg(distinct coalesce(
          nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), a.label
        )) as labels
        from task_assignments a left join people person on person.id = a.person_id
        where a.task_id = t.id and coalesce(person.id::text, a.label) is not null
      ) ta on true
      where t.is_deleted = false and p.excluded_from_reporting = false
        and lower(trim(p.status)) = 'active' and p.archived_at is null and p.completed_at is null
        and t.completed_at is null
        and lower(trim(coalesce(t.status, ''))) not in ('complete', 'completed', 'closed')
        and t.due_date between ${weekStart}::date and ${weekEnd}::date
      order by t.due_date, p.name, t.name
      limit 80
    `,
  ]);
  return {
    lastWeekStart,
    lastWeekEnd,
    tasksCompleted: completedTasks[0]?.count ?? 0,
    projectsCompleted: completedProjects,
    projectsStarted: startedProjects,
    dueThisWeek: due,
  };
}
