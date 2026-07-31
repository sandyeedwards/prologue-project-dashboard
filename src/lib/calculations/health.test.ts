import { describe, expect, it } from "vitest";
import { calculateHealth } from "./health";

const base = {
  clientFee: 100000,
  targetMarginPercent: 30,
  forecastMarginPercent: 30,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  progressPercent: 60,
  estimateConsumptionPercent: 55,
  incompleteTaskCount: 4,
  overdueIncompleteTaskCount: 0,
  completenessScore: 100,
  asOfDate: new Date("2026-07-01T00:00:00Z"),
};

describe("project health", () => {
  it("returns green for a healthy project", () => {
    const result = calculateHealth(base);
    expect(result.healthBand).toBe("GREEN");
    expect(result.healthScore).not.toBeNull();
  });

  it("forces red for a negative forecast margin", () => {
    const result = calculateHealth({ ...base, forecastMarginPercent: -2 });
    expect(result.healthBand).toBe("RED");
    expect(result.overrides).toContain("NEGATIVE_FORECAST_MARGIN");
  });

  it("returns gray when core financial data is missing", () => {
    const result = calculateHealth({ ...base, clientFee: null, forecastMarginPercent: null });
    expect(result.healthBand).toBe("GRAY");
    expect(result.healthScore).toBeNull();
  });
});
