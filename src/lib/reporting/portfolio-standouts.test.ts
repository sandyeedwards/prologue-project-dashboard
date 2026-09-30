import { describe, expect, it } from "vitest";
import type { ProjectReportRow } from "./dashboard-data";
import { getPortfolioStandouts } from "./portfolio-standouts";

function project(overrides: Partial<ProjectReportRow> = {}): ProjectReportRow {
  return {
    id: "project-1",
    teamworkId: 1,
    projectNumber: "26-100",
    name: "Example Project",
    companyName: "Example Client",
    status: "active",
    projectType: null,
    startDate: null,
    endDate: null,
    archivedAt: null,
    completedAt: null,
    clientFee: "50000",
    targetCost: "20000",
    actualLaborCost: "5000",
    actualNonLaborCost: "0",
    actualTotalCost: "5000",
    forecastCost: "15000",
    forecastProfit: "35000",
    forecastMarginPercent: "70",
    canonicalEstimatedMinutes: 6000,
    plannedLoggedMinutes: 3000,
    loggedMinutes: 3000,
    unplannedLoggedMinutes: 0,
    completedTaskCount: 5,
    totalTaskCount: 10,
    progressPercent: "50",
    healthScore: "90",
    healthBand: "GREEN",
    laborCoverage: "COMPLETE",
    assignmentCoverage: "COMPLETE",
    taskListBudgetCoverage: "COMPLETE",
    expenseCoverage: "NOT_EXPECTED",
    isProvisional: false,
    dataQualityIssueCount: 0,
    tags: [],
    calculatedAt: new Date("2026-09-30T12:00:00.000Z"),
    calculationVersion: "test",
    ...overrides,
  };
}

describe("getPortfolioStandouts", () => {
  it("mines active financial leaders and completed estimating accuracy", () => {
    const rows = [
      project({ id: "margin", name: "Margin Leader", forecastMarginPercent: "82" }),
      project({ id: "revenue", name: "Revenue Leader", clientFee: "125000" }),
      project({ id: "hours", name: "Hours Leader", loggedMinutes: 12000 }),
      project({
        id: "accurate",
        name: "Accurate Project",
        status: "completed",
        completedAt: new Date("2026-09-01T12:00:00.000Z"),
        canonicalEstimatedMinutes: 6000,
        loggedMinutes: 6060,
      }),
    ];

    const standouts = getPortfolioStandouts(rows);

    expect(standouts.find((item) => item.key === "margin")?.project.id).toBe("margin");
    expect(standouts.find((item) => item.key === "revenue")?.project.id).toBe("revenue");
    expect(standouts.find((item) => item.key === "hours")?.project.id).toBe("hours");
    expect(standouts.find((item) => item.key === "accuracy")).toMatchObject({
      value: "101.0%",
      project: { id: "accurate" },
    });
  });

  it("excludes completed and provisional projects from strongest active margin", () => {
    const standouts = getPortfolioStandouts([
      project({ id: "active", forecastMarginPercent: "65" }),
      project({ id: "provisional", forecastMarginPercent: "99", isProvisional: true }),
      project({
        id: "complete",
        forecastMarginPercent: "98",
        status: "completed",
        completedAt: new Date("2026-09-01T12:00:00.000Z"),
      }),
    ]);

    expect(standouts.find((item) => item.key === "margin")?.project.id).toBe("active");
  });
});
