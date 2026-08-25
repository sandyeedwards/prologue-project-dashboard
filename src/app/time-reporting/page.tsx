import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FlexibleDateRangeFields } from "@/components/flexible-date-range-fields";
import { TimeReportingHoverTrack } from "@/components/time-reporting-hover-track";
import { TimeReportingProjectFilter } from "@/components/time-reporting-project-filter";
import { MetricCard } from "@/components/reporting-ui";
import { requireUser } from "@/lib/auth/session";
import {
  getTimeReportingReport,
  type TimeReportingBreakdownRow,
} from "@/lib/reporting/time-reporting-data";
import type { TimeReportingCategory } from "@/lib/reporting/time-reporting-rules";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function hoursLabel(minutes: number): string {
  const value = minutes / 60;

  if (Number.isInteger(value)) {
    return `${value.toFixed(0)}h`;
  }

  return `${value.toFixed(1)}h`;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function percentageLabel(numerator: number, denominator: number): string {
  return `${percentage(numerator, denominator).toFixed(1)}%`;
}

function scaleWidth(minutes: number, scaleMinutes: number): string {
  if (scaleMinutes <= 0) return "0%";
  return `${(minutes / scaleMinutes) * 100}%`;
}

function dataCurrentLabel(value: Date | null): string {
  if (!value || Number.isNaN(value.valueOf())) {
    return "Not synchronized";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function dateRangeLabel(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(`${startDate}T00:00:00.000Z`))} \u2013 ${formatter.format(
    new Date(`${endDate}T00:00:00.000Z`),
  )}`;
}

function categoryLabel(category: TimeReportingCategory): string {
  switch (category) {
    case "BILLABLE":
      return "Billable";

    case "OFFICE_TIME":
      return "Office Time";

    case "OUT_OF_OFFICE":
      return "Out of Office";

    case "SPECIAL_INITIATIVES":
      return "Special Initiatives";

    case "OTHER_NON_BILLABLE":
      return "Other Non-Billable";
  }
}

function presetHref(
  preset: string,
  employeeIds: readonly string[],
  projectIds: readonly string[],
): string {
  const query = new URLSearchParams();

  query.set("preset", preset);

  for (const id of employeeIds) {
    query.append("employee", id);
  }

  for (const id of projectIds) {
    query.append("project", id);
  }

  return `/time-reporting?${query.toString()}`;
}

type BreakdownProject = {
  projectId: string;
  projectName: string;
  minutes: number;
  rows: TimeReportingBreakdownRow[];
};

function groupBreakdown(rows: readonly TimeReportingBreakdownRow[]): BreakdownProject[] {
  const groups = new Map<string, BreakdownProject>();

  for (const row of rows) {
    const existing = groups.get(row.projectId);

    if (existing) {
      existing.minutes += row.minutes;
      existing.rows.push(row);
      continue;
    }

    groups.set(row.projectId, {
      projectId: row.projectId,
      projectName: row.projectName,
      minutes: row.minutes,
      rows: [row],
    });
  }

  return [...groups.values()];
}

const presets = [
  { value: "week", label: "Week" },
  { value: "month", label: "Current Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
] as const;

export default async function TimeReportingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/time-reporting");
  const params = await searchParams;

  const report = await getTimeReportingReport({
    preset: one(params.preset),
    startDate: one(params.startDate),
    endDate: one(params.endDate),
    employeeIds: many(params.employee),
    projectIds: many(params.project),
  });

  const selectedEmployeeIds = report.filters.employeeIds;
  const selectedProjectIds = report.filters.projectIds;

  const billablePercent = percentage(report.totals.billableMinutes, report.totals.totalMinutes);

  const loggedVsExpectedPercent = percentage(
    report.totals.totalMinutes,
    report.totals.expectedMinutes,
  );

  const sharedExpectedMinutes = Math.max(
    ...report.employees.map((employee) => employee.expectedMinutes),
    1,
  );

  const maximumLoggedMinutes = Math.max(
    ...report.employees.map((employee) => employee.totalMinutes),
    0,
  );

  const sharedBarScaleMinutes =
    maximumLoggedMinutes > sharedExpectedMinutes
      ? Math.ceil(maximumLoggedMinutes * 1.04)
      : sharedExpectedMinutes;

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide time-reporting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Team utilization &amp; time intelligence</p>

            <h1>Time Reporting</h1>

            <p>
              Review employee hours, billable utilization, non-billable activity, time-entry
              expectations, and annual PTO usage.
            </p>

            <div className="time-reporting-title-meta">
              <strong>{dateRangeLabel(report.range.startDate, report.range.endDate)}</strong>

              <span>
                {report.employees.length} employee
                {report.employees.length === 1 ? "" : "s"} in view
              </span>
            </div>
          </div>

          <div className="report-titlebar__actions">
            <span className="report-date-chip">
              Data current through {dataCurrentLabel(report.dataCurrentAt)}
            </span>
          </div>
        </section>

        <nav className="time-reporting-subnav" aria-label="Time Reporting sections">
          <Link
            href="/time-reporting"
            className="time-reporting-subnav__item time-reporting-subnav__item--active"
          >
            <strong>Overview</strong>
            <span>Utilization &amp; employee time</span>
          </Link>

          <Link href="/time-reporting/pto" className="time-reporting-subnav__item">
            <strong>My PTO</strong>
            <span>My annual PTO balance</span>
          </Link>

          {session.user.role === "ADMIN" ? (
            <Link href="/time-reporting/pto/all" className="time-reporting-subnav__item">
              <strong>All PTO</strong>
              <span>Balances &amp; allowances</span>
            </Link>
          ) : null}
        </nav>

        <section
          className="time-reporting-controls time-reporting-controls--filters"
          aria-label="Time reporting filters"
        >
          <div className="time-reporting-controls__quick">
            <span className="time-reporting-controls__label">Filters</span>

            <div className="time-reporting-presets">
              {presets.map((preset) => (
                <Link
                  key={preset.value}
                  href={presetHref(preset.value, selectedEmployeeIds, selectedProjectIds)}
                  className={`time-reporting-preset${
                    report.range.preset === preset.value ? " time-reporting-preset--active" : ""
                  }`}
                >
                  {preset.label}
                </Link>
              ))}
            </div>
          </div>

          <form className="time-reporting-filter-form" action="/time-reporting" method="get">
            <input type="hidden" name="preset" value="custom" />

            <div className="time-reporting-filter-field">
              <span>Employees</span>

              <details className="time-reporting-filter-menu">
                <summary>
                  {selectedEmployeeIds.length
                    ? `${selectedEmployeeIds.length} selected`
                    : "All employees"}
                </summary>

                <div className="time-reporting-filter-menu__options">
                  {report.filterOptions.employees.map((employee) => (
                    <label key={employee.personId}>
                      <input
                        type="checkbox"
                        name="employee"
                        value={employee.personId}
                        defaultChecked={selectedEmployeeIds.includes(employee.personId)}
                      />

                      <span>{employee.name}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>

            <TimeReportingProjectFilter
              projects={report.filterOptions.projects}
              selected={selectedProjectIds}
            />

            <FlexibleDateRangeFields
              initialFrom={report.range.startDate}
              initialTo={report.range.endDate}
              fromName="startDate"
              toName="endDate"
              fromLabel="From"
              toLabel="Through"
              className="time-reporting-flexible-dates"
            />

            <div className="time-reporting-filter-actions">
              <button className="button button--primary button--compact" type="submit">
                Apply Filters
              </button>

              <Link className="button button--secondary button--compact" href="/time-reporting">
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="time-reporting-kpis" aria-label="Time reporting summary">
          <MetricCard
            priority="primary"
            label="Logged Hours"
            value={hoursLabel(report.totals.totalMinutes)}
            detail={`${hoursLabel(
              report.totals.expectedMinutes,
            )} expected \u00b7 ${loggedVsExpectedPercent.toFixed(1)}% logged`}
            help="Expected time is calculated at 8 hours per weekday through today. Weekends are excluded."
          />

          <MetricCard
            priority="primary"
            label="Billable Hours"
            value={hoursLabel(report.totals.billableMinutes)}
            detail={`${billablePercent.toFixed(1)}% of logged time`}
            accent="blue"
            help="All time logged outside Internal Operations is classified as billable for this report. The Teamwork billable flag is intentionally ignored."
          />

          <MetricCard
            priority="primary"
            label="Non-Billable Hours"
            value={hoursLabel(report.totals.nonBillableMinutes)}
            detail={`${percentageLabel(
              report.totals.nonBillableMinutes,
              report.totals.totalMinutes,
            )} of logged time`}
            accent="gray"
            help="All time logged to Internal Operations is non-billable and is divided into Office Time, Out of Office, Special Initiatives, and Other Non-Billable."
          />

          <MetricCard
            priority="primary"
            label="Utilization Rate"
            value={`${billablePercent.toFixed(1)}%`}
            detail="Billable share of logged time"
            accent="blue"
            help="Utilization is calculated as billable hours divided by total logged hours for the current filters."
          />
        </section>

        <section className="time-reporting-panel time-reporting-panel--bars">
          <div className="time-reporting-panel__header">
            <div>
              <p className="eyebrow">Billable status by employee</p>

              <h2>Total Hours by Billable Status</h2>

              <p>
                All employees use the same scale. The vertical target marker represents expected
                hours, while the full lane expands when anyone logs beyond that target so overtime
                never runs off the chart.
              </p>
            </div>

            <div className="time-reporting-legend" aria-label="Time category legend">
              <span>
                <i className="time-reporting-swatch time-reporting-swatch--billable" />
                Billable Hours
              </span>

              <span>
                <i className="time-reporting-swatch time-reporting-swatch--office" />
                Office Time
              </span>

              <span>
                <i className="time-reporting-swatch time-reporting-swatch--out" />
                Out of Office
              </span>

              <span>
                <i className="time-reporting-swatch time-reporting-swatch--special" />
                Special Initiatives
              </span>

              <span>
                <i className="time-reporting-swatch time-reporting-swatch--other" />
                Other Non-Billable
              </span>

              <span>
                <i className="time-reporting-target-key" />
                Expected Hours
              </span>
            </div>
          </div>

          <div className="time-reporting-bars">
            {report.employees.map((employee) => {
              const utilization = percentage(employee.billableMinutes, employee.totalMinutes);

              const expectedMarkerPercent = percentage(
                employee.expectedMinutes,
                sharedBarScaleMinutes,
              );

              return (
                <article className="time-reporting-row" key={employee.personId}>
                  <div className="time-reporting-row__identity">
                    <strong className="time-reporting-employee-name">{employee.name}</strong>

                    {employee.clericalWarning ? (
                      <span className="time-reporting-warning-group">
                        <span
                          className="time-reporting-warning"
                          title={`${employee.clericalPercent.toFixed(
                            1,
                          )}% of logged time is clerical`}
                          aria-label={`${employee.name} exceeds the clerical time threshold`}
                        >
                          !
                        </span>

                        <span className="time-reporting-warning-percent">
                          {employee.clericalPercent.toFixed(1)}%
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="time-reporting-row__chart">
                    <TimeReportingHoverTrack>
                      <div className="time-reporting-bar-shell">
                        <div
                          className="time-reporting-bar"
                          tabIndex={0}
                          aria-label={`${employee.name}: ${hoursLabel(
                            employee.totalMinutes,
                          )} logged against ${hoursLabel(employee.expectedMinutes)} expected`}
                        >
                          {employee.totalMinutes === 0 ? (
                            <span className="time-reporting-bar__empty-label">No time logged</span>
                          ) : (
                            <>
                              {employee.billableMinutes > 0 ? (
                                <span
                                  className="time-reporting-bar__segment time-reporting-bar__segment--billable"
                                  style={{
                                    width: scaleWidth(
                                      employee.billableMinutes,
                                      sharedBarScaleMinutes,
                                    ),
                                  }}
                                />
                              ) : null}

                              {employee.officeTimeMinutes > 0 ? (
                                <span
                                  className="time-reporting-bar__segment time-reporting-bar__segment--office"
                                  style={{
                                    width: scaleWidth(
                                      employee.officeTimeMinutes,
                                      sharedBarScaleMinutes,
                                    ),
                                  }}
                                />
                              ) : null}

                              {employee.outOfOfficeMinutes > 0 ? (
                                <span
                                  className="time-reporting-bar__segment time-reporting-bar__segment--out"
                                  style={{
                                    width: scaleWidth(
                                      employee.outOfOfficeMinutes,
                                      sharedBarScaleMinutes,
                                    ),
                                  }}
                                />
                              ) : null}

                              {employee.specialInitiativesMinutes > 0 ? (
                                <span
                                  className="time-reporting-bar__segment time-reporting-bar__segment--special"
                                  style={{
                                    width: scaleWidth(
                                      employee.specialInitiativesMinutes,
                                      sharedBarScaleMinutes,
                                    ),
                                  }}
                                />
                              ) : null}

                              {employee.otherNonBillableMinutes > 0 ? (
                                <span
                                  className="time-reporting-bar__segment time-reporting-bar__segment--other"
                                  style={{
                                    width: scaleWidth(
                                      employee.otherNonBillableMinutes,
                                      sharedBarScaleMinutes,
                                    ),
                                  }}
                                />
                              ) : null}
                            </>
                          )}

                          {employee.expectedMinutes > 0 ? (
                            <i
                              className="time-reporting-bar__expected-marker"
                              style={{
                                left: `${expectedMarkerPercent}%`,
                              }}
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div className="time-reporting-hover-card" role="tooltip">
                          <div className="time-reporting-hover-card__header">
                            <strong>{employee.name}</strong>

                            <span>
                              {dateRangeLabel(report.range.startDate, report.range.endDate)}
                            </span>
                          </div>

                          <div className="time-reporting-hover-card__summary">
                            <span>
                              Logged
                              <strong>{hoursLabel(employee.totalMinutes)}</strong>
                            </span>

                            <span>
                              Expected
                              <strong>{hoursLabel(employee.expectedMinutes)}</strong>
                            </span>

                            <span>
                              Utilization
                              <strong>{utilization.toFixed(1)}%</strong>
                            </span>
                          </div>

                          <div className="time-reporting-hover-card__rows">
                            <span>
                              <i className="time-reporting-swatch time-reporting-swatch--billable" />
                              Billable
                              <strong>{hoursLabel(employee.billableMinutes)}</strong>
                            </span>

                            <span>
                              <i className="time-reporting-swatch time-reporting-swatch--office" />
                              Office Time
                              <strong>{hoursLabel(employee.officeTimeMinutes)}</strong>
                            </span>

                            <span>
                              <i className="time-reporting-swatch time-reporting-swatch--out" />
                              Out of Office
                              <strong>{hoursLabel(employee.outOfOfficeMinutes)}</strong>
                            </span>

                            <span>
                              <i className="time-reporting-swatch time-reporting-swatch--special" />
                              Special Initiatives
                              <strong>{hoursLabel(employee.specialInitiativesMinutes)}</strong>
                            </span>

                            <span>
                              <i className="time-reporting-swatch time-reporting-swatch--other" />
                              Other Non-Billable
                              <strong>{hoursLabel(employee.otherNonBillableMinutes)}</strong>
                            </span>

                            <span>
                              Logged vs Expected
                              <strong>
                                {employee.loggedVsExpectedPercent === null
                                  ? "N/A"
                                  : `${employee.loggedVsExpectedPercent.toFixed(1)}%`}
                              </strong>
                            </span>

                            {employee.clericalMinutes > 0 ? (
                              <span
                                className={
                                  employee.clericalWarning
                                    ? "time-reporting-hover-card__warning"
                                    : undefined
                                }
                              >
                                Clerical
                                <strong>
                                  {hoursLabel(employee.clericalMinutes)} (
                                  {employee.clericalPercent.toFixed(1)}
                                  %)
                                </strong>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TimeReportingHoverTrack>

                    <div className="time-reporting-row__detail">
                      <span className="time-reporting-row__logged">
                        Logged <strong>{hoursLabel(employee.totalMinutes)}</strong>
                      </span>

                      <span>{hoursLabel(employee.expectedMinutes)} expected</span>

                      <span>
                        {employee.loggedVsExpectedPercent === null
                          ? "N/A"
                          : `${employee.loggedVsExpectedPercent.toFixed(1)}% logged`}
                      </span>

                      <span>Utilization {utilization.toFixed(1)}%</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="time-reporting-panel">
          <div className="time-reporting-panel__header">
            <div>
              <p className="eyebrow">Employee breakdown</p>

              <h2>Employee Time Details</h2>

              <p>
                Every employee in the current filter view is listed below. Open an employee to
                review where their time was logged by project, task list, task, and reporting
                category.
              </p>
            </div>
          </div>

          <div className="time-reporting-employee-breakdowns">
            {report.breakdowns.map((breakdown) => {
              const projects = groupBreakdown(breakdown.rows);

              const utilization = percentage(
                breakdown.employee.billableMinutes,
                breakdown.employee.totalMinutes,
              );

              return (
                <details
                  className="time-reporting-employee-breakdown"
                  key={breakdown.employee.personId}
                >
                  <summary>
                    <div className="time-reporting-employee-breakdown__identity">
                      <strong>{breakdown.employee.name}</strong>

                      <span>
                        Logged {hoursLabel(breakdown.totalMinutes)}
                        {" \u00b7 "}
                        Utilization {utilization.toFixed(1)}%
                      </span>
                    </div>

                    <span className="time-reporting-employee-breakdown__projects">
                      {projects.length} project
                      {projects.length === 1 ? "" : "s"}
                    </span>
                  </summary>

                  {projects.length ? (
                    <div className="time-reporting-breakdown">
                      {projects.map((project) => (
                        <details
                          className="time-reporting-breakdown__project"
                          key={project.projectId}
                        >
                          <summary>
                            <strong>{project.projectName}</strong>

                            <span>{hoursLabel(project.minutes)}</span>
                          </summary>

                          <div className="time-reporting-breakdown__table-wrap">
                            <table className="time-reporting-breakdown__table">
                              <thead>
                                <tr>
                                  <th>Task List</th>
                                  <th>Task</th>
                                  <th>Category</th>
                                  <th>Hours</th>
                                </tr>
                              </thead>

                              <tbody>
                                {project.rows.map((row, rowIndex) => (
                                  <tr
                                    key={`${project.projectId}-${row.taskListName ?? "none"}-${row.taskName ?? "none"}-${rowIndex}`}
                                  >
                                    <td>{row.taskListName ?? "No task list"}</td>

                                    <td>{row.taskName ?? "No cached task"}</td>

                                    <td>
                                      <span
                                        className={`time-reporting-category time-reporting-category--${row.category
                                          .toLowerCase()
                                          .replaceAll("_", "-")}`}
                                      >
                                        {categoryLabel(row.category)}
                                      </span>
                                    </td>

                                    <td>
                                      <strong>{hoursLabel(row.minutes)}</strong>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <div className="time-reporting-panel__empty">
                      No time was logged by this employee for the current filters.
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
