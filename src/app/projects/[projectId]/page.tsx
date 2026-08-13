import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChartPanel, CostPerformanceChart, GroupedBarChart } from "@/components/reporting-charts";
import { ProjectFinancialPosition } from "@/components/project-financial-position";
import {
  CoverageBadge,
  MarginBadge,
  MarginText,
  MetricCard,
  ProvisionalNotice,
} from "@/components/reporting-ui";
import { requireUser } from "@/lib/auth/session";
import {
  getProjectById,
  getProjectTypeFacets,
  getProjectExpenses,
  getProjectGroups,
  getProjectQualityIssues,
  getProjectTasks,
  getProjectUnplannedWork,
} from "@/lib/reporting/dashboard-data";
import { dateLabel, hours, money, percent } from "@/lib/reporting/format";
import { buildMobAreaBreakdown } from "@/lib/reporting/mob-area-breakdown";
import { dismissAllUnplannedWork, dismissUnplannedWork, reopenUnplannedWork } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numeric(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const session = await requireUser(`/projects/${projectId}`);
  const project = await getProjectById(projectId);
  if (!project) notFound();
  const [groups, tasks, expenses, issues, unplannedWork, query] = await Promise.all([
    getProjectGroups(projectId),
    getProjectTasks(projectId),
    getProjectExpenses(projectId),
    getProjectQualityIssues(projectId),
    getProjectUnplannedWork(projectId),
    searchParams,
  ]);
  const projectTypes = getProjectTypeFacets(project);
  const specialProjectKind = projectTypes.includes("Ready Set")
    ? "READY_SET"
    : projectTypes.includes("DataHall")
      ? "DATA_HALL"
      : null;
  const mobAreaBreakdowns = specialProjectKind
    ? buildMobAreaBreakdown({
        kind: specialProjectKind,
        tasks,
        expenses,
      })
    : [];
  const requestedMobArea = one(query.mobArea)?.trim();
  const selectedMobArea =
    mobAreaBreakdowns.find((row) => row.name === requestedMobArea) ?? mobAreaBreakdowns[0] ?? null;
  const isArchived = project.archivedAt !== null || project.status.toLowerCase() === "archived";
  const clientFee = numeric(project.clientFee);
  const actualTotalCost = numeric(project.actualTotalCost);
  const forecastCost = numeric(project.forecastCost);
  const remainingCost =
    forecastCost === null || actualTotalCost === null
      ? null
      : Math.max(forecastCost - actualTotalCost, 0);
  const actualProfit =
    clientFee === null || actualTotalCost === null ? null : clientFee - actualTotalCost;
  const actualMargin =
    clientFee === null || clientFee === 0 || actualProfit === null
      ? null
      : (actualProfit / clientFee) * 100;
  const taskQuery = one(query.task)?.trim().toLowerCase() ?? "";
  const groupFilter = one(query.group) ?? "ALL";
  const coverageFilter = one(query.coverage) ?? "ALL";
  const visibleGroups = groups.filter((group) => group.groupName !== "Unclassified");
  const reportingTasks = tasks.filter((task) => task.operationalGroup !== "Unclassified");
  const filteredTasks = reportingTasks.filter((task) => {
    if (
      taskQuery &&
      ![task.name, task.taskListName, task.operationalGroup].some((value) =>
        value.toLowerCase().includes(taskQuery),
      )
    )
      return false;
    if (groupFilter !== "ALL" && task.operationalGroup !== groupFilter) return false;
    if (coverageFilter !== "ALL" && task.assignmentCoverage !== coverageFilter) return false;
    return true;
  });
  const displayedTasks = filteredTasks.slice(0, 250);
  const hasTaskFilters = Boolean(taskQuery) || groupFilter !== "ALL" || coverageFilter !== "ALL";
  const operationalGroups = visibleGroups
    .map((group) => ({
      ...group,
      tasks: displayedTasks.filter((task) => task.operationalGroup === group.groupName),
    }))
    .filter((group) => !hasTaskFilters || group.tasks.length > 0);
  const activeUnplannedWork = unplannedWork.filter((item) => !item.isDismissed);
  const dismissedUnplannedWork = unplannedWork.filter((item) => item.isDismissed);
  const isAdmin = session.user.role === "ADMIN";
  const groupChartRows = visibleGroups.map((group) => ({
    label: group.groupName,
    values: {
      estimated: group.estimatedMinutes / 60,
      logged: group.loggedMinutes / 60,
      labor: numeric(group.actualLaborCost),
      expenses: numeric(group.actualNonLaborCost),
      forecast: numeric(group.forecastCost),
    },
  }));
  const groupCostPerformanceRows = visibleGroups.map((group) => {
    const actualLabor = numeric(group.actualLaborCost);
    const actualNonLabor = numeric(group.actualNonLaborCost);
    return {
      label: group.groupName,
      target: numeric(group.targetCost),
      targetCoverage: group.targetCostCoverage,
      actual: actualLabor === null || actualNonLabor === null ? null : actualLabor + actualNonLabor,
      forecast: numeric(group.forecastCost),
    };
  });

  return (
    <AppShell user={session.user}>
      <main className="shell shell--wide">
        <div className="breadcrumb">
          <Link href="/projects">Projects</Link>
          <span>/</span>
          <span>{project.projectNumber ?? project.name}</span>
        </div>
        <section className="page-heading page-heading--split project-heading">
          <div>
            <div className="heading-badges">
              <MarginBadge value={project.forecastMarginPercent} />
              {project.isProvisional ? <span className="tag tag--warning">Provisional</span> : null}
            </div>
            <h1>{project.name}</h1>
            <p className="lede">
              {project.companyName ?? "No client company"} ·{" "}
              {isArchived ? "archived" : project.status} ·{" "}
              {projectTypes.length ? projectTypes.join(" + ") : "Unclassified"}
            </p>
          </div>
          <div className="project-dates">
            <span>
              Start <strong>{dateLabel(project.startDate)}</strong>
            </span>
            <span>
              End <strong>{dateLabel(project.endDate)}</strong>
            </span>
          </div>
        </section>

        <ProvisionalNotice row={project} />

        <section
          className="executive-kpis project-financial-kpis"
          aria-label="Project financial summary"
        >
          <div className="executive-kpis__primary">
            <MetricCard
              priority="primary"
              label="Actual Cost to Date"
              value={money(project.actualTotalCost)}
              detail="Internal labor plus active expenses"
            />
            <MetricCard
              priority="primary"
              label="Costed Remaining Work"
              value={money(remainingCost)}
              detail={
                project.isProvisional
                  ? "Known costed work; incomplete inputs may increase this amount"
                  : "Forecast cost less actual cost to date"
              }
            />
            <MetricCard
              priority="primary"
              label={
                project.isProvisional
                  ? "Known Forecasted Profit"
                  : "Unspent Revenue / Forecasted Profit"
              }
              value={money(project.forecastProfit)}
              detail={
                <>
                  <MarginText value={project.forecastMarginPercent} />{" "}
                  {project.isProvisional ? "margin ceiling" : "forecast margin"}
                </>
              }
              tone={project.isProvisional ? "warning" : undefined}
            />
          </div>
          <div className="executive-kpis__secondary">
            <MetricCard
              label="Client Fee"
              value={money(project.clientFee)}
              detail="Teamwork fixed-fee budget"
            />
            <MetricCard
              label="Profit to Date"
              value={money(actualProfit)}
              detail={
                <>
                  <MarginText value={actualMargin} /> margin to date
                </>
              }
            />
            <MetricCard
              label="Planned Cost"
              value={money(project.targetCost)}
              detail="Sum of Teamwork task-list cost budgets"
            />
          </div>
        </section>

        <section
          className="metric-grid metric-grid--four project-operational-kpis"
          aria-label="Project delivery summary"
        >
          <MetricCard
            label="Task Completion"
            value={percent(project.progressPercent)}
            detail={`${project.completedTaskCount} of ${project.totalTaskCount} tasks complete`}
          />
          <MetricCard
            label="Logged Hours"
            value={hours(project.loggedMinutes)}
            detail={`${percent(project.canonicalEstimatedMinutes ? ((project.loggedMinutes - project.unplannedLoggedMinutes) / project.canonicalEstimatedMinutes) * 100 : null)} planned estimate consumed${project.unplannedLoggedMinutes > 0 ? ` · ${hours(project.unplannedLoggedMinutes)} unplanned` : ""}`}
          />
          <MetricCard
            label="Estimated Hours"
            value={hours(project.canonicalEstimatedMinutes)}
            detail="Canonical estimate without double counting"
          />
          <MetricCard
            label="Expenses"
            value={money(project.actualNonLaborCost)}
            detail={`${expenses.length} active Teamwork expense${expenses.length === 1 ? "" : "s"}`}
            accent="purple"
          />
        </section>

        <section className="chart-grid chart-grid--project" aria-label="Project performance graphs">
          <ChartPanel
            eyebrow="Financial position"
            title="Revenue Consumption & Forecasted Outcome"
            description="Actual cost, costed remaining work, and unspent revenue are shown together against the project fee."
          >
            <ProjectFinancialPosition
              revenue={clientFee}
              actualCost={actualTotalCost}
              remainingCost={remainingCost}
              forecastProfit={numeric(project.forecastProfit)}
              provisional={project.isProvisional}
            />
          </ChartPanel>
          <ChartPanel
            eyebrow="Effort by operation"
            title="Estimated and logged hours by group"
            description="Hours are rolled up from the same canonical task branches shown below."
          >
            <GroupedBarChart
              rows={groupChartRows}
              series={[
                { key: "estimated", label: "Estimated", tone: "gray" },
                { key: "logged", label: "Logged", tone: "blue" },
              ]}
              suffix=" h"
            />
          </ChartPanel>
          <ChartPanel
            eyebrow="Cost performance"
            title="Cost against target by group"
            description="Actual cost and costed remaining work are shown for every operational group. Complete task-list budgets add a planned-cost target and over/under comparison; groups without a complete target remain N/A rather than being compared with $0."
          >
            <CostPerformanceChart rows={groupCostPerformanceRows} />
          </ChartPanel>
        </section>

        {specialProjectKind ? (
          <section className="report-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Mobilization / Area</p>
                <h2>Mob / Area Breakdown</h2>
                <p className="section-description">
                  {specialProjectKind === "READY_SET"
                    ? "Ready Set mobilizations"
                    : "Data Hall areas"}{" "}
                  are preserved from Teamwork task-list names. Travel is shown separately inside
                  Fieldwork without changing the overall Fieldwork service rollup.
                </p>
              </div>
              <span className="section-meta">
                {mobAreaBreakdowns.length}{" "}
                {specialProjectKind === "READY_SET" ? "mobilizations" : "areas"}
              </span>
            </div>

            {mobAreaBreakdowns.length ? (
              <>
                <form className="filter-bar filter-bar--compact" method="get">
                  {taskQuery ? <input type="hidden" name="task" value={taskQuery} /> : null}
                  {groupFilter !== "ALL" ? (
                    <input type="hidden" name="group" value={groupFilter} />
                  ) : null}
                  {coverageFilter !== "ALL" ? (
                    <input type="hidden" name="coverage" value={coverageFilter} />
                  ) : null}

                  <label className="filter-field">
                    <span>{specialProjectKind === "READY_SET" ? "Mobilization" : "Area"}</span>
                    <select name="mobArea" defaultValue={selectedMobArea?.name ?? ""}>
                      {mobAreaBreakdowns.map((row) => (
                        <option key={row.name} value={row.name}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="button button--primary" type="submit">
                    View
                  </button>
                </form>

                {selectedMobArea ? (
                  <>
                    <div className="operation-group__metric-strip">
                      <span>
                        <small>Estimated hours</small>
                        <strong>{hours(selectedMobArea.estimatedMinutes)}</strong>
                      </span>
                      <span>
                        <small>Logged hours</small>
                        <strong>{hours(selectedMobArea.loggedMinutes)}</strong>
                      </span>
                      <span>
                        <small>Remaining hours</small>
                        <strong>{hours(selectedMobArea.remainingMinutes)}</strong>
                      </span>
                      <span>
                        <small>Actual labor</small>
                        <strong>{money(selectedMobArea.actualLaborCost)}</strong>
                      </span>
                      <span>
                        <small>Remaining labor</small>
                        <strong>{money(selectedMobArea.remainingLaborCost)}</strong>
                      </span>
                      <span>
                        <small>Forecast labor</small>
                        <strong>{money(selectedMobArea.projectedLaborCost)}</strong>
                      </span>
                      <span>
                        <small>Expenses</small>
                        <strong>{money(selectedMobArea.actualExpenseCost)}</strong>
                      </span>
                      <span>
                        <small>Actual cost total</small>
                        <strong>{money(selectedMobArea.actualTotalCost)}</strong>
                      </span>
                    </div>

                    <div className="table-wrap report-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Work split</th>
                            <th>Estimated</th>
                            <th>Logged</th>
                            <th>Remaining</th>
                            <th>Actual labor</th>
                            <th>Remaining labor</th>
                            <th>Forecast labor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              ["Travel", selectedMobArea.travel],
                              ["Other Fieldwork", selectedMobArea.otherFieldwork],
                            ] as const
                          ).map(([label, rollup]) => (
                            <tr key={label}>
                              <td>
                                <strong>{label}</strong>
                              </td>
                              <td>{hours(rollup.estimatedMinutes)}</td>
                              <td>{hours(rollup.loggedMinutes)}</td>
                              <td>{hours(rollup.remainingMinutes)}</td>
                              <td>{money(rollup.actualLaborCost)}</td>
                              <td>{money(rollup.remainingLaborCost)}</td>
                              <td>{money(rollup.projectedLaborCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="table-note">
                      Teamwork expenses linked to {selectedMobArea.name} are included in the Mob /
                      Area actual cost total. They are not assigned to Travel or Other Fieldwork
                      because the reporting source does not provide task-level expense attribution.
                    </p>
                  </>
                ) : null}
              </>
            ) : (
              <div className="empty-panel">
                No {specialProjectKind === "READY_SET" ? "mobilization" : "area"} task lists are
                available for this project.
              </div>
            )}
          </section>
        ) : null}

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coverage</p>
              <h2>
                Why the financial result is {project.isProvisional ? "provisional" : "complete"}
              </h2>
            </div>
            <span className="section-meta">{project.calculationVersion}</span>
          </div>
          <p className="section-description">
            Actual cost uses historical labor and imported expenses. A project is provisional only
            when a source needed to price remaining or expected work is incomplete. Task-list
            budgets define planned internal cost and group cost targets; forecast profit remains the
            fixed fee less forecast cost.
          </p>
          <div className="coverage-grid">
            <div>
              <span>Historical labor cost</span>
              <CoverageBadge value={project.laborCoverage} />
            </div>
            <div>
              <span>Task assignments</span>
              <CoverageBadge value={project.assignmentCoverage} />
            </div>
            <div>
              <span>Task-list target costs</span>
              <CoverageBadge value={project.taskListBudgetCoverage} />
            </div>
            <div>
              <span>Expenses</span>
              <CoverageBadge value={project.expenseCoverage} />
            </div>
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Cost reconciliation</p>
              <h2>Teamwork expenses included in actual cost</h2>
            </div>
            <span className="section-meta">{money(project.actualNonLaborCost)} total</span>
          </div>
          <div className="table-wrap report-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense</th>
                  <th>Task list</th>
                  <th>Group</th>
                  <th>Date</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <strong>{expense.title}</strong>
                      {expense.isOutsourcedModeling ? (
                        <small className="table-subvalue">Outsourced modeling</small>
                      ) : null}
                    </td>
                    <td>{expense.taskListName ?? "Not linked"}</td>
                    <td>{expense.operationalGroup ?? "Unmapped"}</td>
                    <td>{dateLabel(expense.expenseDate)}</td>
                    <td>{money(expense.totalCost)}</td>
                  </tr>
                ))}
                {!expenses.length ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No Teamwork expenses are recorded for this project. This is treated as $0
                      unless an outsourced-cost task indicates that an expense is expected.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Operations and task branches</p>
              <h2>Operational group performance</h2>
              <p className="section-description">
                Open a group to review its calculated task branches. Search and filters apply inside
                every group without changing whole-project financials.
              </p>
            </div>
            <span className="section-meta">
              {filteredTasks.length} of {reportingTasks.length} operational tasks
            </span>
          </div>
          <form className="filter-bar filter-bar--compact" method="get">
            {selectedMobArea ? (
              <input type="hidden" name="mobArea" value={selectedMobArea.name} />
            ) : null}
            <label className="filter-field filter-field--search">
              <span>Search tasks</span>
              <input name="task" defaultValue={taskQuery} placeholder="Task, list, or group" />
            </label>
            <label className="filter-field">
              <span>Group</span>
              <select name="group" defaultValue={groupFilter}>
                <option value="ALL">All</option>
                {[...new Set(reportingTasks.map((task) => task.operationalGroup))]
                  .sort()
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
            <label className="filter-field">
              <span>Assignment coverage</span>
              <select name="coverage" defaultValue={coverageFilter}>
                <option value="ALL">All</option>
                <option>COMPLETE</option>
                <option>PARTIAL</option>
                <option>MISSING</option>
                <option>NOT_EXPECTED</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              Apply
            </button>
            {hasTaskFilters ? (
              <Link className="button button--secondary" href={`/projects/${project.id}`}>
                Clear
              </Link>
            ) : null}
          </form>
          <div className="operation-accordion">
            {operationalGroups.map((group) => (
              <details className="operation-group" key={group.groupName} open={hasTaskFilters}>
                <summary>
                  <div className="operation-group__identity">
                    <strong>{group.groupName}</strong>
                    <span>
                      {group.tasks.length} matching task{group.tasks.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="operation-group__summary-metrics">
                    <span>
                      <small>Hours</small>
                      <strong>
                        {hours(group.loggedMinutes)} / {hours(group.estimatedMinutes)}
                      </strong>
                    </span>
                    <span>
                      <small>Completion</small>
                      <strong>{percent(group.progressPercent)}</strong>
                    </span>
                    <span>
                      <small>Actual labor</small>
                      <strong>{money(group.actualLaborCost)}</strong>
                    </span>
                    <span>
                      <small>Forecast</small>
                      <strong>{money(group.forecastCost)}</strong>
                    </span>
                  </div>
                  <CoverageBadge value={group.targetCostCoverage} />
                  <span className="operation-group__toggle">
                    <span>View tasks</span>
                    <i aria-hidden="true" />
                  </span>
                </summary>
                <div className="operation-group__body">
                  <div className="operation-group__metric-strip">
                    <span>
                      <small>Planned cost</small>
                      <strong>{money(group.targetCost)}</strong>
                    </span>
                    <span>
                      <small>Expenses</small>
                      <strong>{money(group.actualNonLaborCost)}</strong>
                    </span>
                    <span>
                      <small>Variance</small>
                      <strong>{money(group.varianceToTarget)}</strong>
                    </span>
                    <span>
                      <small>Projected labor</small>
                      <strong>{money(group.projectedLaborCost)}</strong>
                    </span>
                  </div>
                  <div className="table-wrap report-table-wrap">
                    <table className="data-table task-branch-table">
                      <thead>
                        <tr>
                          <th>Task branch</th>
                          <th>Status</th>
                          <th>Hours</th>
                          <th>Remaining</th>
                          <th>Projected labor</th>
                          <th>Actual labor</th>
                          <th>Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.tasks.map((task) => (
                          <tr key={task.id}>
                            <td>
                              <strong>{task.name}</strong>
                              <small className="table-subvalue">
                                {task.taskListName}
                                {task.isOutsourced ? " · Outsourced" : ""}
                              </small>
                            </td>
                            <td>{task.isBranchComplete ? "Complete" : task.status}</td>
                            <td>
                              {hours(task.branchLoggedMinutes)}
                              <small className="table-subvalue">
                                of {hours(task.countedEstimatedMinutes)}
                              </small>
                            </td>
                            <td>{hours(task.remainingMinutes)}</td>
                            <td>{money(task.projectedLaborCost)}</td>
                            <td>{money(task.actualLaborCost)}</td>
                            <td>
                              <CoverageBadge value={task.assignmentCoverage} />
                              {task.assignmentCoverage === "MISSING" && !task.isOutsourced ? (
                                <small className="table-subvalue table-subvalue--warning">
                                  Assignment cost unresolved
                                </small>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {!group.tasks.length ? (
                          <tr>
                            <td colSpan={7} className="empty-state">
                              No tasks in this group match the current filters.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
            {!operationalGroups.length ? (
              <div className="empty-panel">
                No operational groups contain tasks matching the current filters.
              </div>
            ) : null}
          </div>
          {filteredTasks.length > 250 ? (
            <p className="table-note">
              Showing the first 250 matching task branches. Refine the filters to narrow the result.
            </p>
          ) : null}
        </section>

        {unplannedWork.length ? (
          <section className="report-section unplanned-review-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Unplanned work review</p>
                <h2>Logged work without a top-level estimate</h2>
                <p className="section-description">
                  These hours and their historical labor cost are already included. Add an estimate
                  in Teamwork to resolve the item, or an Admin can mark it reviewed and leave it
                  unplanned. Subtasks are intentionally exempt.
                </p>
              </div>
              <span className="section-meta">
                {activeUnplannedWork.length} open · {dismissedUnplannedWork.length} reviewed
              </span>
            </div>
            {isAdmin && activeUnplannedWork.length > 1 ? (
              <form action={dismissAllUnplannedWork} className="inline-action-form">
                <input type="hidden" name="projectId" value={project.id} />
                <button className="button button--secondary" type="submit">
                  Dismiss all current unplanned-work flags
                </button>
              </form>
            ) : null}
            <div className="unplanned-work-list">
              {activeUnplannedWork.map((item) => (
                <article className="unplanned-work-card" key={item.issueId}>
                  <div>
                    <strong>{item.taskName}</strong>
                    <small>{item.taskListName}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>Unplanned hours</dt>
                      <dd>{hours(item.loggedMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Historical labor</dt>
                      <dd>{money(item.laborCost)}</dd>
                    </div>
                    <div>
                      <dt>Logged dates</dt>
                      <dd>
                        {dateLabel(item.firstLoggedDate)} – {dateLabel(item.lastLoggedDate)}
                      </dd>
                    </div>
                  </dl>
                  {isAdmin ? (
                    <form action={dismissUnplannedWork}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="issueId" value={item.issueId} />
                      <button className="button button--secondary" type="submit">
                        Reviewed — leave unplanned
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
              {dismissedUnplannedWork.map((item) => (
                <article
                  className="unplanned-work-card unplanned-work-card--dismissed"
                  key={item.issueId}
                >
                  <div>
                    <strong>{item.taskName}</strong>
                    <small>
                      {item.taskListName} · Reviewed by {item.dismissedByName ?? "Admin"}
                    </small>
                  </div>
                  <dl>
                    <div>
                      <dt>Reviewed hours</dt>
                      <dd>{hours(item.loggedMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Historical labor</dt>
                      <dd>{money(item.laborCost)}</dd>
                    </div>
                  </dl>
                  {isAdmin ? (
                    <form action={reopenUnplannedWork}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="taskId" value={item.taskId} />
                      <button className="button button--secondary" type="submit">
                        Reopen
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Data quality</p>
              <h2>Open source-data issues</h2>
              <p className="section-description">
                Expand an issue to see the imported records that caused it. Teamwork links open the
                project area where the source data can be corrected.
              </p>
            </div>
            <span className="section-meta">{issues.length} issues</span>
          </div>
          <div className="issue-list">
            {issues.map((issue) => (
              <article
                key={issue.id}
                className={`issue-card issue-card--${issue.severity.toLowerCase()}`}
              >
                <div>
                  <strong>{issue.code.replaceAll("_", " ")}</strong>
                  <span>{issue.severity}</span>
                </div>
                <p>{issue.message}</p>
                {issue.taskName || issue.taskListName ? (
                  <small>
                    {issue.taskListName}
                    {issue.taskName ? ` · ${issue.taskName}` : ""}
                  </small>
                ) : null}
                <div className="issue-card__actions">
                  {issue.teamworkUrl ? (
                    <a
                      className="button button--secondary button--small"
                      href={issue.teamworkUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Teamwork
                    </a>
                  ) : null}
                </div>
                {issue.evidence.length ? (
                  <details className="issue-evidence">
                    <summary>
                      View {issue.evidence.length} affected{" "}
                      {issue.evidence.length === 1
                        ? issue.evidence[0]?.kind === "TIME_ENTRY"
                          ? "time entry"
                          : "task list"
                        : issue.evidence[0]?.kind === "TIME_ENTRY"
                          ? "time entries"
                          : "task lists"}
                    </summary>
                    <div className="issue-evidence__table-wrap">
                      <table className="data-table issue-evidence__table">
                        <thead>
                          <tr>
                            <th>Source record</th>
                            <th>User / date</th>
                            <th>Hours</th>
                            <th>Labor cost</th>
                            <th>Teamwork</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issue.evidence.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.label}</strong>
                                {item.description ? (
                                  <small className="table-subvalue">{item.description}</small>
                                ) : null}
                              </td>
                              <td>
                                {item.personName ?? "—"}
                                <small className="table-subvalue">
                                  {dateLabel(item.loggedDate)}
                                </small>
                              </td>
                              <td>{item.minutes === null ? "—" : hours(item.minutes)}</td>
                              <td>{money(item.laborCost)}</td>
                              <td>
                                {item.teamworkUrl ? (
                                  <a href={item.teamworkUrl} target="_blank" rel="noreferrer">
                                    Open
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {issue.evidence.length >= 50 ? (
                      <p className="table-note">
                        Showing the first 50 affected records. Use the Teamwork link to review the
                        full list.
                      </p>
                    ) : null}
                  </details>
                ) : null}
              </article>
            ))}
            {!issues.length ? (
              <div className="empty-panel">No open data-quality issues for this project.</div>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
