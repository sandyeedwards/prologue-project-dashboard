import { describe, expect, it } from "vitest";
import {
  buildHistoricalProfitSeriesFromSource,
  filterAndSortProjects,
  getAvailableProjectTypes,
  getProjectTypeFacets,
  normalizeDatabaseDate,
  summarizeProjects,
  type HistoricalCostRecord,
  type ProjectReportRow,
} from "./dashboard-data";

const base: ProjectReportRow = {
  id: "1",
  teamworkId: 1,
  projectNumber: "26-120",
  name: "Four Seasons Jackson Hole",
  companyName: "Client",
  status: "active",
  projectType: "Scanning",
  startDate: "2026-04-10",
  endDate: "2026-06-29",
  archivedAt: null,
  completedAt: null,
  clientFee: "100000.00",
  targetCost: "50000.00",
  actualLaborCost: "700.00",
  actualNonLaborCost: "300.00",
  actualTotalCost: "1000.00",
  forecastCost: "3525.00",
  forecastProfit: "96475.00",
  forecastMarginPercent: "96.475",
  canonicalEstimatedMinutes: 100,
  loggedMinutes: 200,
  unplannedLoggedMinutes: 0,
  completedTaskCount: 5,
  totalTaskCount: 10,
  progressPercent: "50",
  healthScore: "90",
  healthBand: "GREEN",
  laborCoverage: "COMPLETE",
  assignmentCoverage: "MISSING",
  taskListBudgetCoverage: "PARTIAL",
  expenseCoverage: "COMPLETE",
  isProvisional: true,
  dataQualityIssueCount: 2,
  tags: ["Scanning"],
  calculatedAt: new Date("2026-07-22T00:00:00Z"),
  calculationVersion: "step7-v1.0.7",
};

describe("reporting filters", () => {
  it("finds projects by number and tag", () => {
    expect(filterAndSortProjects([base], { query: "26-120" })).toHaveLength(1);
    expect(filterAndSortProjects([base], { query: "scanning" })).toHaveLength(1);
  });

  it("filters provisional values", () => {
    expect(filterAndSortProjects([base], { provisional: "YES" })).toHaveLength(1);
    expect(filterAndSortProjects([base], { provisional: "NO" })).toHaveLength(0);
  });

  it("filters the same portfolio by health, status, and type", () => {
    expect(filterAndSortProjects([base], { health: "GREEN" })).toHaveLength(1);
    expect(filterAndSortProjects([base], { health: "RED" })).toHaveLength(0);
    expect(filterAndSortProjects([base], { status: "active" })).toHaveLength(1);
    expect(filterAndSortProjects([base], { type: "Scanning" })).toHaveLength(1);
  });

  it("supports client scope and explicit multi-project selection", () => {
    const second = { ...base, id: "2", companyName: "Another Client", name: "Second Project" };
    expect(filterAndSortProjects([base, second], { client: "Client" })).toEqual([base]);
    expect(filterAndSortProjects([base, second], { projectIds: ["2"] })).toEqual([second]);
    expect(
      filterAndSortProjects([base, second], { client: "Client", projectIds: ["2"] }),
    ).toHaveLength(0);
  });

  it("filters projects whose planned dates overlap the selected report period", () => {
    const later = {
      ...base,
      id: "2",
      name: "Later Project",
      startDate: "2026-09-01",
      endDate: "2026-10-15",
    };
    const undated = { ...base, id: "3", name: "Undated Project", startDate: null, endDate: null };
    expect(
      filterAndSortProjects([base, later, undated], {
        dateFrom: "2026-05-01",
        dateTo: "2026-07-01",
      }),
    ).toEqual([base]);
    expect(filterAndSortProjects([base, later], { dateFrom: "2026-07-01" })).toEqual([later]);
    expect(filterAndSortProjects([base, later], { dateTo: "2026-04-15" })).toEqual([base]);
  });

  it("treats Ready Set and DataHall projects as Scanning while preserving their special type", () => {
    const readySet = { ...base, id: "ready", projectType: "Ready Set", tags: ["Ready Set"] };
    const dataHall = { ...base, id: "hall", projectType: "DataHall", tags: ["DataHall"] };
    expect(getProjectTypeFacets(readySet)).toEqual(["Scanning", "Ready Set"]);
    expect(getProjectTypeFacets(dataHall)).toEqual(["Scanning", "DataHall"]);
    expect(filterAndSortProjects([readySet], { type: "Scanning" })).toHaveLength(1);
    expect(filterAndSortProjects([readySet], { type: "Ready Set" })).toHaveLength(1);
    expect(filterAndSortProjects([dataHall], { type: "DataHall" })).toHaveLength(1);
    expect(getAvailableProjectTypes([readySet, dataHall])).toEqual([
      "Scanning",
      "Ready Set",
      "DataHall",
    ]);
  });

  it("summarizes known values without treating partial source coverage as complete", () => {
    const summary = summarizeProjects([
      base,
      { ...base, id: "2", clientFee: null, laborCoverage: "PARTIAL" },
    ]);
    expect(summary.projectCount).toBe(2);
    expect(summary.totalClientFee).toBe(100000);
    expect(summary.clientFeeKnownCount).toBe(1);
    expect(summary.totalActualCost).toBe(2000);
    expect(summary.actualCostKnownCount).toBe(1);
    expect(summary.actualCostPartialCount).toBe(1);
    expect(summary.forecastCostKnownCount).toBe(2);
    expect(summary.forecastProfitKnownCount).toBe(2);
    expect(summary.forecastMarginKnownCount).toBe(2);
    expect(summary.provisionalCount).toBe(2);
  });
});

describe("database timestamp normalization", () => {
  it("converts a serialized PostgreSQL timestamp before dashboard sorting", () => {
    const result = normalizeDatabaseDate("2026-07-22T15:57:17.719Z", "calculatedAt");
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(Date.parse("2026-07-22T15:57:17.719Z"));
  });

  it("rejects malformed timestamp values with a useful field name", () => {
    expect(() => normalizeDatabaseDate("not-a-date", "calculatedAt")).toThrow(
      "calculatedAt is not a valid database timestamp",
    );
  });
});

describe("historical portfolio financial series", () => {
  it("recognizes labor and expenses on their source dates before project completion", () => {
    const project: ProjectReportRow = {
      ...base,
      id: "active",
      startDate: "2026-01-01",
      endDate: "2026-01-15",
      completedAt: null,
      archivedAt: null,
      clientFee: "1000.00",
      actualTotalCost: "150.00",
      forecastCost: "350.00",
      forecastProfit: "650.00",
      isProvisional: false,
    };
    const costs: HistoricalCostRecord[] = [
      { projectId: project.id, date: "2026-01-05", cost: 100, kind: "LABOR", fallbackDate: false },
      { projectId: project.id, date: "2026-01-10", cost: 50, kind: "EXPENSE", fallbackDate: false },
    ];

    const series = buildHistoricalProfitSeriesFromSource(
      "All project types",
      [project],
      costs,
      "2026-01-31",
    );

    expect(series.points.find((point) => point.date === "2026-01-05")).toMatchObject({
      grossRevenue: 1000,
      actualCostToDate: 100,
      anticipatedCostToDate: 350,
      netProfitToDate: 900,
      forecastNetProfitToDate: 650,
      completedProjectCount: 0,
    });
    expect(series.points.find((point) => point.date === "2026-01-10")).toMatchObject({
      actualCostToDate: 150,
      netProfitToDate: 850,
      completedProjectCount: 0,
    });
    expect(series.points.at(-1)).toMatchObject({
      actualCostToDate: 150,
      netProfitToDate: 850,
      completedProjectCount: 0,
    });
    expect(series.reconciliationDifference).toBe(0);
    expect(
      series.points.every(
        (point) => point.netProfitToDate === point.grossRevenue - point.actualCostToDate,
      ),
    ).toBe(true);
  });

  it("counts actual completed timestamps without moving revenue or cost at completion", () => {
    const project: ProjectReportRow = {
      ...base,
      id: "completed",
      startDate: "2026-01-01",
      endDate: "2026-01-15",
      completedAt: new Date("2026-01-20T12:00:00Z"),
      clientFee: "1000.00",
      actualTotalCost: "1200.00",
      isProvisional: false,
    };
    const costs: HistoricalCostRecord[] = [
      { projectId: project.id, date: "2026-01-05", cost: 1200, kind: "LABOR", fallbackDate: false },
    ];

    const series = buildHistoricalProfitSeriesFromSource(
      "All project types",
      [project],
      costs,
      "2026-01-31",
    );
    const completionPoint = series.points.find((point) => point.date === "2026-01-20");

    expect(completionPoint).toMatchObject({
      grossRevenue: 1000,
      actualCostToDate: 1200,
      netProfitToDate: -200,
      completedProjectCount: 1,
    });
  });

  it("rejects legacy epoch dates and assigns those costs to the project start date", () => {
    const project: ProjectReportRow = {
      ...base,
      id: "legacy-date",
      startDate: "2026-04-10",
      clientFee: "1000.00",
      forecastCost: "400.00",
      forecastProfit: "600.00",
      actualTotalCost: "125.00",
    };
    const costs: HistoricalCostRecord[] = [
      { projectId: project.id, date: "1970-01-01", cost: 125, kind: "LABOR", fallbackDate: false },
    ];

    const series = buildHistoricalProfitSeriesFromSource(
      "All project types",
      [project],
      costs,
      "2026-07-31",
    );

    expect(series.points.some((point) => point.date.startsWith("1970"))).toBe(false);
    expect(series.points.find((point) => point.date === "2026-04-10")).toMatchObject({
      grossRevenue: 1000,
      actualCostToDate: 125,
      anticipatedCostToDate: 400,
      netProfitToDate: 875,
      forecastNetProfitToDate: 600,
      fallbackDatedLaborCount: 1,
    });
  });

  it("reports missing cost records and expenses using fallback import dates", () => {
    const project: ProjectReportRow = {
      ...base,
      id: "coverage",
      startDate: "2026-01-01",
      clientFee: "500.00",
      actualTotalCost: "75.00",
      laborCoverage: "PARTIAL",
      expenseCoverage: "COMPLETE",
    };
    const costs: HistoricalCostRecord[] = [
      { projectId: project.id, date: "2026-01-02", cost: null, kind: "LABOR", fallbackDate: false },
      { projectId: project.id, date: "2026-01-03", cost: 75, kind: "EXPENSE", fallbackDate: true },
    ];

    const series = buildHistoricalProfitSeriesFromSource(
      "All project types",
      [project],
      costs,
      "2026-01-31",
    );
    expect(series.points.at(-1)).toMatchObject({
      actualCostToDate: 75,
      netProfitToDate: 425,
      costCoverageCompleteCount: 0,
      costCoveragePartialCount: 1,
      missingCostRecordCount: 1,
      fallbackDatedExpenseCount: 1,
    });
  });
});
