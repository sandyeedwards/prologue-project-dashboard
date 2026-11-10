import { getSqlClient } from "@/db/client";
import { getDealNames } from "@/lib/hosting/hubspot";
import { findHubSpotDealReference, hubSpotDealUrl } from "./hubspot-deal-link";
import { getProjectRows, normalizeDatabaseDate } from "./dashboard-data";
import {
  buildMeetingProjects,
  isActiveMeetingProject,
  meetingWindow,
  type MeetingProjectSource,
  type MeetingTask,
} from "./mmm-report";

export async function getMeetingReport(now = new Date()) {
  const sql = getSqlClient();
  const window = meetingWindow(now);
  // Include active source projects even when they have no calculation yet.
  const [sources, metrics] = await Promise.all([
    sql<MeetingProjectSource[]>`
      select p.id, p.teamwork_id as "teamworkId", p.name, p.project_number as "projectNumber",
        c.name as "companyName", nullif(trim(concat_ws(' ', owner.first_name, owner.last_name)), '') as owner,
        p.status, p.start_date as "startDate", p.end_date as "endDate",
        p.archived_at as "archivedAt", p.completed_at as "completedAt", p.last_synced_at as "lastSyncedAt"
      from projects p left join companies c on c.id=p.company_id
      left join people owner on owner.id=p.owner_person_id
      where p.excluded_from_reporting=false and lower(trim(p.status))='active'
        and p.archived_at is null and p.completed_at is null
      order by p.name
    `,
    getProjectRows(),
  ]);
  const active = sources.filter(isActiveMeetingProject);
  if (!active.length) return { projects: [], window };
  const ids = active.map((row) => row.id);
  const [taskRows, activity] = await Promise.all([
    sql<MeetingTask[]>`
      select t.id, t.project_id as "projectId", t.teamwork_id as "teamworkId", t.parent_task_id as "parentTaskId",
        t.name, tl.name as "taskListName", tl.operational_group as "group", t.status,
        t.due_date as "dueDate", t.completed_at as "completedAt",
        coalesce(ta.labels, array[]::text[]) as assignees,
        coalesce(te.minutes, 0)::int as "ownLoggedMinutes", coalesce(te.last_week, 0)::int as "lastWeekMinutes",
        tm.counted_estimated_minutes as "countedEstimatedMinutes", tm.branch_logged_minutes as "branchLoggedMinutes",
        tm.remaining_minutes as "remainingMinutes", tm.is_canonical_holder as "isCanonicalHolder",
        tm.is_branch_complete as "isBranchComplete", coalesce(tm.is_outsourced, false) as "isOutsourced",
        tm.details->>'coveredByCanonicalTaskId' as "coveredByTaskId", (tm.task_id is not null) as "metricsAvailable"
      from tasks t inner join task_lists tl on tl.id=t.task_list_id
      left join project_metrics pm on pm.project_id=t.project_id
      left join task_metrics tm on tm.task_id=t.id and tm.calculation_run_id=pm.calculation_run_id
      left join lateral (
        select array_agg(distinct coalesce(nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), a.label, 'Unresolved assignment')) as labels
        from task_assignments a left join people person on person.id=a.person_id where a.task_id=t.id
      ) ta on true
      left join lateral (
        select sum(minutes)::int as minutes,
          sum(minutes) filter(where logged_date >= ${window.lastWeekStart}::date and logged_date <= ${window.lastWeekEnd}::date)::int as last_week
        from time_entries where task_id=t.id and is_deleted=false
      ) te on true
      where t.project_id in ${sql(ids)} and t.is_deleted=false and tl.is_deleted=false
      order by tl.operational_group, tl.name, t.name, t.id
    `,
    sql<Array<{ projectId: string; lastWeekMinutes: number; unallocatedMinutes: number }>>`
      select project_id as "projectId",
        coalesce(sum(minutes) filter(where logged_date >= ${window.lastWeekStart}::date and logged_date <= ${window.lastWeekEnd}::date),0)::int as "lastWeekMinutes",
        coalesce(sum(minutes) filter(where task_id is null),0)::int as "unallocatedMinutes"
      from time_entries where project_id in ${sql(ids)} and is_deleted=false group by project_id
    `,
  ]);
  const dealLinks = await getLinkedHubSpotDeals(ids);
  const tasks = taskRows.map((task) => ({
    ...task,
    completedAt: task.completedAt ? normalizeDatabaseDate(task.completedAt) : null,
  }));
  const normalizedSources = active.map((source) => ({
    ...source,
    lastSyncedAt: source.lastSyncedAt ? normalizeDatabaseDate(source.lastSyncedAt) : null,
    hubspotDeal: dealLinks.get(source.id) ?? null,
  }));
  return {
    projects: buildMeetingProjects(normalizedSources, metrics, tasks, activity, now),
    window,
  };
}

// Resolve the HubSpot deal linked to each project. Names come from imported hosting deals first,
// then a read-only HubSpot lookup. A lookup failure never hides the meeting report.
async function getLinkedHubSpotDeals(projectIds: readonly string[]) {
  const sql = getSqlClient();
  const links = new Map<string, { id: string; name: string | null; url: string | null }>();
  if (!projectIds.length) return links;
  const rows = await sql<Array<{ id: string; raw: unknown }>>`
    select id, raw from projects where id in ${sql([...projectIds])}
  `;
  const dealIdByProject = new Map<string, string>();
  for (const row of rows) {
    const reference = findHubSpotDealReference(row.raw);
    if (reference) dealIdByProject.set(row.id, reference.dealId);
  }
  const dealIds = [...new Set(dealIdByProject.values())];
  const names = new Map<string, string>();
  if (dealIds.length) {
    const known = await sql<Array<{ id: string; name: string | null }>>`
      select hubspot_deal_id as id, coalesce(nullif(trim(deal_name), ''), nullif(trim(site_name), '')) as name
      from hosting_deals where hubspot_deal_id in ${sql(dealIds)}
    `;
    for (const deal of known) if (deal.name) names.set(deal.id, deal.name);
    const missing = dealIds.filter((id) => !names.has(id));
    if (missing.length && process.env.HUBSPOT_ACCESS_TOKEN) {
      try {
        for (const [id, name] of await getDealNames(missing)) names.set(id, name);
      } catch (error) {
        console.warn("MMM HubSpot deal-name lookup skipped:", (error as Error).message);
      }
    }
  }
  for (const [projectId, dealId] of dealIdByProject)
    links.set(projectId, {
      id: dealId,
      name: names.get(dealId) ?? null,
      url: hubSpotDealUrl(dealId, process.env.HUBSPOT_PORTAL_ID?.trim() || undefined),
    });
  return links;
}
