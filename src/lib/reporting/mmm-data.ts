import { getSqlClient } from "@/db/client";
import { getProjectRows, normalizeDatabaseDate, projectJobType } from "./dashboard-data";
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
        p.archived_at as "archivedAt", p.completed_at as "completedAt", p.last_synced_at as "lastSyncedAt",
        p.project_type as "projectType", coalesce(tg.tags, array[]::text[]) as tags
      from projects p left join companies c on c.id=p.company_id
      left join people owner on owner.id=p.owner_person_id
      left join lateral (
        select array_agg(t.name order by t.name) as tags
        from project_tags pt join tags t on t.id = pt.tag_id
        where pt.project_id = p.id
      ) tg on true
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
        tm.details->>'coveredByCanonicalTaskId' as "coveredByTaskId", (tm.task_id is not null) as "metricsAvailable",
        t.estimated_minutes as "ownEstimatedMinutes",
        coalesce((
          select array_agg(tg.name order by tg.name)
          from jsonb_array_elements_text(
            case when jsonb_typeof(t.raw->'tagIds') = 'array' then t.raw->'tagIds' else '[]'::jsonb end
          ) tag_id
          join tags tg on tg.teamwork_id::text = tag_id
        ), array[]::text[]) as tags
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
  const tasks = taskRows.map((task) => ({
    ...task,
    completedAt: task.completedAt ? normalizeDatabaseDate(task.completedAt) : null,
  }));
  const normalizedSources = active.map((source) => ({
    ...source,
    lastSyncedAt: source.lastSyncedAt ? normalizeDatabaseDate(source.lastSyncedAt) : null,
    jobType: projectJobType(source),
  }));
  return {
    projects: buildMeetingProjects(normalizedSources, metrics, tasks, activity, now),
    window,
  };
}
