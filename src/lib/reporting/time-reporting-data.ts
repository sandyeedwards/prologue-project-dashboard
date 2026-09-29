import { REPORTING_RULES } from "@/config/reporting-rules";
import { getSqlClient } from "@/db/client";
import {
  DEFAULT_PTO_ALLOWANCE_MINUTES,
  TIME_REPORTING_SOURCE_NAMES,
  classifyTimeReportingEntry,
  clericalShare,
  currentTimeReportingDate,
  expectedMinutesForRange,
  resolveTimeReportingRange,
  type TimeReportingCategory,
  type TimeReportingRange,
} from "./time-reporting-rules";

export type TimeReportingEmployeeRow = {
  personId: string;
  teamworkId: number;
  name: string;
  email: string | null;

  totalMinutes: number;
  billableMinutes: number;
  officeTimeMinutes: number;
  outOfOfficeMinutes: number;
  specialInitiativesMinutes: number;
  otherNonBillableMinutes: number;
  nonBillableMinutes: number;

  expectedMinutes: number;
  loggedVsExpectedPercent: number | null;

  clericalMinutes: number;
  clericalPercent: number;
  clericalWarning: boolean;

  ptoUsedMinutes: number;
  ptoAllowanceMinutes: number;
  ptoRemainingMinutes: number;
};

export type TimeReportingEmployeeFilterOption = {
  personId: string;
  name: string;
};

export type TimeReportingProjectFilterOption = {
  projectId: string;
  name: string;
};

export type TimeReportingBreakdownRow = {
  projectId: string;
  projectName: string;
  taskListName: string | null;
  taskName: string | null;
  category: TimeReportingCategory;
  minutes: number;
};

export type TimeReportingBreakdown = {
  employee: TimeReportingEmployeeRow;
  rows: TimeReportingBreakdownRow[];
  totalMinutes: number;
};

export type TimeReportingTotals = {
  totalMinutes: number;
  billableMinutes: number;
  officeTimeMinutes: number;
  outOfOfficeMinutes: number;
  specialInitiativesMinutes: number;
  otherNonBillableMinutes: number;
  nonBillableMinutes: number;
  expectedMinutes: number;
};

export type TimeReportingReport = {
  range: TimeReportingRange;
  ptoYear: number;
  dataCurrentAt: Date | null;

  filters: {
    employeeIds: string[];
    projectIds: string[];
  };

  filterOptions: {
    employees: TimeReportingEmployeeFilterOption[];
    projects: TimeReportingProjectFilterOption[];
  };

  employees: TimeReportingEmployeeRow[];
  totals: TimeReportingTotals;
  breakdowns: TimeReportingBreakdown[];
};

type TimeReportingDbRow = {
  personId: string;
  teamworkId: string | number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;

  totalMinutes: number | string | null;
  billableMinutes: number | string | null;
  officeTimeMinutes: number | string | null;
  outOfOfficeMinutes: number | string | null;
  specialInitiativesMinutes: number | string | null;
  otherNonBillableMinutes: number | string | null;
  clericalMinutes: number | string | null;

  ptoUsedMinutes: number | string | null;
  ptoAllowanceMinutes: number | string | null;
};

type EmployeeOptionDbRow = {
  personId: string;
  teamworkId: string | number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type ProjectOptionDbRow = {
  projectId: string;
  name: string;
};

type BreakdownDbRow = {
  personId: string;
  projectId: string;
  projectName: string;
  taskListName: string | null;
  taskName: string | null;
  minutes: number | string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanUuid(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function cleanUuidList(values: readonly string[] | undefined): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => cleanUuid(value))
        .filter((value): value is string => value !== null),
    ),
  ];
}

function integer(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function displayName(input: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  teamworkId: string | number;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  return name || input.email || `Teamwork User ${String(input.teamworkId)}`;
}

function reportingKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function getTimeReportingReport(
  input: {
    preset?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    employeeIds?: readonly string[];
    projectIds?: readonly string[];
    now?: Date;
  } = {},
): Promise<TimeReportingReport> {
  const now = input.now ?? new Date();

  const range = resolveTimeReportingRange(
    {
      preset: input.preset,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    now,
  );

  const selectedEmployeeIds = cleanUuidList(input.employeeIds);
  const selectedProjectIds = cleanUuidList(input.projectIds);
  const employeeFilterCsv = selectedEmployeeIds.join(",");
  const projectFilterCsv = selectedProjectIds.join(",");

  const today = currentTimeReportingDate(now);
  const expectedMinutes = expectedMinutesForRange(range, today);

  const ptoYear = Number.parseInt(range.endDate.slice(0, 4), 10);
  const ptoYearStart = `${ptoYear}-01-01`;
  const ptoNextYearStart = `${ptoYear + 1}-01-01`;

  const internalProjectName = reportingKey(REPORTING_RULES.timeReportingProjectName);
  const officeTime = reportingKey(TIME_REPORTING_SOURCE_NAMES.officeTime);
  const outOfOffice = reportingKey(TIME_REPORTING_SOURCE_NAMES.outOfOffice);
  const specialInitiatives = reportingKey(TIME_REPORTING_SOURCE_NAMES.specialInitiatives);
  const ptoTask = reportingKey(TIME_REPORTING_SOURCE_NAMES.pto);
  const clericalTask = reportingKey(TIME_REPORTING_SOURCE_NAMES.clerical);

  const sql = getSqlClient();

  const employeeOptionRows = (await sql`
    select
      person.id as "personId",
      person.teamwork_id as "teamworkId",
      person.first_name as "firstName",
      person.last_name as "lastName",
      person.email
    from people person
    where person.is_active = true
      and person.is_client_user = false
      and person.is_service_account = false
    order by
      lower(coalesce(person.first_name, '')),
      lower(coalesce(person.last_name, '')),
      person.teamwork_id
  `) as unknown as EmployeeOptionDbRow[];

  const projectOptionRows = (await sql`
    select distinct
      project.id as "projectId",
      project.name
    from time_entries te
    join projects project
      on project.id = te.project_id
    where te.is_deleted = false
      and te.person_id is not null
    order by project.name
  `) as unknown as ProjectOptionDbRow[];

  const rows = (await sql`
    with selected_time as (
      select
        te.person_id,

        coalesce(sum(te.minutes), 0)::integer as "totalMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) <> ${internalProjectName}
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "billableMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) = ${internalProjectName}
                and lower(trim(coalesce(task_list.name, ''))) = ${officeTime}
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "officeTimeMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) = ${internalProjectName}
                and lower(trim(coalesce(task_list.name, ''))) = ${outOfOffice}
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "outOfOfficeMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) = ${internalProjectName}
                and lower(trim(coalesce(task_list.name, ''))) = ${specialInitiatives}
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "specialInitiativesMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) = ${internalProjectName}
                and lower(trim(coalesce(task_list.name, ''))) not in (
                  ${officeTime},
                  ${outOfOffice},
                  ${specialInitiatives}
                )
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "otherNonBillableMinutes",

        coalesce(
          sum(
            case
              when lower(trim(project.name)) = ${internalProjectName}
                and lower(trim(coalesce(task_list.name, ''))) = ${officeTime}
                and lower(trim(coalesce(task.name, ''))) = ${clericalTask}
                then te.minutes
              else 0
            end
          ),
          0
        )::integer as "clericalMinutes"

      from time_entries te

      join projects project
        on project.id = te.project_id

      left join tasks task
        on task.id = te.task_id

      left join task_lists task_list
        on task_list.id = task.task_list_id

      where te.is_deleted = false
        and te.person_id is not null
        and te.logged_date >= ${range.startDate}::date
        and te.logged_date <= ${range.endDate}::date

        and (
          ${employeeFilterCsv} = ''
          or te.person_id = any(
            string_to_array(nullif(${employeeFilterCsv}, ''), ',')::uuid[]
          )
        )

        and (
          ${projectFilterCsv} = ''
          or te.project_id = any(
            string_to_array(nullif(${projectFilterCsv}, ''), ',')::uuid[]
          )
        )

      group by te.person_id
    ),

    annual_pto as (
      select
        te.person_id,
        coalesce(sum(te.minutes), 0)::integer as "ptoUsedMinutes"

      from time_entries te

      join projects project
        on project.id = te.project_id

      join tasks task
        on task.id = te.task_id

      join task_lists task_list
        on task_list.id = task.task_list_id

      where te.is_deleted = false
        and te.person_id is not null
        and te.logged_date >= ${ptoYearStart}::date
        and te.logged_date < ${ptoNextYearStart}::date
        and lower(trim(project.name)) = ${internalProjectName}
        and lower(trim(task_list.name)) = ${outOfOffice}
        and lower(trim(task.name)) = ${ptoTask}

      group by te.person_id
    )

    select
      person.id as "personId",
      person.teamwork_id as "teamworkId",
      person.first_name as "firstName",
      person.last_name as "lastName",
      person.email,

      coalesce(selected_time."totalMinutes", 0)::integer as "totalMinutes",
      coalesce(selected_time."billableMinutes", 0)::integer as "billableMinutes",
      coalesce(selected_time."officeTimeMinutes", 0)::integer as "officeTimeMinutes",
      coalesce(selected_time."outOfOfficeMinutes", 0)::integer as "outOfOfficeMinutes",
      coalesce(
        selected_time."specialInitiativesMinutes",
        0
      )::integer as "specialInitiativesMinutes",
      coalesce(
        selected_time."otherNonBillableMinutes",
        0
      )::integer as "otherNonBillableMinutes",
      coalesce(selected_time."clericalMinutes", 0)::integer as "clericalMinutes",

      coalesce(annual_pto."ptoUsedMinutes", 0)::integer as "ptoUsedMinutes",

      coalesce(
        allowance.allowance_minutes,
        ${DEFAULT_PTO_ALLOWANCE_MINUTES}
      )::integer as "ptoAllowanceMinutes"

    from people person

    left join selected_time
      on selected_time.person_id = person.id

    left join annual_pto
      on annual_pto.person_id = person.id

    left join pto_allowance_overrides allowance
      on allowance.person_id = person.id
      and allowance.calendar_year = ${ptoYear}

    where person.is_active = true
      and person.is_client_user = false
      and person.is_service_account = false
      and (
        ${employeeFilterCsv} = ''
        or person.id = any(
          string_to_array(nullif(${employeeFilterCsv}, ''), ',')::uuid[]
        )
      )

    order by
      lower(coalesce(person.first_name, '')),
      lower(coalesce(person.last_name, '')),
      person.teamwork_id
  `) as unknown as TimeReportingDbRow[];

  const employees = rows.map((row) => {
    const totalMinutes = integer(row.totalMinutes);
    const billableMinutes = integer(row.billableMinutes);
    const officeTimeMinutes = integer(row.officeTimeMinutes);
    const outOfOfficeMinutes = integer(row.outOfOfficeMinutes);
    const specialInitiativesMinutes = integer(row.specialInitiativesMinutes);
    const otherNonBillableMinutes = integer(row.otherNonBillableMinutes);
    const clericalMinutes = integer(row.clericalMinutes);

    const ptoUsedMinutes = integer(row.ptoUsedMinutes);
    const ptoAllowanceMinutes = integer(row.ptoAllowanceMinutes);

    const nonBillableMinutes =
      officeTimeMinutes + outOfOfficeMinutes + specialInitiativesMinutes + otherNonBillableMinutes;

    const clerical = clericalShare(clericalMinutes, totalMinutes);

    return {
      personId: row.personId,
      teamworkId: Number(row.teamworkId),
      name: displayName(row),
      email: row.email,

      totalMinutes,
      billableMinutes,
      officeTimeMinutes,
      outOfOfficeMinutes,
      specialInitiativesMinutes,
      otherNonBillableMinutes,
      nonBillableMinutes,

      expectedMinutes,
      loggedVsExpectedPercent: expectedMinutes > 0 ? (totalMinutes / expectedMinutes) * 100 : null,

      clericalMinutes,
      clericalPercent: clerical.percent,
      clericalWarning: clerical.warning,

      ptoUsedMinutes,
      ptoAllowanceMinutes,
      ptoRemainingMinutes: ptoAllowanceMinutes - ptoUsedMinutes,
    } satisfies TimeReportingEmployeeRow;
  });

  const totals = employees.reduce<TimeReportingTotals>(
    (sum, row) => ({
      totalMinutes: sum.totalMinutes + row.totalMinutes,
      billableMinutes: sum.billableMinutes + row.billableMinutes,
      officeTimeMinutes: sum.officeTimeMinutes + row.officeTimeMinutes,
      outOfOfficeMinutes: sum.outOfOfficeMinutes + row.outOfOfficeMinutes,
      specialInitiativesMinutes: sum.specialInitiativesMinutes + row.specialInitiativesMinutes,
      otherNonBillableMinutes: sum.otherNonBillableMinutes + row.otherNonBillableMinutes,
      nonBillableMinutes: sum.nonBillableMinutes + row.nonBillableMinutes,
      expectedMinutes: sum.expectedMinutes + row.expectedMinutes,
    }),
    {
      totalMinutes: 0,
      billableMinutes: 0,
      officeTimeMinutes: 0,
      outOfOfficeMinutes: 0,
      specialInitiativesMinutes: 0,
      otherNonBillableMinutes: 0,
      nonBillableMinutes: 0,
      expectedMinutes: 0,
    },
  );

  const breakdownDbRows = (await sql`
    select
      te.person_id as "personId",
      project.id as "projectId",
      project.name as "projectName",
      task_list.name as "taskListName",
      task.name as "taskName",
      coalesce(sum(te.minutes), 0)::integer as minutes

    from time_entries te

    join projects project
      on project.id = te.project_id

    left join tasks task
      on task.id = te.task_id

    left join task_lists task_list
      on task_list.id = task.task_list_id

    where te.is_deleted = false
      and te.person_id is not null
      and te.logged_date >= ${range.startDate}::date
      and te.logged_date <= ${range.endDate}::date

      and (
        ${employeeFilterCsv} = ''
        or te.person_id = any(
          string_to_array(nullif(${employeeFilterCsv}, ''), ',')::uuid[]
        )
      )

      and (
        ${projectFilterCsv} = ''
        or te.project_id = any(
          string_to_array(nullif(${projectFilterCsv}, ''), ',')::uuid[]
        )
      )

    group by
      te.person_id,
      project.id,
      project.name,
      task_list.name,
      task.name

    order by
      te.person_id,
      project.name,
      task_list.name nulls last,
      task.name nulls last
  `) as unknown as BreakdownDbRow[];

  const breakdownRowsByPerson = new Map<string, TimeReportingBreakdownRow[]>();

  for (const row of breakdownDbRows) {
    const rowsForPerson = breakdownRowsByPerson.get(row.personId) ?? [];

    rowsForPerson.push({
      projectId: row.projectId,
      projectName: row.projectName,
      taskListName: row.taskListName,
      taskName: row.taskName,
      category: classifyTimeReportingEntry({
        projectName: row.projectName,
        taskListName: row.taskListName,
      }),
      minutes: integer(row.minutes),
    });

    breakdownRowsByPerson.set(row.personId, rowsForPerson);
  }

  const breakdowns = employees.map((employee): TimeReportingBreakdown => {
    const breakdownRows = breakdownRowsByPerson.get(employee.personId) ?? [];

    return {
      employee,
      rows: breakdownRows,
      totalMinutes: breakdownRows.reduce((sum, row) => sum + row.minutes, 0),
    };
  });

  const syncRows = (await sql`
    select max(last_sync_at) as "lastSyncAt"
    from teamwork_connections
    where is_active = true
  `) as unknown as Array<{
    lastSyncAt: Date | string | null;
  }>;

  const rawLastSyncAt = syncRows[0]?.lastSyncAt ?? null;
  const parsedLastSyncAt =
    rawLastSyncAt instanceof Date ? rawLastSyncAt : rawLastSyncAt ? new Date(rawLastSyncAt) : null;

  return {
    range,
    ptoYear,
    dataCurrentAt:
      parsedLastSyncAt && !Number.isNaN(parsedLastSyncAt.valueOf()) ? parsedLastSyncAt : null,

    filters: {
      employeeIds: selectedEmployeeIds,
      projectIds: selectedProjectIds,
    },

    filterOptions: {
      employees: employeeOptionRows.map((row) => ({
        personId: row.personId,
        name: displayName(row),
      })),
      projects: projectOptionRows.map((row) => ({
        projectId: row.projectId,
        name: row.name,
      })),
    },

    employees,
    totals,
    breakdowns,
  };
}
