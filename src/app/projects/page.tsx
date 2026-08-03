import { AppShell } from "@/components/app-shell";
import { ProjectFilterBar } from "@/components/project-filters";
import { ProjectPageSizeSelect } from "@/components/project-page-size-select";
import {
  CombinedPortfolioReport,
  ProjectComparisonReport,
} from "@/components/project-selection-reports";
import { ProjectTable } from "@/components/reporting-ui";
import { requireUser } from "@/lib/auth/session";
import {
  filterAndSortProjects,
  getAvailableProjectTypes,
  getComparedProjectOperationalGroups,
  getPortfolioHistoricalProfitSeries,
  getPortfolioOperationalGroups,
  getProjectRows,
  type ProjectFilter,
  type ProjectReportRow,
} from "@/lib/reporting/dashboard-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PROJECT_PAGE_SIZES = [25, 50, 100] as const;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function projectPageSize(value: string | undefined): number {
  const parsed = positiveInteger(value, 25);
  return PROJECT_PAGE_SIZES.includes(parsed as (typeof PROJECT_PAGE_SIZES)[number]) ? parsed : 25;
}

function hiddenFilterFields(filter: ProjectFilter) {
  return [
    ["q", filter.query],
    ["client", filter.client],
    ["health", filter.health],
    ["status", filter.status],
    ["type", filter.type],
    ["dateFrom", filter.dateFrom],
    ["dateTo", filter.dateTo],
    ["sort", filter.sort],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]) && entry[1] !== "ALL");
}

function resetHref(
  mode: "compare" | "combine" | null,
  selectedIds: string[],
  pageSize: number,
): string {
  const search = new URLSearchParams();
  if (mode) search.set("mode", mode);
  selectedIds.forEach((projectId) => search.append("project", projectId));
  search.set("pageSize", String(pageSize));
  return `/projects?${search.toString()}`;
}

function pageButtons(currentPage: number, pageCount: number): number[] {
  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b);
}

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/projects");
  const params = await searchParams;
  const allProjects = await getProjectRows();
  const filter: ProjectFilter = {
    query: one(params.q),
    client: one(params.client),
    health: one(params.health),
    status: one(params.status),
    type: one(params.type),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
    sort: one(params.sort),
  };
  const projects = filterAndSortProjects(allProjects, filter);
  const pageSize = projectPageSize(one(params.pageSize));
  const requestedPage = positiveInteger(one(params.page), 1);
  const pageCount = Math.max(1, Math.ceil(projects.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleProjects = projects.slice(pageStart, pageStart + pageSize);
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const visibleFrom = projects.length ? pageStart + 1 : 0;
  const visibleThrough = Math.min(pageStart + visibleProjects.length, projects.length);
  const clients = [
    ...new Set(
      allProjects.map((row) => row.companyName).filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const statuses = [...new Set(allProjects.map((row) => row.status).filter(Boolean))].sort();
  const types = getAvailableProjectTypes(allProjects);
  const requestedAction = one(params.action);
  const requestedMode =
    requestedAction === "compare" || requestedAction === "combine"
      ? requestedAction
      : one(params.mode);
  const mode = requestedMode === "compare" || requestedMode === "combine" ? requestedMode : null;
  const selectedIds = [...new Set(many(params.project))];
  const selected = selectedIds
    .map((id) => allProjects.find((row) => row.id === id))
    .filter((row): row is ProjectReportRow => Boolean(row));
  const compareOverLimit = mode === "compare" && selected.length > 6;
  const reportProjects = compareOverLimit ? [] : selected;
  const comparedProjectGroups =
    mode === "compare" && reportProjects.length
      ? await getComparedProjectOperationalGroups(reportProjects)
      : [];
  const combinedGroups =
    mode === "combine" && reportProjects.length
      ? await getPortfolioOperationalGroups(reportProjects)
      : [];
  const combinedHistoricalSeries =
    mode === "combine" && reportProjects.length
      ? await getPortfolioHistoricalProfitSeries(reportProjects)
      : [];
  const pageTitle =
    mode === "combine" && reportProjects.length
      ? "Combined Project Report"
      : mode === "compare" && reportProjects.length
        ? "Compared Project Report"
        : "Compare or Combine Projects";
  const pageDescription =
    mode === "combine" && reportProjects.length
      ? `Combined view of ${reportProjects.length} selected projects. Operational groups are rolled up across the selection.`
      : mode === "compare" && reportProjects.length
        ? `Side-by-side view of ${reportProjects.length} selected projects. Compare mode is limited to six projects.`
        : "Filter the portfolio, compare up to six projects, or combine any number into one report.";
  const filterResetHref = resetHref(mode, selectedIds, pageSize);

  return (
    <AppShell user={session.user} contentTone={mode === "combine" ? "portfolio" : "default"}>
      <main className="shell shell--wide projects-workspace executive-dashboard">
        <section className="report-titlebar">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
        </section>

        {mode && reportProjects.length ? (
          mode === "compare" ? (
            <ProjectComparisonReport
              projects={reportProjects}
              projectGroups={comparedProjectGroups}
            />
          ) : (
            <CombinedPortfolioReport
              projects={reportProjects}
              groups={combinedGroups}
              historicalSeries={combinedHistoricalSeries}
              historicalInitialRange={{ from: filter.dateFrom, to: filter.dateTo }}
            />
          )
        ) : null}

        {compareOverLimit ? (
          <div className="selection-alert selection-alert--error" role="alert">
            <strong>Compare mode is limited to six projects.</strong>
            <span>
              You selected {selected.length}. Remove {selected.length - 6} project
              {selected.length - 6 === 1 ? "" : "s"}, or use Combine selected for an unlimited
              aggregate report.
            </span>
          </div>
        ) : null}

        {mode && !selected.length ? (
          <div className="selection-alert" role="status">
            <strong>Select at least one project.</strong>
            <span>Use the checkboxes below, then choose Compare selected or Combine selected.</span>
          </div>
        ) : null}

        <section
          className="selection-action-bar selection-action-bar--top"
          aria-label="Project selection workspace"
        >
          <div className="selection-action-bar__copy">
            <p className="eyebrow">Selection workspace</p>
            <strong>
              {selectedIds.length
                ? `${selectedIds.length} project${selectedIds.length === 1 ? "" : "s"} selected`
                : "Select projects below"}
            </strong>
            <span>
              Compare is limited to six projects. Combine has no application limit and aggregates
              the selected portfolio.
            </span>
            <span className="selection-action-bar__count">
              <b>{projects.length}</b> of {allProjects.length} reporting projects
            </span>
          </div>
          <div className="selection-action-bar__controls">
            <div className="selection-action-bar__buttons">
              <button
                className="button button--secondary"
                type="submit"
                form="project-selection"
                name="action"
                value="compare"
              >
                Compare selected
                <small>Up to 6 projects</small>
              </button>
              <button
                className="button button--primary"
                type="submit"
                form="project-selection"
                name="action"
                value="combine"
              >
                Combine selected
                <small>Unlimited projects</small>
              </button>
            </div>
            <span className="selection-action-bar__note">
              Filtered results remain available while comparison or combination reports are open.
            </span>
          </div>
        </section>

        <section
          className="projects-filter-region projects-filter-region--list"
          aria-label="Project search and filters"
        >
          <ProjectFilterBar
            action="/projects"
            filter={filter}
            clients={clients}
            statuses={statuses}
            types={types}
            resetHref={filterResetHref}
            preservedMode={mode}
            preservedProjectIds={selectedIds}
            preservedPageSize={pageSize}
          />
        </section>

        <form
          id="project-selection"
          className="project-selection-form"
          action="/projects"
          method="get"
        >
          {hiddenFilterFields(filter).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {mode ? <input type="hidden" name="mode" value={mode} /> : null}
          {selectedIds
            .filter((projectId) => !visibleProjectIds.has(projectId))
            .map((projectId) => (
              <input key={projectId} type="hidden" name="project" value={projectId} />
            ))}

          <ProjectTable rows={visibleProjects} selectable selectedProjectIds={selectedIds} />

          <div className="project-list-pagination" aria-label="Project list pagination">
            <div className="project-list-pagination__summary">
              <strong>
                {projects.length ? `Showing ${visibleFrom}–${visibleThrough}` : "Showing 0"}
              </strong>
              <span>
                of {projects.length} matching project{projects.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="project-list-pagination__pages">
              <button
                className="button button--secondary"
                type="submit"
                name="page"
                value={Math.max(1, currentPage - 1)}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              {pageButtons(currentPage, pageCount).map((page, index, pages) => (
                <span className="project-list-pagination__page-slot" key={page}>
                  {index > 0 && page - pages[index - 1] > 1 ? (
                    <span className="project-list-pagination__ellipsis" aria-hidden="true">
                      …
                    </span>
                  ) : null}
                  <button
                    className={`project-list-pagination__page${page === currentPage ? " project-list-pagination__page--active" : ""}`}
                    type="submit"
                    name="page"
                    value={page}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </button>
                </span>
              ))}
              <button
                className="button button--secondary"
                type="submit"
                name="page"
                value={Math.min(pageCount, currentPage + 1)}
                disabled={currentPage >= pageCount}
              >
                Next
              </button>
            </div>

            <ProjectPageSizeSelect formId="project-selection" value={pageSize} />
          </div>

          <div className="selection-action-bar selection-action-bar--bottom">
            <div>
              <strong>Ready to analyze the selected projects?</strong>
              <span>
                Compare keeps each project separate. Combine produces one aggregate financial and
                performance view.
              </span>
            </div>
            <div className="selection-action-bar__buttons">
              <button
                className="button button--secondary"
                type="submit"
                name="action"
                value="compare"
              >
                Compare selected
              </button>
              <button
                className="button button--primary"
                type="submit"
                name="action"
                value="combine"
              >
                Combine selected
              </button>
            </div>
          </div>
        </form>
      </main>
    </AppShell>
  );
}
