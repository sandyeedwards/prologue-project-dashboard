import { getSqlClient } from "@/db/client";
import { getDealPipelines, searchOpenDeals } from "@/lib/hosting/hubspot";
import { getMeetingReport } from "@/lib/reporting/mmm-data";
import { getTimeReportingReport } from "@/lib/reporting/time-reporting-data";
import { currentTimeReportingDate } from "@/lib/reporting/time-reporting-rules";
import { carryForward, addWeeks, emptyNotes, parseNotes, type AllHandsNotes } from "./agenda";
import { summarizePipelines, type PipelineSummary } from "./pipeline";

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
  { ok: true; pipelines: PipelineSummary[]; loadedAt: Date } | { ok: false; message: string };

const PIPELINE_CACHE_MS = 10 * 60_000;
let pipelineCache: { at: number; value: PipelineState } | null = null;

/** Open HubSpot deals, read-only. Failures are reported, never shown as an empty pipeline. */
export async function getPipelineState(now = new Date()): Promise<PipelineState> {
  if (pipelineCache && now.getTime() - pipelineCache.at < PIPELINE_CACHE_MS)
    return pipelineCache.value;
  let value: PipelineState;
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    value = { ok: false, message: "HubSpot is not connected (no access token is set)." };
  } else {
    try {
      const [pipelines, deals] = await Promise.all([
        getDealPipelines(),
        searchOpenDeals(["dealname", "amount", "dealstage", "pipeline", "closedate"]),
      ]);
      value = {
        ok: true,
        pipelines: summarizePipelines(deals, pipelines, currentTimeReportingDate(now)),
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
      pipelineCache = { at: now.getTime() - PIPELINE_CACHE_MS + 60_000, value };
      return value;
    }
  }
  pipelineCache = { at: now.getTime(), value };
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
  /** Per person: only filled in for Managers and Admins, like Time Reporting. */
  people: Array<{ name: string; totalMinutes: number; billableMinutes: number }> | null;
};

/** The week before the meeting: billable ÷ logged, the same rule as Time Reporting. */
export async function getLastWeekUtilization(
  weekStart: string,
  canSeePeople: boolean,
): Promise<UtilizationSnapshot> {
  const startDate = addWeeks(weekStart, -1);
  const endDate = addWeeks(weekStart, 0);
  const lastDay = new Date(`${endDate}T00:00:00.000Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  const report = await getTimeReportingReport({
    preset: "custom",
    startDate,
    endDate: lastDay.toISOString().slice(0, 10),
  });
  return {
    startDate: report.range.startDate,
    endDate: report.range.endDate,
    totalMinutes: report.totals.totalMinutes,
    billableMinutes: report.totals.billableMinutes,
    expectedMinutes: report.totals.expectedMinutes,
    people: canSeePeople
      ? report.employees
          .filter((employee) => employee.totalMinutes > 0)
          .map((employee) => ({
            name: employee.name,
            totalMinutes: employee.totalMinutes,
            billableMinutes: employee.billableMinutes,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : null,
  };
}

export async function getLastSyncAt(): Promise<Date | null> {
  const rows = await getSqlClient()<{ lastSyncAt: Date | null }[]>`
    select max(last_sync_at) as "lastSyncAt" from teamwork_connections where is_active = true
  `;
  return rows[0]?.lastSyncAt ?? null;
}
