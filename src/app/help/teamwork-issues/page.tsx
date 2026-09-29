import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";
import {
  getLatestTeamworkSyncDiagnostics,
  getTeamworkIssueCenterRows,
} from "@/lib/reporting/dashboard-data";
import { dateLabel, hours, money } from "@/lib/reporting/format";
import { dismissUnplannedWork, reopenUnplannedWork } from "@/app/projects/[projectId]/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ageInDays(value: Date): number {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

function plainIssueTitle(code: string): string {
  const titles: Record<string, string> = {
    UNPLANNED_ACTUAL_WORK: "Unplanned time needs review",
    OUTSOURCED_EXPENSE_MISSING: "Outsourced expense is missing",
    PROJECT_BUDGET_MISSING: "Project budget is missing",
    TASK_LIST_BUDGET_COVERAGE_INCOMPLETE: "Some task-list budgets are incomplete",
    MISSING_TASK_ASSIGNMENT: "Remaining work needs an assignment",
    NON_COSTED_ASSIGNMENT_UNRESOLVED: "An assignment cannot be costed",
    MISSING_JOB_ROLE_COST_RATE: "A job role is missing its cost rate",
    MISSING_EMPLOYEE_COST_RATE: "An employee is missing a cost rate",
    UNALLOCATED_PROJECT_TIME: "Logged time needs a task",
    ACTUAL_LABOR_COST_INCOMPLETE: "Labor cost information is incomplete",
  };
  return titles[code] ?? code.replaceAll("_", " ").toLowerCase();
}

function issueLocation(code: string): string {
  if (code === "PROJECT_BUDGET_MISSING" || code === "TASK_LIST_BUDGET_COVERAGE_INCOMPLETE") {
    return "Teamwork Finance → Budgets";
  }
  if (code === "OUTSOURCED_EXPENSE_MISSING") return "Teamwork Finance → Expenses";
  if (code.includes("COST_RATE")) return "Teamwork → People or job-role cost rates";
  if (code === "UNPLANNED_ACTUAL_WORK") return "The Teamwork task estimate, or confirm it here";
  if (code === "UNALLOCATED_PROJECT_TIME") return "Teamwork → Project time entries";
  return "The affected Teamwork task or project record";
}

export default async function TeamworkIssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/help/teamwork-issues");
  const isAdmin = session.user.role === "ADMIN";
  const params = await searchParams;
  const [allIssues, syncDiagnostics] = await Promise.all([
    getTeamworkIssueCenterRows(),
    getLatestTeamworkSyncDiagnostics(),
  ]);

  const query = one(params.q)?.trim() ?? "";
  const view = one(params.view) ?? "ATTENTION";
  const status = one(params.status) ?? "ALL";
  const severity = one(params.severity) ?? "ALL";
  const code = one(params.code) ?? "ALL";
  const correctionPath = one(params.path) ?? "ALL";
  const projectId = one(params.project);
  const scope = one(params.scope) ?? "ALL";
  const normalizedQuery = query.toLowerCase();

  const scopedIssues =
    scope === "DATA_ISSUES"
      ? allIssues.filter((issue) => issue.code !== "UNPLANNED_ACTUAL_WORK")
      : allIssues;

  const issueCodes = [...new Set(scopedIssues.map((issue) => issue.code))].sort();

  const statusScopedIssues = scopedIssues.filter((issue) => {
    if (projectId && issue.projectId !== projectId) return false;
    if (severity !== "ALL" && issue.severity !== severity) return false;
    if (code !== "ALL" && issue.code !== code) return false;
    if (correctionPath !== "ALL" && issue.resolutionPath !== correctionPath) return false;

    if (normalizedQuery) {
      const searchable = [
        issue.projectNumber,
        issue.projectName,
        issue.companyName,
        issue.taskListName,
        issue.taskName,
        issue.code,
        issue.message,
        issue.recommendedAction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(normalizedQuery)) return false;
    }

    return true;
  });

  const statusFilteredIssues =
    status === "ALL"
      ? statusScopedIssues
      : statusScopedIssues.filter((issue) => issue.status === status);
  const issues = statusFilteredIssues.filter((issue) => {
    if (view === "ALL") return true;
    if (view === "REVIEWED") return issue.status === "REVIEWED";
    if (view === "REVIEW_UNPLANNED") {
      return issue.status === "OPEN" && issue.code === "UNPLANNED_ACTUAL_WORK";
    }
    if (view === "ATTENTION") {
      return (
        issue.status === "OPEN" &&
        issue.code !== "UNPLANNED_ACTUAL_WORK" &&
        issue.severity !== "INFO"
      );
    }
    return issue.status === "OPEN";
  });

  const openIssues = statusScopedIssues.filter((issue) => issue.status === "OPEN");
  const reviewedIssues = statusScopedIssues.filter((issue) => issue.status === "REVIEWED");
  const attentionIssues = openIssues.filter(
    (issue) => issue.code !== "UNPLANNED_ACTUAL_WORK" && issue.severity !== "INFO",
  );
  const unplannedReviewIssues = openIssues.filter(
    (issue) => issue.code === "UNPLANNED_ACTUAL_WORK",
  );
  const issueGroups = [
    ...issues
      .reduce(
        (groups, issue) => {
          const group = groups.get(issue.projectId) ?? {
            projectId: issue.projectId,
            projectName: issue.projectName,
            projectNumber: issue.projectNumber,
            companyName: issue.companyName,
            issues: [] as typeof issues,
          };
          group.issues.push(issue);
          groups.set(issue.projectId, group);
          return groups;
        },
        new Map<
          string,
          {
            projectId: string;
            projectName: string;
            projectNumber: string | null;
            companyName: string | null;
            issues: typeof issues;
          }
        >(),
      )
      .values(),
  ];

  return (
    <AppShell user={session.user}>
      <main className="shell shell--wide">
        <section className="page-heading page-heading--split">
          <div>
            <p className="eyebrow">Guide {"\u00b7"} Teamwork</p>
            <h1>Teamwork Issues</h1>
            <p className="lede">
              Review current Teamwork and reporting-data issues across all reporting projects.
              Source corrections are made in Teamwork; reviewed unplanned-work items are tracked
              separately in the dashboard.
            </p>
          </div>
          <Link className="button button--secondary" href="/help">
            Back to Guide
          </Link>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current issues</p>
              <h2>Company reporting issue register</h2>
              <p className="section-description">
                Open items require source correction or review. Once corrected in Teamwork, an item
                disappears after the next sync and calculation run. Reviewed unplanned-work items
                remain available for reference and can be reopened when needed.
              </p>
            </div>
            <span className="section-meta">
              {attentionIssues.length} need attention {"\u00b7"} {unplannedReviewIssues.length}{" "}
              awaiting review {"\u00b7"} {reviewedIssues.length} reviewed
            </span>
          </div>

          <div className="issue-workflow" role="note">
            <strong>Close the loop</strong>
            <span>1. Open the source record in Teamwork.</span>
            <span>2. Correct the estimate, assignment, budget, or rate there.</span>
            <span>
              3. Run the next sync. Corrected items close automatically when the source is
              re-checked.
            </span>
            <small>
              Teamwork remains the source of truth. The dashboard does not silently overwrite
              Teamwork records.
            </small>
          </div>

          <nav className="issue-view-tabs" aria-label="Issue work queues">
            <Link
              className={view === "ATTENTION" ? "is-active" : ""}
              href="/help/teamwork-issues?view=ATTENTION"
            >
              Needs Attention <b>{attentionIssues.length}</b>
            </Link>
            <Link
              className={view === "REVIEW_UNPLANNED" ? "is-active" : ""}
              href="/help/teamwork-issues?view=REVIEW_UNPLANNED"
            >
              Review Unplanned Time <b>{unplannedReviewIssues.length}</b>
            </Link>
            <Link
              className={view === "REVIEWED" ? "is-active" : ""}
              href="/help/teamwork-issues?view=REVIEWED"
            >
              Reviewed <b>{reviewedIssues.length}</b>
            </Link>
            <Link
              className={view === "ALL" ? "is-active" : ""}
              href="/help/teamwork-issues?view=ALL"
            >
              All Issues <b>{statusScopedIssues.length}</b>
            </Link>
          </nav>

          <form
            className="filter-panel teamwork-issues-filter-panel"
            method="get"
            action="/help/teamwork-issues"
          >
            <div className="filter-panel__heading">
              <div>
                <p className="eyebrow">Issue filters</p>
                <h2>Find issues that need attention</h2>
                <p>
                  Search project and task context, then narrow by status, severity, issue type, or
                  correction path.
                </p>
              </div>
              <Link className="filter-panel__reset" href="/help/teamwork-issues">
                Reset all
              </Link>
            </div>

            <div className="teamwork-issues-filter-grid">
              <label className="filter-field teamwork-issues-filter-grid__search">
                <span>Search</span>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Project, client, task, issue, or action"
                  autoComplete="off"
                />
              </label>

              <label className="filter-field">
                <span>Status</span>
                <select name="status" defaultValue={status}>
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="REVIEWED">Reviewed</option>
                </select>
              </label>
              <input type="hidden" name="view" value={view} />

              <label className="filter-field">
                <span>Severity</span>
                <select name="severity" defaultValue={severity}>
                  <option value="ALL">All severities</option>
                  <option value="ERROR">Error</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
              </label>

              <label className="filter-field">
                <span>Issue type</span>
                <select name="code" defaultValue={code}>
                  <option value="ALL">All issue types</option>
                  {issueCodes.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>Correction path</span>
                <select name="path" defaultValue={correctionPath}>
                  <option value="ALL">All correction paths</option>
                  <option value="TEAMWORK_REQUIRED">Teamwork required</option>
                  <option value="TEAMWORK_OR_REVIEW">Teamwork or Admin review</option>
                </select>
              </label>

              {projectId ? <input type="hidden" name="project" value={projectId} /> : null}
              {scope !== "ALL" ? <input type="hidden" name="scope" value={scope} /> : null}

              <div className="teamwork-issues-filter-grid__actions">
                <button className="button button--primary" type="submit">
                  Apply filters
                </button>
                <Link className="button button--secondary" href="/help/teamwork-issues">
                  Clear
                </Link>
              </div>
            </div>
          </form>

          <div className="issue-list">
            {issueGroups.map((group) => (
              <section className="issue-project-group" key={group.projectId}>
                <header className="issue-project-group__header">
                  <div>
                    <strong>
                      {group.projectNumber ? `${group.projectNumber} · ` : ""}
                      {group.projectName}
                    </strong>
                    {group.companyName ? <span>{group.companyName}</span> : null}
                  </div>
                  <span>
                    {group.issues.length} issue{group.issues.length === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="issue-project-group__list">
                  {group.issues.map((issue) => (
                    <article
                      key={issue.id}
                      className={`issue-card issue-card--simple issue-card--${issue.severity.toLowerCase()}`}
                    >
                      <div className="issue-card__simple-heading">
                        <div>
                          <strong>{plainIssueTitle(issue.code)}</strong>
                          {issue.taskListName || issue.taskName ? (
                            <span>
                              {[issue.taskListName, issue.taskName].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </div>
                        <span>
                          {issue.code === "UNPLANNED_ACTUAL_WORK" && issue.status === "OPEN"
                            ? "AWAITING REVIEW"
                            : issue.status}
                        </span>
                      </div>

                      <div className="issue-card__explanation">
                        <p>
                          <strong>What’s wrong</strong>
                          <span>{issue.message}</span>
                        </p>
                        <p>
                          <strong>How to fix it</strong>
                          <span>{issue.recommendedAction}</span>
                        </p>
                        <p>
                          <strong>Where to fix it</strong>
                          <span>{issueLocation(issue.code)}</span>
                        </p>
                      </div>

                      <div className="issue-card__actions">
                        {issue.teamworkUrl ? (
                          <a
                            className="button button--primary button--small"
                            href={issue.teamworkUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Fix in Teamwork
                          </a>
                        ) : (
                          <Link
                            className="button button--secondary button--small"
                            href={`/projects/${issue.projectId}`}
                          >
                            View report details
                          </Link>
                        )}
                        {isAdmin && issue.code === "UNPLANNED_ACTUAL_WORK" && issue.taskId ? (
                          issue.status === "REVIEWED" ? (
                            <form action={reopenUnplannedWork}>
                              <input type="hidden" name="projectId" value={issue.projectId} />
                              <input type="hidden" name="taskId" value={issue.taskId} />
                              <button
                                className="button button--secondary button--small"
                                type="submit"
                              >
                                Reopen
                              </button>
                            </form>
                          ) : (
                            <form action={dismissUnplannedWork}>
                              <input type="hidden" name="projectId" value={issue.projectId} />
                              <input type="hidden" name="issueId" value={issue.id} />
                              <button
                                className="button button--secondary button--small"
                                type="submit"
                              >
                                Confirm and close
                              </button>
                            </form>
                          )
                        ) : null}
                      </div>

                      <details className="issue-technical-details">
                        <summary>
                          Technical details
                          {issue.evidence.length
                            ? ` · ${issue.evidence.length} affected records`
                            : ""}
                        </summary>
                        <small>
                          {issue.code.replaceAll("_", " ")} · {issue.severity} · Project status{" "}
                          {issue.projectStatus} · Age {ageInDays(issue.lastDetectedAt)} days · Last
                          detected {dateLabel(issue.lastDetectedAt)}
                          {issue.reviewedAt
                            ? ` · Reviewed ${dateLabel(issue.reviewedAt)} by ${issue.reviewedByName ?? "Admin"}`
                            : ""}
                        </small>
                        {issue.code === "UNPLANNED_ACTUAL_WORK" && issue.details ? (
                          <dl>
                            <div>
                              <dt>Unplanned hours</dt>
                              <dd>{hours(Number(issue.details.loggedMinutes ?? 0))}</dd>
                            </div>
                            <div>
                              <dt>Historical labor</dt>
                              <dd>{money(String(issue.details.laborCost ?? ""))}</dd>
                            </div>
                          </dl>
                        ) : null}
                        {issue.evidence.length ? (
                          <div className="issue-evidence__table-wrap">
                            <table className="data-table issue-evidence__table">
                              <thead>
                                <tr>
                                  <th>Source record</th>
                                  <th>Person / date</th>
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
                                      {item.personName ?? "—"}
                                      <small className="table-subvalue">
                                        {dateLabel(item.loggedDate)}
                                      </small>
                                    </td>
                                    <td>{item.minutes === null ? "—" : hours(item.minutes)}</td>
                                    <td>{money(item.laborCost)}</td>
                                    <td>
                                      {item.teamworkUrl ? (
                                        <a href={item.teamworkUrl} target="_blank" rel="noreferrer">
                                          Open
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {!issues.length ? (
              <div className="empty-panel">
                {view === "REVIEW_UNPLANNED"
                  ? "No unplanned-time items are waiting for review."
                  : "No current Teamwork data-quality issues."}
              </div>
            ) : null}
          </div>
        </section>

        <section className="report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Import diagnostics</p>
              <h2>Latest Teamwork sync diagnostics</h2>
              <p className="section-description">
                These are sampled importer and reconciliation warnings from the latest sync run.
                They are separate from the current project issue register above and are not a
                complete issue count. The sync stores at most 10 examples per warning code.
              </p>
            </div>
            <span className="section-meta">
              {syncDiagnostics
                ? `${syncDiagnostics.diagnostics.length} saved samples`
                : "No sync run"}
            </span>
          </div>

          {syncDiagnostics ? (
            <>
              <p className="section-description">
                {syncDiagnostics.kind.replaceAll("_", " ")} {"\u00b7"}{" "}
                {syncDiagnostics.status.replaceAll("_", " ")} {"\u00b7"} Started{" "}
                {dateLabel(syncDiagnostics.startedAt)} {"\u00b7"} {syncDiagnostics.recordsRead}{" "}
                records read {"\u00b7"} {syncDiagnostics.warnings} warnings {"\u00b7"}{" "}
                {syncDiagnostics.errors} errors
              </p>

              <div className="issue-list">
                {syncDiagnostics.diagnostics.map((diagnostic) => (
                  <article
                    key={diagnostic.id}
                    className={`issue-card issue-card--${diagnostic.severity.toLowerCase()}`}
                  >
                    <div>
                      <strong>{diagnostic.code.replaceAll("_", " ")}</strong>
                      <span>{diagnostic.severity}</span>
                    </div>
                    <p>{diagnostic.message}</p>
                    <small>
                      {[diagnostic.entityType, diagnostic.teamworkEntityId]
                        .filter((value) => value !== null)
                        .join(" \u00b7 ")}
                    </small>
                  </article>
                ))}

                {!syncDiagnostics.diagnostics.length ? (
                  <div className="empty-panel">
                    No diagnostic samples were saved for the latest sync run.
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-panel">No Teamwork synchronization has run yet.</div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
