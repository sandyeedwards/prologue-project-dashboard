import { describe, expect, it } from "vitest";
import {
  compareProjects,
  performanceStatus,
  resolvePosition,
  type ComparedProjectOperationalGroups,
  type ComparedProfitabilityPosition,
} from "./compare-operational-profitability-chart";

const position = (
  fields: Partial<ComparedProfitabilityPosition> = {},
): ComparedProfitabilityPosition => ({
  allocatedRevenue: 1000,
  actualCostToDate: 200,
  remainingCost: 300,
  forecastCost: 500,
  forecastProfit: 500,
  marginPercent: 50,
  ...fields,
});

const project = (
  name: string,
  total: ComparedProfitabilityPosition,
  isProvisional = false,
): ComparedProjectOperationalGroups => ({
  projectId: name,
  projectName: name,
  projectNumber: null,
  isProvisional,
  total,
  groups: [],
});

describe("compare profitability positions", () => {
  it("treats a missing fee as incomplete data, not a $0-revenue loss with 0% margin", () => {
    const resolved = resolvePosition(
      position({ allocatedRevenue: null, forecastProfit: null, marginPercent: null }),
    );
    expect(resolved.known.revenue).toBe(false);
    expect(resolved.known.profit).toBe(false);
    expect(resolved.marginPercent).toBeNull();
    expect(performanceStatus(resolved)).toEqual({ label: "Incomplete data", tone: "watch" });
  });

  it("does not call a provisional forecast on track", () => {
    const resolved = resolvePosition(position());
    expect(performanceStatus(resolved).tone).toBe("good");
    expect(performanceStatus(resolved, true)).toEqual({ label: "Provisional", tone: "watch" });
  });

  it("still reports a known loss as over budget", () => {
    const resolved = resolvePosition(
      position({
        forecastCost: 1200,
        remainingCost: 1000,
        forecastProfit: -200,
        marginPercent: -20,
      }),
    );
    expect(performanceStatus(resolved, true)).toEqual({ label: "Over budget", tone: "loss" });
  });

  it("sorts projects with missing profit or margin last, and attention puts losses first", () => {
    const loss = project("Loss", position({ forecastProfit: -100, marginPercent: -10 }));
    const missing = project(
      "Missing",
      position({ allocatedRevenue: null, forecastProfit: null, marginPercent: null }),
    );
    const healthy = project("Healthy", position({ forecastProfit: 600, marginPercent: 60 }));
    const order = (sort: "margin" | "profit" | "attention") =>
      [missing, healthy, loss]
        .sort((a, b) => compareProjects(a, b, sort))
        .map((row) => row.projectName);
    expect(order("margin")).toEqual(["Healthy", "Loss", "Missing"]);
    expect(order("profit")).toEqual(["Healthy", "Loss", "Missing"]);
    expect(order("attention")).toEqual(["Loss", "Missing", "Healthy"]);
  });

  it("breaks margin ties by project number, keeping missing margins last", () => {
    const withNumber = (name: string, projectNumber: string | null, margin: number | null) => ({
      ...project(
        name,
        position({
          marginPercent: margin,
          forecastProfit: margin === null ? null : margin * 10,
          allocatedRevenue: margin === null ? null : 1000,
        }),
      ),
      projectNumber,
    });
    const rows = [
      withNumber("Zed", "P-10", 50),
      withNumber("Alpha", "P-2", 50),
      withNumber("Gap", "P-1", null),
    ];
    expect(
      [...rows].sort((a, b) => compareProjects(a, b, "margin")).map((row) => row.projectName),
    ).toEqual(["Alpha", "Zed", "Gap"]);
  });
});
