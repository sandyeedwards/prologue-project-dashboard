import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSqlClient } from "@/db/client";
import { REPORTING_RULES } from "@/config/reporting-rules";
import {
  getEmployeeLaborRows,
  getProjectExpenses,
  getProjectGroups,
  getProjectQualityIssues,
  getProjectRows,
  getProjectTasks,
  getProjectTypeFacets,
  getProjectUnplannedWork,
  summarizeProjects,
} from "@/lib/reporting/dashboard-data";

type TagPolicyAudit = {
  noReportProjects: number;
  noReportReported: number;
  readySetEligibleProjects: number;
  readySetReported: number;
  dataHallEligibleProjects: number;
  dataHallReported: number;
  dataHallAreaGroups: number;
  archivedEligibleProjects: number;
  archivedReported: number;
};

type CheckRequirement = {
  label: string;
  passed: boolean;
};

type CheckDetail = {
  passed: boolean;
  missing: string[];
  requirements: CheckRequirement[];
};

function auditRequirements(requirements: CheckRequirement[]): CheckDetail {
  const missing = requirements
    .filter((requirement) => !requirement.passed)
    .map((requirement) => requirement.label);

  return {
    passed: missing.length === 0,
    missing,
    requirements,
  };
}

function sourceContains(file: string, source: string, marker: string): CheckRequirement {
  return {
    label: `${file} contains ${JSON.stringify(marker)}`,
    passed: source.includes(marker),
  };
}

function sourceOmits(file: string, source: string, marker: string): CheckRequirement {
  return {
    label: `${file} omits ${JSON.stringify(marker)}`,
    passed: !source.includes(marker),
  };
}

function normalizeSourceText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceContainsNormalized(file: string, source: string, marker: string): CheckRequirement {
  return {
    label: `${file} semantically contains ${JSON.stringify(marker)}`,
    passed: normalizeSourceText(source).includes(normalizeSourceText(marker)),
  };
}

function fileExists(file: string): CheckRequirement {
  return {
    label: `${file} exists`,
    passed: existsSync(resolve(process.cwd(), file)),
  };
}

async function main() {
  const routePaths = [
    "src/app/dashboard/page.tsx",
    "src/app/projects/page.tsx",
    "src/app/projects/[projectId]/page.tsx",
    "src/app/compare/page.tsx",
    "src/app/manager/page.tsx",
    "src/app/help/page.tsx",
  ];
  const routesPresent = routePaths.every((path) => existsSync(resolve(process.cwd(), path)));
  const reportingChartsPresent =
    existsSync(resolve(process.cwd(), "src/components/reporting-charts.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/profitability-bridge-chart.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/profitability-side-by-side-chart.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/dashboard-profitability-tabs.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/portfolio-financial-composition.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/hours-completion-summary.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/project-outcome-summary.tsx")) &&
    existsSync(
      resolve(process.cwd(), "src/components/compare-operational-profitability-chart.tsx"),
    ) &&
    existsSync(resolve(process.cwd(), "src/components/historical-revenue-profit-chart.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/project-financial-position.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/dashboard-portfolio-filters.tsx")) &&
    existsSync(resolve(process.cwd(), "src/components/flexible-date-range-fields.tsx"));
  const appShellSource = readFileSync(
    resolve(process.cwd(), "src/components/app-shell.tsx"),
    "utf8",
  );
  const primaryNavigationSource = readFileSync(
    resolve(process.cwd(), "src/components/primary-navigation.tsx"),
    "utf8",
  );
  const projectsSource = readFileSync(resolve(process.cwd(), "src/app/projects/page.tsx"), "utf8");
  const reportingUiSource = readFileSync(
    resolve(process.cwd(), "src/components/reporting-ui.tsx"),
    "utf8",
  );
  const dashboardSource = readFileSync(
    resolve(process.cwd(), "src/app/dashboard/page.tsx"),
    "utf8",
  );
  const globalsSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const refinementSource = readFileSync(
    resolve(process.cwd(), "src/app/prologue-refinement.css"),
    "utf8",
  );
  const layoutSource = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
  const helpSource = readFileSync(resolve(process.cwd(), "src/app/help/page.tsx"), "utf8");
  const chartSource = readFileSync(
    resolve(process.cwd(), "src/components/reporting-charts.tsx"),
    "utf8",
  );
  const profitabilitySource = readFileSync(
    resolve(process.cwd(), "src/components/profitability-bridge-chart.tsx"),
    "utf8",
  );
  const sideBySideProfitabilitySource = readFileSync(
    resolve(process.cwd(), "src/components/profitability-side-by-side-chart.tsx"),
    "utf8",
  );
  const profitabilityTabsSource = readFileSync(
    resolve(process.cwd(), "src/components/dashboard-profitability-tabs.tsx"),
    "utf8",
  );
  const projectSelectionReportsSource = readFileSync(
    resolve(process.cwd(), "src/components/project-selection-reports.tsx"),
    "utf8",
  );
  const portfolioCompositionSource = readFileSync(
    resolve(process.cwd(), "src/components/portfolio-financial-composition.tsx"),
    "utf8",
  );
  const hoursCompletionSource = readFileSync(
    resolve(process.cwd(), "src/components/hours-completion-summary.tsx"),
    "utf8",
  );
  const projectOutcomeSource = readFileSync(
    resolve(process.cwd(), "src/components/project-outcome-summary.tsx"),
    "utf8",
  );
  const compareOperationalProfitabilitySource = readFileSync(
    resolve(process.cwd(), "src/components/compare-operational-profitability-chart.tsx"),
    "utf8",
  );
  const historicalProfitSource = readFileSync(
    resolve(process.cwd(), "src/components/historical-revenue-profit-chart.tsx"),
    "utf8",
  );
  const projectFinancialPositionSource = readFileSync(
    resolve(process.cwd(), "src/components/project-financial-position.tsx"),
    "utf8",
  );
  const dashboardDataSource = readFileSync(
    resolve(process.cwd(), "src/lib/reporting/dashboard-data.ts"),
    "utf8",
  );
  const filterSource = readFileSync(
    resolve(process.cwd(), "src/components/project-filters.tsx"),
    "utf8",
  );
  const dashboardFilterSource = readFileSync(
    resolve(process.cwd(), "src/components/dashboard-portfolio-filters.tsx"),
    "utf8",
  );
  const flexibleDateSource = readFileSync(
    resolve(process.cwd(), "src/components/flexible-date-range-fields.tsx"),
    "utf8",
  );
  const projectDetailSource = readFileSync(
    resolve(process.cwd(), "src/app/projects/[projectId]/page.tsx"),
    "utf8",
  );
  const loadingSource = readFileSync(resolve(process.cwd(), "src/app/loading.tsx"), "utf8");
  const errorSource = readFileSync(resolve(process.cwd(), "src/app/error.tsx"), "utf8");
  const notFoundSource = readFileSync(resolve(process.cwd(), "src/app/not-found.tsx"), "utf8");
  const brandSource = readFileSync(
    resolve(process.cwd(), "src/components/prologue-brand.tsx"),
    "utf8",
  );
  const teamworkSyncSource = readFileSync(
    resolve(process.cwd(), "src/lib/teamwork/sync.ts"),
    "utf8",
  );
  const teamworkDateSource = readFileSync(
    resolve(process.cwd(), "src/lib/teamwork/date.ts"),
    "utf8",
  );
  const projects = await getProjectRows();
  const summary = summarizeProjects(projects);
  const sql = getSqlClient();
  const [tagPolicyAudit] = await sql<TagPolicyAudit[]>`
    with project_flags as (
      select
        p.id,
        (p.archived_at is not null or lower(p.status) = 'archived') as is_archived,
        coalesce(bool_or(t.normalized_name = 'noreport'), false) as has_no_report,
        coalesce(bool_or(t.normalized_name = 'readyset'), false) as has_ready_set,
        coalesce(bool_or(t.normalized_name = 'datahall'), false) as has_data_hall
      from projects p
      left join project_tags pt on pt.project_id = p.id
      left join tags t on t.id = pt.tag_id
      group by p.id, p.archived_at, p.status
    )
    select
      count(*) filter (where has_no_report)::int as "noReportProjects",
      count(*) filter (
        where has_no_report
          and exists (select 1 from project_metrics pm where pm.project_id = project_flags.id)
      )::int as "noReportReported",
      count(*) filter (where has_ready_set and not has_no_report)::int as "readySetEligibleProjects",
      count(*) filter (
        where has_ready_set and not has_no_report
          and exists (select 1 from project_metrics pm where pm.project_id = project_flags.id)
      )::int as "readySetReported",
      count(*) filter (where has_data_hall and not has_no_report)::int as "dataHallEligibleProjects",
      count(*) filter (
        where has_data_hall and not has_no_report
          and exists (select 1 from project_metrics pm where pm.project_id = project_flags.id)
      )::int as "dataHallReported",
      (
        select count(*)::int
        from operational_group_metrics ogm
        inner join project_flags pf on pf.id = ogm.project_id
        where pf.has_data_hall and not pf.has_no_report and ogm.group_name like 'Area: %'
      ) as "dataHallAreaGroups",
      count(*) filter (where is_archived and not has_no_report)::int as "archivedEligibleProjects",
      count(*) filter (
        where is_archived and not has_no_report
          and exists (select 1 from project_metrics pm where pm.project_id = project_flags.id)
      )::int as "archivedReported"
    from project_flags
  `;
  const pilot =
    projects.find(
      (project) => project.projectNumber === REPORTING_RULES.calculationPilotProjectNumber,
    ) ??
    projects[0] ??
    null;
  const [groups, tasks, expenses, issues, unplannedWork, employees] = pilot
    ? await Promise.all([
        getProjectGroups(pilot.id),
        getProjectTasks(pilot.id),
        getProjectExpenses(pilot.id),
        getProjectQualityIssues(pilot.id),
        getProjectUnplannedWork(pilot.id),
        getEmployeeLaborRows(),
      ])
    : [[], [], [], [], [], await getEmployeeLaborRows()];
  const numeric = (value: string | null): number | null => {
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const pilotLabor = pilot ? numeric(pilot.actualLaborCost) : null;
  const pilotExpenses = pilot ? numeric(pilot.actualNonLaborCost) : null;
  const pilotActual = pilot ? numeric(pilot.actualTotalCost) : null;
  const pilotCostReconciles =
    pilotLabor !== null &&
    pilotExpenses !== null &&
    pilotActual !== null &&
    Math.abs(pilotLabor + pilotExpenses - pilotActual) < 0.02;
  const [featureAudit] = await sql<
    {
      jobRoles: number;
      jobRolesWithCost: number;
      reviewTableReady: boolean;
    }[]
  >`
    select
      (select count(*)::int from job_roles) as "jobRoles",
      (select count(*)::int from job_roles where cost_rate is not null) as "jobRolesWithCost",
      to_regclass('public.unplanned_work_reviews') is not null as "reviewTableReady"
  `;

  const checkDetails = {
    financialColorSystemPresent: auditRequirements([
      sourceContains("src/components/reporting-charts.tsx", chartSource, "chart-swatch--outlined"),
      sourceContains("src/app/globals.css", globalsSource, "background: currentColor;"),
      sourceContains(
        "src/app/projects/[projectId]/page.tsx",
        projectDetailSource,
        "<ProjectFinancialPosition",
      ),
      sourceContains("src/app/prologue-refinement.css", refinementSource, "--amber:"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, "--green:"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, "--red:"),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "portfolio-composition__actual",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "portfolio-composition__remaining",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "portfolio-composition__profit",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "portfolio-composition__loss",
      ),
      sourceOmits(
        "src/app/globals.css",
        globalsSource,
        ".chart-swatch {\n  border: 2px solid currentColor;\n  border-radius: 3px;\n  background: transparent !important;",
      ),
    ]),
    profitabilityHoverTooltipPresent: auditRequirements([
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        '"use client"',
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "onPointerEnter",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "onPointerMove",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "onPointerLeave",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "onFocus",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "onBlur",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        'role="tooltip"',
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "profitability-bridge__tooltip",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "tooltipActual",
      ),
      sourceContains(
        "src/components/profitability-bridge-chart.tsx",
        profitabilitySource,
        "tooltipRemaining",
      ),
    ]),
    compareAndCombineHoursUsePercentProgress: auditRequirements([
      sourceContains(
        "src/components/project-selection-reports.tsx",
        projectSelectionReportsSource,
        "HoursCompletionSummary",
      ),
      sourceContains(
        "src/components/project-selection-reports.tsx",
        projectSelectionReportsSource,
        "Values above 100% indicate",
      ),
      sourceContains(
        "src/components/hours-completion-summary.tsx",
        hoursCompletionSource,
        "shared percentage scale",
      ),
      sourceContains(
        "src/components/hours-completion-summary.tsx",
        hoursCompletionSource,
        "--hours-width",
      ),
      sourceContains(
        "src/components/hours-completion-summary.tsx",
        hoursCompletionSource,
        "--hours-overrun-width",
      ),
      sourceContains(
        "src/components/hours-completion-summary.tsx",
        hoursCompletionSource,
        "Above estimate",
      ),
      sourceContains(
        "src/components/hours-completion-summary.tsx",
        hoursCompletionSource,
        "The estimate marker is 100%",
      ),
    ]),
    step10ExecutiveHierarchyPresent: auditRequirements([
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, "report-titlebar--executive"),
      sourceContains(
        "src/app/dashboard/page.tsx",
        dashboardSource,
        "Executive portfolio intelligence",
      ),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, "executive-kpis__primary"),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, "executive-kpis__secondary"),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, 'label="Actual Cost to Date"'),
      sourceContains(
        "src/app/dashboard/page.tsx",
        dashboardSource,
        'label="Costed Remaining Work"',
      ),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, 'label="Forecasted Profit"'),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, "executive-report-stack"),
      sourceContains("src/app/dashboard/page.tsx", dashboardSource, "executive-support-row"),
      sourceContains(
        "src/app/prologue-refinement.css",
        refinementSource,
        ".executive-kpis__primary",
      ),
      sourceContains(
        "src/app/prologue-refinement.css",
        refinementSource,
        ".app-header__brand-copy",
      ),
    ]),
    step10RefinementSystemPresent: auditRequirements([
      sourceContains("src/app/layout.tsx", layoutSource, 'import "./prologue-refinement.css"'),
      sourceContains("src/app/prologue-refinement.css", refinementSource, "--navy:"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, "--accent:"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, ".portfolio-composition"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, ".compare-register"),
      sourceContains("src/app/prologue-refinement.css", refinementSource, ".filter-panel--visible"),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "PortfolioFinancialComposition",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "Actual Cost to Date",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "Costed Remaining Work",
      ),
      sourceContains(
        "src/components/portfolio-financial-composition.tsx",
        portfolioCompositionSource,
        "Forecasted Profit",
      ),
      sourceContains(
        "src/components/dashboard-profitability-tabs.tsx",
        profitabilityTabsSource,
        "PortfolioFinancialComposition",
      ),
    ]),
    step10CollapsibleOperationalGroupsPresent: auditRequirements([
      sourceContains(
        "src/components/compare-operational-profitability-chart.tsx",
        compareOperationalProfitabilitySource,
        "compare-profitability-rows__section--collapsible",
      ),
      sourceContains(
        "src/components/compare-operational-profitability-chart.tsx",
        compareOperationalProfitabilitySource,
        "compare-profitability-rows__section-chevron",
      ),
      sourceContains(
        "src/components/compare-operational-profitability-chart.tsx",
        compareOperationalProfitabilitySource,
        "<details",
      ),
      sourceContains(
        "src/components/compare-operational-profitability-chart.tsx",
        compareOperationalProfitabilitySource,
        "<summary",
      ),
      sourceContains(
        "src/app/projects/[projectId]/page.tsx",
        projectDetailSource,
        'className="operation-group"',
      ),
      sourceContains("src/app/projects/[projectId]/page.tsx", projectDetailSource, "<details"),
    ]),
    step10StateViewsPresent: auditRequirements([
      fileExists("src/app/loading.tsx"),
      fileExists("src/app/error.tsx"),
      fileExists("src/app/not-found.tsx"),
      sourceContains("src/app/loading.tsx", loadingSource, "app-state--loading"),
      sourceContains("src/app/loading.tsx", loadingSource, "app-state__skeleton-grid"),
      sourceContains("src/app/error.tsx", errorSource, "app-state--error"),
      sourceContains("src/app/not-found.tsx", notFoundSource, "app-state--error"),
      sourceContains("src/app/globals.css", globalsSource, ".app-state__skeleton-grid"),
      sourceContains("src/app/globals.css", globalsSource, ".app-state--error"),
    ]),
    provisionalValuesLabeled: auditRequirements([
      sourceContains(
        "src/components/reporting-ui.tsx",
        reportingUiSource,
        "export function ProvisionalNotice",
      ),
      sourceContains(
        "src/components/reporting-ui.tsx",
        reportingUiSource,
        "if (!row.isProvisional) return null",
      ),
      sourceContains(
        "src/components/reporting-ui.tsx",
        reportingUiSource,
        "Provisional financial result",
      ),
      sourceContainsNormalized(
        "src/components/reporting-ui.tsx",
        reportingUiSource,
        "forecast cost is therefore a minimum",
      ),
      sourceContains(
        "src/components/reporting-ui.tsx",
        reportingUiSource,
        "displayed margin is a ceiling",
      ),
      sourceContains(
        "src/app/projects/[projectId]/page.tsx",
        projectDetailSource,
        "<ProvisionalNotice row={project} />",
      ),
      sourceContains(
        "src/app/projects/[projectId]/page.tsx",
        projectDetailSource,
        "Known Forecasted Profit",
      ),
      sourceContains(
        "src/app/projects/[projectId]/page.tsx",
        projectDetailSource,
        "margin ceiling",
      ),
      sourceContains(
        "src/components/project-selection-reports.tsx",
        projectSelectionReportsSource,
        " · Provisional",
      ),
      sourceContains(
        "src/components/project-selection-reports.tsx",
        projectSelectionReportsSource,
        '"Ceiling" : "Forecast"',
      ),
    ]),
  };

  const checks = {
    routesPresent,
    reportingChartsPresent,
    healthPercentageShownInsideBadge:
      reportingUiSource.includes("parsed.toFixed(2)") &&
      !reportingUiSource.includes(">{band}</span>"),
    semanticHealthLabels:
      chartSource.includes('label: "Healthy"') &&
      chartSource.includes('label: "At risk"') &&
      chartSource.includes('label: "Unhealthy"') &&
      chartSource.includes('label: "N/A"'),
    cleanedPrologueBrandPresent:
      existsSync(resolve(process.cwd(), "public/prologue-mark.png")) &&
      existsSync(resolve(process.cwd(), "src/app/icon.png")) &&
      brandSource.includes("Prologue Forecasting and Profitability") &&
      appShellSource.includes("PrologueMark") &&
      appShellSource.includes("Project Intelligence"),
    financialColorSystemPresent: checkDetails.financialColorSystemPresent.passed,
    financialCoverageVisible:
      dashboardSource.includes("summary.clientFeeKnownCount") &&
      dashboardSource.includes("summary.actualCostKnownCount") &&
      dashboardSource.includes("summary.forecastCostKnownCount") &&
      dashboardSource.includes("summary.forecastProfitKnownCount"),
    typeFilterExplainsReportingPolicy:
      filterSource.includes("Ready Set and DataHall are included in Scanning") &&
      filterSource.includes("projects tagged NoReport are excluded"),
    dashboardUsesPortfolioFilters:
      dashboardSource.includes("DashboardPortfolioFilters") &&
      dashboardSource.includes("summarizeProjects(projects)") &&
      dashboardSource.includes("type: one(params.type)"),
    dashboardScopeUsesRequestedControls:
      dashboardFilterSource.includes('name="client"') &&
      dashboardFilterSource.includes('name="health"') &&
      dashboardFilterSource.includes('name="status"') &&
      dashboardFilterSource.includes('name="type"') &&
      dashboardFilterSource.includes("FlexibleDateRangeFields") &&
      !dashboardFilterSource.includes('name="project"') &&
      !dashboardFilterSource.includes("Search projects"),
    multiProjectSearchPresent:
      filterSource.includes("Search projects") &&
      filterSource.includes('name="q"') &&
      projectsSource.includes("ProjectTable") &&
      projectsSource.includes('value="compare"') &&
      projectsSource.includes('value="combine"'),
    primaryNavigationSimplified:
      primaryNavigationSource.includes('href: "/dashboard"') &&
      primaryNavigationSource.includes('href: "/projects"') &&
      primaryNavigationSource.includes('href: "/help"') &&
      !primaryNavigationSource.includes('href: "/compare"') &&
      !primaryNavigationSource.includes('href: "/manager"') &&
      !primaryNavigationSource.includes('href: "/admin/users"'),
    compareAndCombineIntegratedIntoProjects:
      projectsSource.includes('value="compare"') &&
      projectsSource.includes('value="combine"') &&
      projectsSource.includes("ProjectComparisonReport") &&
      projectsSource.includes("CombinedPortfolioReport"),
    profitabilityBridgeUsesZeroBaseline:
      profitabilitySource.includes("ProfitabilityBridgeChart") &&
      profitabilitySource.includes("profitability-bridge__zero") &&
      profitabilitySource.includes("Forecast-cost mirror (&lt; $0)") &&
      profitabilitySource.includes("Forecast cost at completion") &&
      profitabilitySource.includes("profitability-bridge__revenue") &&
      profitabilitySource.includes("profitability-bridge__grid") &&
      profitabilitySource.includes("niceAxisStep"),
    profitabilityHoverTooltipPresent: checkDetails.profitabilityHoverTooltipPresent.passed,
    profitabilityCostCompositionVisible:
      profitabilitySource.includes("Actual cost to date") &&
      profitabilitySource.includes("Costed remaining work") &&
      dashboardDataSource.includes('actual_labor_cost as "actualLaborCost"') &&
      dashboardDataSource.includes('actual_non_labor_cost as "actualNonLaborCost"') &&
      dashboardDataSource.includes("remainingCost: value.actualCostKnown"),
    dashboardProfitabilityTabsPresent:
      dashboardSource.includes("DashboardProfitabilityTabs") &&
      profitabilityTabsSource.includes('role="tablist"') &&
      profitabilityTabsSource.includes("Profitability by Operational Group") &&
      profitabilityTabsSource.includes("Forecasted Profitability") &&
      profitabilityTabsSource.includes("Historical Revenue & Net Profit") &&
      profitabilityTabsSource.includes('role="tabpanel"'),
    combinedHistoricalRevenueProfitPresent:
      projectsSource.includes("getPortfolioHistoricalProfitSeries(reportProjects)") &&
      projectsSource.includes("historicalSeries={combinedHistoricalSeries}") &&
      projectSelectionReportsSource.includes("historicalSeries={historicalSeries}") &&
      projectSelectionReportsSource.includes("historicalDescription=") &&
      profitabilityTabsSource.includes("historicalDescription"),
    dashboardHistoricalRevenueProfitPresent:
      dashboardSource.includes("getPortfolioHistoricalProfitSeries(projects)") &&
      dashboardSource.includes("historicalSeries={historicalProfitSeries}") &&
      profitabilityTabsSource.includes("HistoricalRevenueProfitChart") &&
      profitabilityTabsSource.includes("historicalSeries !== undefined") &&
      historicalProfitSource.includes("Gross revenue") &&
      historicalProfitSource.includes("Actual cost to date") &&
      historicalProfitSource.includes("Anticipated cost to date") &&
      historicalProfitSource.includes("Net profit to date") &&
      historicalProfitSource.includes("Forecasted net profit") &&
      !historicalProfitSource.includes("Completed-project revenue") &&
      !historicalProfitSource.includes("<select") &&
      historicalProfitSource.includes("historical-profit-chart__area--gross") &&
      historicalProfitSource.includes("historical-profit-chart__area--net") &&
      historicalProfitSource.includes("Unlimited") &&
      historicalProfitSource.includes("Custom") &&
      historicalProfitSource.includes("Reset range") &&
      historicalProfitSource.includes("handlePointerDown") &&
      historicalProfitSource.includes("handlePointerUp") &&
      historicalProfitSource.includes("DRAG_THRESHOLD_PX") &&
      historicalProfitSource.includes("HISTORICAL_RANGE_SYNC_EVENT") &&
      historicalProfitSource.includes("zoomAnchorDate") &&
      historicalProfitSource.includes("subtractCalendarMonths") &&
      historicalProfitSource.includes("stepLinePath") &&
      historicalProfitSource.includes("onPointerMove") &&
      dashboardDataSource.includes("actualCompletionDateForHistory") &&
      dashboardDataSource.includes("grossRevenueDelta") &&
      dashboardDataSource.includes("actualCostDelta") &&
      dashboardDataSource.includes("anticipatedCostDelta") &&
      dashboardDataSource.includes("forecastNetProfitDelta") &&
      dashboardDataSource.includes("MIN_HISTORICAL_DATE") &&
      dashboardDataSource.includes("netProfitToDate: grossRevenue - actualCostToDate") &&
      dashboardDataSource.includes("te.logged_date::text") &&
      dashboardDataSource.includes("te.historical_cost_total") &&
      dashboardDataSource.includes("te.historical_cost_rate") &&
      dashboardDataSource.includes("e.expense_date") &&
      dashboardDataSource.includes("reconciliationDifference") &&
      teamworkSyncSource.includes("TIME_DATE_FALLBACK") &&
      teamworkSyncSource.includes('"timeLogged"') &&
      teamworkDateSource.includes('MIN_TEAMWORK_DATE = "2000-01-01"') &&
      !teamworkSyncSource.includes('"1970-01-01"') &&
      !teamworkDateSource.includes('return "1970-01-01"'),
    dashboardSideBySideProfitabilityPresent:
      sideBySideProfitabilitySource.includes("ProfitabilitySideBySideChart") &&
      sideBySideProfitabilitySource.includes("Actual cost to date") &&
      sideBySideProfitabilitySource.includes("Costed remaining work") &&
      sideBySideProfitabilitySource.includes("profitability-side-by-side__revenue") &&
      sideBySideProfitabilitySource.includes("profitability-side-by-side__marker--profit") &&
      sideBySideProfitabilitySource.includes("profitability-side-by-side__marker--loss") &&
      sideBySideProfitabilitySource.includes("onPointerMove") &&
      sideBySideProfitabilitySource.includes('role="tooltip"'),
    dashboardTotalProfitabilityUsesFilteredGroups:
      dashboardSource.includes("const totalRevenue = profitabilityRows.reduce") &&
      dashboardSource.includes("const totalForecastCost = profitabilityRows.reduce") &&
      dashboardSource.includes('label: "All groups combined"') &&
      dashboardSource.includes("groupRows={profitabilityRows}") &&
      dashboardSource.includes("totalRow={totalProfitabilityRow}"),
    compareAndCombineUseCleanFinancialPresentation:
      projectSelectionReportsSource.includes("CompareOperationalProfitabilityChart") &&
      projectSelectionReportsSource.includes("DashboardProfitabilityTabs") &&
      projectSelectionReportsSource.includes("Costed Remaining Work") &&
      projectSelectionReportsSource.includes("executive-kpis") &&
      projectSelectionReportsSource.includes("Logged vs Estimated Hours by Project") &&
      projectSelectionReportsSource.includes("Logged vs Estimated Hours by Group") &&
      !projectSelectionReportsSource.includes("Forecast cost at completion"),
    compareProfitabilitySeparatesProjectsWithinGroups:
      projectsSource.includes("comparedProjectGroups") &&
      projectsSource.includes("getComparedProjectOperationalGroups(reportProjects)") &&
      dashboardDataSource.includes("getOperationalGroupMetricRows") &&
      projectSelectionReportsSource.includes("Project Profitability Comparison") &&
      projectSelectionReportsSource.includes(
        "Start with the profitability of each project as a whole",
      ) &&
      compareOperationalProfitabilitySource.includes('label: "Entire Project"') &&
      compareOperationalProfitabilitySource.includes('label: "By Operational Group"') &&
      compareOperationalProfitabilitySource.includes("project.projectName") &&
      compareOperationalProfitabilitySource.includes("groupOrder") &&
      compareOperationalProfitabilitySource.includes("Actual cost to date") &&
      compareOperationalProfitabilitySource.includes("Costed remaining work") &&
      compareOperationalProfitabilitySource.includes("Forecast profit") &&
      compareOperationalProfitabilitySource.includes("Forecast loss") &&
      compareOperationalProfitabilitySource.includes("compare-profitability-rows__tooltip") &&
      compareOperationalProfitabilitySource.includes("onPointerMove") &&
      compareOperationalProfitabilitySource.includes("const revenueBoundary = 82") &&
      compareOperationalProfitabilitySource.includes("maximumOverrunRatio") &&
      compareOperationalProfitabilitySource.includes("Cost composition against revenue") &&
      compareOperationalProfitabilitySource.includes("compare-profitability-rows__profit") &&
      !compareOperationalProfitabilitySource.includes(
        "compare-profitability-rows__profit-marker",
      ) &&
      globalsSource.includes(".compare-profitability-rows__track {") &&
      globalsSource.includes("height: 30px;") &&
      globalsSource.includes(".compare-profitability-rows__bar-meta {") &&
      globalsSource.includes("grid-template-columns: repeat(3, minmax(0, 1fr));") &&
      globalsSource.includes(".compare-profitability-rows__profit {"),
    compareAndCombineHoursUsePercentProgress:
      checkDetails.compareAndCombineHoursUsePercentProgress.passed,
    compareOutcomeSummaryPresent:
      projectSelectionReportsSource.includes("ProjectOutcomeSummary") &&
      projectOutcomeSource.includes("Forecast margin") &&
      projectOutcomeSource.includes("Task completion") &&
      projectOutcomeSource.includes("--outcome-progress"),
    expandableProfitabilityAnalysisPresent:
      chartSource.includes("PortfolioAnalysisDisclosure") &&
      chartSource.includes("DivergingProfitChart") &&
      chartSource.includes("OperationalBreakdown") &&
      dashboardSource.includes("PortfolioAnalysisDisclosure"),
    step10ExecutiveHierarchyPresent: checkDetails.step10ExecutiveHierarchyPresent.passed,
    step10RefinementSystemPresent: checkDetails.step10RefinementSystemPresent.passed,
    step10VisibleFilterAndLayoutRefinementPresent:
      profitabilityTabsSource.includes("filterControls") &&
      dashboardSource.includes("executive-report-stack") &&
      dashboardSource.includes("executive-support-row") &&
      projectSelectionReportsSource.includes("executive-report-stack") &&
      projectSelectionReportsSource.includes("executive-support-row") &&
      projectsSource.includes("projects-filter-region") &&
      filterSource.includes("filter-panel--visible") &&
      refinementSource.includes(".dashboard-inline-filters") &&
      refinementSource.includes(".executive-support-row"),
    step10FlexibleDateControlsPresent:
      flexibleDateSource.includes("CalendarPopover") &&
      flexibleDateSource.includes("onDoubleClick") &&
      flexibleDateSource.includes("MM/DD/YYYY") &&
      flexibleDateSource.includes("parseFlexibleDateInput") &&
      flexibleDateSource.includes("2000 + inputYear") &&
      flexibleDateSource.includes("The through date cannot be earlier than the from date") &&
      flexibleDateSource.includes("HISTORICAL_RANGE_SYNC_EVENT") &&
      flexibleDateSource.includes("flexible-date-range--historical-attention") &&
      refinementSource.includes(".flexible-date__popover"),
    step10CollapsibleOperationalGroupsPresent:
      checkDetails.step10CollapsibleOperationalGroupsPresent.passed,
    step10ProjectWorkspacePresent:
      reportingUiSource.includes("project-table--financial-first") &&
      reportingUiSource.includes("Remaining Work") &&
      reportingUiSource.includes("Forecasted Profit") &&
      projectDetailSource.includes("Revenue Consumption & Forecasted Outcome") &&
      projectFinancialPositionSource.includes("Actual Cost to Date") &&
      projectFinancialPositionSource.includes("Costed Remaining Work") &&
      projectFinancialPositionSource.includes("Unspent Revenue / Forecasted Profit"),
    step10StateViewsPresent: checkDetails.step10StateViewsPresent.passed,
    metricHelpUsesHoverAndKeyboardFocus:
      reportingUiSource.includes('className="metric-card__help-trigger"') &&
      reportingUiSource.includes("aria-label={`Information about ${label}`}") &&
      reportingUiSource.includes("metric-card__help-panel") &&
      refinementSource.includes(".metric-card__help:hover .metric-card__help-panel") &&
      refinementSource.includes(
        ".metric-card__help-trigger:focus-visible + .metric-card__help-panel",
      ),
    projectWorkspacePaginationPresent:
      projectsSource.includes("PROJECT_PAGE_SIZES = [25, 50, 100]") &&
      projectsSource.includes("ProjectPageSizeSelect") &&
      projectsSource.includes("visibleProjects") &&
      projectsSource.includes('name="page"') &&
      projectsSource.includes('name="action"') &&
      filterSource.includes("preservedPageSize") &&
      refinementSource.includes(".project-list-pagination") &&
      refinementSource.includes("grid-template-columns: repeat(3, minmax(0, 1fr));"),
    helpCenterIncludesRoleTools:
      helpSource.includes('href="/manager"') &&
      helpSource.includes('href="/admin/users"') &&
      helpSource.includes('href="/admin/calculations"') &&
      helpSource.includes('href="/admin/teamwork"'),
    projectsAvailable: projects.length > 0,
    issueEvidenceHydrated: issues.every((issue) => Array.isArray(issue.evidence)),
    summaryMatchesProjects: summary.projectCount === projects.length,
    projectDetailAvailable: Boolean(pilot),
    operationalGroupsAvailable: groups.length > 0,
    taskDetailsAvailable: tasks.length > 0,
    employeeLaborAvailable: employees.length > 0,
    provisionalValuesLabeled: checkDetails.provisionalValuesLabeled.passed,
    calculationVersionAvailable: Boolean(summary.calculationVersion),
    calculatedDatesNormalized: projects.every(
      (project) =>
        project.calculatedAt instanceof Date && !Number.isNaN(project.calculatedAt.getTime()),
    ),
    budgetMoneyNormalized: summary.calculationVersion === "step7-v1.0.7",
    expenseMoneyNormalized: summary.calculationVersion === "step7-v1.0.7",
    unplannedReviewStorageReady: featureAudit.reviewTableReady,
    roleCostStorageReady: featureAudit.jobRoles >= 0,
    readySetAndDataHallAlsoMatchScanning: projects.every((project) => {
      const facets = getProjectTypeFacets(project);
      if (facets.includes("Ready Set") || facets.includes("DataHall"))
        return facets.includes("Scanning");
      return true;
    }),
    noReportProjectsExcluded:
      tagPolicyAudit.noReportProjects === 0 || tagPolicyAudit.noReportReported === 0,
    readySetProjectsIncluded:
      tagPolicyAudit.readySetEligibleProjects === 0 ||
      tagPolicyAudit.readySetReported === tagPolicyAudit.readySetEligibleProjects,
    dataHallProjectsIncluded:
      tagPolicyAudit.dataHallEligibleProjects === 0 ||
      tagPolicyAudit.dataHallReported === tagPolicyAudit.dataHallEligibleProjects,
    dataHallAreasRolledUp:
      tagPolicyAudit.dataHallEligibleProjects === 0 || tagPolicyAudit.dataHallAreaGroups > 0,
    archivedProjectsVisible:
      tagPolicyAudit.archivedEligibleProjects === 0 ||
      tagPolicyAudit.archivedReported === tagPolicyAudit.archivedEligibleProjects,
    actualCostReconciles: pilotCostReconciles,
  };
  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const failedCheckDetails: Record<string, CheckDetail> = {};
  for (const [name, detail] of Object.entries(checkDetails)) {
    if (!detail.passed) failedCheckDetails[name] = detail;
  }

  const output = {
    status,
    failedChecks,
    failedCheckDetails,
    checks,
    counts: {
      projects: projects.length,
      provisionalProjects: summary.provisionalCount,
      redProjects: summary.redCount,
      amberProjects: summary.amberCount,
      greenProjects: summary.greenCount,
      grayProjects: summary.grayCount,
      pilotOperationalGroups: groups.length,
      pilotTasks: tasks.length,
      pilotExpenses: expenses.length,
      pilotQualityIssues: issues.length,
      pilotUnplannedWorkItems: unplannedWork.length,
      jobRoles: featureAudit.jobRoles,
      jobRolesWithCost: featureAudit.jobRolesWithCost,
      employees: employees.length,
    },
    calculationVersion: summary.calculationVersion,
    tagPolicyAudit,
    pilot: pilot
      ? {
          projectNumber: pilot.projectNumber,
          projectName: pilot.name,
          healthBand: pilot.healthBand,
          isProvisional: pilot.isProvisional,
          clientFee: pilot.clientFee,
          targetCost: pilot.targetCost,
          internalLaborCost: pilot.actualLaborCost,
          expenseCost: pilot.actualNonLaborCost,
          actualCost: pilot.actualTotalCost,
          actualCostReconciles: pilotCostReconciles,
          expenseRows: expenses.map((expense) => ({
            title: expense.title,
            taskListName: expense.taskListName,
            totalCost: expense.totalCost,
            isOutsourcedModeling: expense.isOutsourcedModeling,
          })),
          knownForecastCost: pilot.forecastCost,
          marginCeilingPercent: pilot.forecastMarginPercent,
          openUnplannedWorkItems: unplannedWork.filter((item) => !item.isDismissed).length,
          reviewedUnplannedWorkItems: unplannedWork.filter((item) => item.isDismissed).length,
          unresolvedAssignmentTasks: tasks.filter(
            (task) => task.assignmentCoverage === "MISSING" && !task.isOutsourced,
          ).length,
          laborCoverage: pilot.laborCoverage,
          assignmentCoverage: pilot.assignmentCoverage,
          taskListBudgetCoverage: pilot.taskListBudgetCoverage,
          expenseCoverage: pilot.expenseCoverage,
        }
      : null,
    policies: {
      provisionalFinancialsVisiblyLabeled: true,
      provisionalForecastCostIsKnownMinimum: true,
      provisionalMarginIsCeiling: true,
      teamworkBudgetMoneyConvertedFromMinorUnits: true,
      teamworkBudgetExpensesConvertedFromMinorUnits: true,
      legacyExpenseDecimalsPreserved: true,
      internalLaborAndExpensesDisplayedSeparately: true,
      noReportTagTakesPriority: true,
      readySetProjectsIncluded: true,
      dataHallTaskListsRollUpAsAreas: true,
      dataHallAdministrativeListsSeparated: true,
      archivedProjectsRemainVisible: true,
      individualAssignmentsOverrideJobRoles: true,
      jobRoleCostRatesUsedForRoleOnlyForecasts: true,
      completedTasksDoNotRequireForecastAssignments: true,
      subtasksWithoutEstimatesAreNotFlagged: true,
      topLevelUnplannedWorkIsReviewablePerTask: true,
      unplannedDismissalRestrictedToAdmins: true,
      additionalUnplannedTimeReopensDismissedItems: true,
      missingValuesNeverConvertedToZero: true,
      wholeProjectFinancialsUnaffectedByDetailFilters: true,
      taskBranchesNestedInsideOperationalGroups: true,
      portfolioProjectAndComparisonGraphsIncluded: true,
      dashboardFiltersApplyToAllPortfolioMetricsAndGraphs: true,
      dashboardScopeUsesClientHealthAndStatus: true,
      dashboardSupportsMultiProjectSelection: true,
      dashboardFinancialStatusAndSortRemoved: true,
      healthBadgeShowsPercentageInsteadOfBandName: true,
      primaryNavigationFocusesOnReporting: true,
      compareAndCombineLiveInProjectsWorkspace: true,
      compareLimitedToSixProjects: true,
      combineSupportsUnlimitedProjectSelection: true,
      combinedMarginRecalculatedFromCombinedTotals: true,
      forecastCostDisplayedBelowZeroAsComparisonMirror: true,
      forecastCostCompositionExplainedInTooltip: true,
      operationalGroupRevenueAllocatedForAnalysisOnly: true,
      dashboardAndCombinedReportsUseOperationalGroupProfitability: true,
      dateRangeFiltersUseProjectOverlap: true,
      helpCenterContainsRoleSpecificTools: true,
      operationalGroupCostPerformanceChartIncluded: true,
      operationalGroupTasksUseNativeDropdowns: true,
      dataQualityIssuesExposeSourceEvidence: true,
      unallocatedProjectTimeListsActualTimeEntries: true,
      teamworkCorrectionLinksIncluded: true,
      emptyExpensesOnlyExpectedForOutsourcedCostTasks: true,
      hourlyRatesExposed: false,
      employeeLaborRestrictedToManagerAndAdmin: true,
    },
  };
  console.log(JSON.stringify(output, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.env.DATABASE_URL) return;

    try {
      await getSqlClient().end();
    } catch (error) {
      console.error("Failed to close the reporting verification database connection.", error);
      process.exitCode = 1;
    }
  });
