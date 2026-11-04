import Link from "next/link";
import { hostingIssueSourceUrl, type HostingDataIssue } from "@/lib/hosting/data-issues";

export function HostingDataIssues({
  issues,
  allIssues,
  showFilters = false,
  query = "",
  severity = "ALL",
  code = "ALL",
  platform = "ALL",
}: {
  issues: HostingDataIssue[];
  allIssues: HostingDataIssue[];
  showFilters?: boolean;
  query?: string;
  severity?: string;
  code?: string;
  platform?: string;
}) {
  const groups = new Map<string, { name: string; issues: HostingDataIssue[] }>();
  for (const issue of issues) {
    const key = issue.hubspotDealId ?? issue.id;
    const group = groups.get(key) ?? { name: issue.dealName, issues: [] };
    group.issues.push(issue);
    groups.set(key, group);
  }
  return (
    <section aria-labelledby="hosting-data-issues-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">HubSpot &amp; hosting data</p>
          <h2 id="hosting-data-issues-title">Hosting data issues</h2>
          <p className="section-description">
            Checks use the latest imported records. Correct the source in HubSpot, then run the
            hosting sync. Corrected items disappear when the imported data is rechecked. Bill
            comparisons use the supplied August 2026 snapshot.
          </p>
        </div>
        <span className="section-meta">
          {issues.length} item{issues.length === 1 ? "" : "s"} shown
        </span>
      </div>
      {showFilters ? (
        <form
          className="filter-panel teamwork-issues-filter-panel"
          method="get"
          action="/teamwork-issues"
        >
          <input type="hidden" name="view" value="HOSTING" />
          <div className="teamwork-issues-filter-grid">
            <label className="filter-field teamwork-issues-filter-grid__search">
              <span>Search hosting issues</span>
              <input
                name="q"
                defaultValue={query}
                placeholder="Deal, site, field, issue or HubSpot ID"
              />
            </label>
            <label className="filter-field">
              <span>Platform</span>
              <select name="platform" defaultValue={platform}>
                <option value="ALL">Both platforms</option>
                <option value="Benaco">Benaco</option>
                <option value="IVION">IVION</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Severity</span>
              <select name="severity" defaultValue={severity}>
                <option value="ALL">All severities</option>
                <option value="ERROR">Error</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Review information</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Issue type</span>
              <select name="code" defaultValue={code}>
                <option value="ALL">All hosting issue types</option>
                {[...new Map(allIssues.map((issue) => [issue.code, issue.title])).entries()]
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
              </select>
            </label>
            <div className="teamwork-issues-filter-grid__actions">
              <button className="button button--primary" type="submit">
                Apply filters
              </button>
              <Link className="button button--secondary" href="/teamwork-issues?view=HOSTING">
                Clear
              </Link>
            </div>
          </div>
        </form>
      ) : null}
      <div className="issue-list">
        {[...groups.entries()].map(([key, group]) => (
          <section className="issue-project-group" key={key}>
            <header className="issue-project-group__header">
              <div>
                <strong>{group.name}</strong>
                <span>Hosting source data</span>
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
                      <strong>{issue.title}</strong>
                      <span>
                        {issue.platform} ·{" "}
                        {issue.severity === "INFO"
                          ? "Review information"
                          : issue.severity.toLowerCase()}
                      </span>
                    </div>
                    <span>OPEN</span>
                  </div>
                  <div className="issue-card__explanation">
                    <p>
                      <strong>Issue</strong>
                      <span>{issue.message}</span>
                    </p>
                    <p>
                      <strong>Effect on reporting</strong>
                      <span>{issue.impact}</span>
                    </p>
                    <p>
                      <strong>Action</strong>
                      <span>{issue.action}</span>
                    </p>
                  </div>
                  <div className="issue-card__actions">
                    <a
                      className="button button--primary button--small"
                      href={hostingIssueSourceUrl(
                        issue,
                        process.env.HUBSPOT_PORTAL_ID?.trim() || "4953519",
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {issue.source === "HUBSPOT" ? "Fix in HubSpot" : "Review hosting settings"}
                    </a>
                    <Link
                      className="button button--secondary button--small"
                      href={`/hosting?view=${issue.platform.toLowerCase()}`}
                    >
                      View hosting report
                    </Link>
                  </div>
                  <details className="issue-technical-details">
                    <summary>Fields to check</summary>
                    <p>{issue.location}</p>
                    <dl>
                      {issue.evidence.map((item) => (
                        <div key={item.field}>
                          <dt>{item.field}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!issues.length ? (
          <div className="empty-panel">No hosting data issues match this view.</div>
        ) : null}
      </div>
    </section>
  );
}
