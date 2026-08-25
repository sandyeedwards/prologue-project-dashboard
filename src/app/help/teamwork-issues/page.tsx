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

export default async function TeamworkIssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/help/teamwork-issues");
  const isAdmin = session.user.role === "ADMIN";
  const params = await searchParams;
  const [allIssues, syncDiagnostics] = await Promise.all([
    getTeamworkIssueCenterRows(),
    getLatestTeamworkSyncDiagnostics(),
  ]);

  const query = one(params.q)?.trim() ?? "";
  const status = one(params.status) ?? "OPEN";
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

  const issues =
    status === "ALL"
      ? statusScopedIssues
      : statusScopedIssues.filter((issue) => issue.status === status);

  const openIssues = statusScopedIssues.filter((issue) => issue.status === "OPEN");
  const reviewedIssues = statusScopedIssues.filter((issue) => issue.status === "REVIEWED");

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
              <h2>Portfolio reporting issue register</h2>
              <p className="section-description">
                Open items require source correction or review. Once corrected in Teamwork, an item
                disappears after the next sync and calculation run. Reviewed unplanned-work items
                remain available for reference and can be reopened when needed.
              </p>
            </div>
            <span className="section-meta">
              {openIssues.length} open {"\u00b7"} {reviewedIssues.length} reviewed
            </span>
          </div>

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
            {issues.map((issue) => (
              <article
                key={issue.id}
                className={`issue-card issue-card--${issue.severity.toLowerCase()}`}
              >
                <div>
                  <strong>
                    {issue.projectNumber ? `${issue.projectNumber} \u00b7 ` : ""}
                    {issue.projectName}
                  </strong>
                  <span>{issue.status}</span>
                </div>

                <p>
                  <strong>{issue.code.replaceAll("_", " ")}</strong>
                  {" \u00b7 "}
                  {issue.message}
                </p>

                {issue.companyName || issue.taskListName || issue.taskName ? (
                  <small>
                    {[issue.companyName, issue.taskListName, issue.taskName]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                  </small>
                ) : null}

                <p>
                  <strong>Recommended action:</strong> {issue.recommendedAction}
                </p>

                <p>
                  <strong>Correction path:</strong>{" "}
                  {issue.resolutionPath === "TEAMWORK_OR_REVIEW"
                    ? "Teamwork correction or Admin review"
                    : "Teamwork correction required"}
                </p>

                <small>
                  {issue.severity} {"\u00b7"} Project status {issue.projectStatus} {"\u00b7"} Last
                  detected {dateLabel(issue.lastDetectedAt)}
                  {issue.reviewedAt
                    ? ` \u00b7 Reviewed ${dateLabel(issue.reviewedAt)} by ${issue.reviewedByName ?? "Admin"}`
                    : ""}
                </small>

                <div className="issue-card__actions">
                  <Link
                    className="button button--secondary button--small"
                    href={`/projects/${issue.projectId}`}
                  >
                    Open project
                  </Link>
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
                  {isAdmin && issue.code === "UNPLANNED_ACTUAL_WORK" && issue.taskId ? (
                    issue.status === "REVIEWED" ? (
                      <form action={reopenUnplannedWork}>
                        <input type="hidden" name="projectId" value={issue.projectId} />
                        <input type="hidden" name="taskId" value={issue.taskId} />
                        <button className="button button--secondary button--small" type="submit">
                          Reopen
                        </button>
                      </form>
                    ) : (
                      <form action={dismissUnplannedWork}>
                        <input type="hidden" name="projectId" value={issue.projectId} />
                        <input type="hidden" name="issueId" value={issue.id} />
                        <button className="button button--secondary button--small" type="submit">
                          Reviewed {"\u2014"} leave unplanned
                        </button>
                      </form>
                    )
                  ) : null}
                </div>

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
                  <details className="issue-evidence">
                    <summary>
                      View {issue.evidence.length} affected source{" "}
                      {issue.evidence.length === 1 ? "record" : "records"}
                    </summary>
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
                                {item.personName ?? "\u2014"}
                                <small className="table-subvalue">
                                  {dateLabel(item.loggedDate)}
                                </small>
                              </td>
                              <td>{item.minutes === null ? "\u2014" : hours(item.minutes)}</td>
                              <td>{money(item.laborCost)}</td>
                              <td>
                                {item.teamworkUrl ? (
                                  <a href={item.teamworkUrl} target="_blank" rel="noreferrer">
                                    Open
                                  </a>
                                ) : (
                                  "\u2014"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : null}
              </article>
            ))}

            {!issues.length ? (
              <div className="empty-panel">No current Teamwork data-quality issues.</div>
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
