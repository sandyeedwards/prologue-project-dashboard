import { describe, expect, it } from "vitest";
import {
  compareNullableDescending,
  compareProjectIdentity,
  formatHoursUsed,
  hoursUsedPercent,
  marginBand,
  MISSING,
  projectedProfitLabel,
  REPORT_LABELS,
  totalProfitabilityRows,
} from "./labels";

describe("reporting labels", () => {
  it("uses Company Overview terms and one word for missing values", () => {
    expect(REPORT_LABELS.currentCosts).toBe("Current Costs");
    expect(REPORT_LABELS.estimatedRemainingCosts).toBe("Estimated Remaining Costs");
    expect(REPORT_LABELS.forecastMargin).toBe("Forecast Margin");
    expect(REPORT_LABELS.fee).toBe("Fee");
    expect(MISSING).toBe("Missing");
  });

  it("calls a known negative profit a Projected Loss, and anything else Projected Profit", () => {
    expect(projectedProfitLabel(-1)).toBe("Projected Loss");
    expect(projectedProfitLabel(0)).toBe("Projected Profit");
    expect(projectedProfitLabel(null)).toBe("Projected Profit");
  });
});

describe("hours used", () => {
  it("is all logged hours over estimated hours, with one decimal", () => {
    expect(hoursUsedPercent(90, 60)).toBe(150);
    expect(formatHoursUsed(hoursUsedPercent(100, 300))).toBe("33.3%");
  });

  it("is missing, not zero, without an estimate or logged time", () => {
    expect(hoursUsedPercent(60, 0)).toBeNull();
    expect(hoursUsedPercent(null, 60)).toBeNull();
    expect(formatHoursUsed(null)).toBe("Missing");
  });
});

describe("margin bands", () => {
  it("never counts a provisional strong margin as a confirmed strong margin", () => {
    expect(marginBand(60, false)).toBe("green");
    expect(marginBand(60, true)).toBe("provisional");
    expect(marginBand("40", true)).toBe("yellow");
    expect(marginBand(10, true)).toBe("red");
    expect(marginBand(null, true)).toBe("neutral");
  });
});

describe("sorting", () => {
  it("puts missing values last and breaks ties by project number", () => {
    const rows = [
      { projectNumber: "P-10", name: "B", margin: null },
      { projectNumber: "P-2", name: "C", margin: 40 },
      { projectNumber: "P-9", name: "A", margin: null },
      { projectNumber: null, name: "D", margin: 40 },
      { projectNumber: "P-1", name: "E", margin: 40 },
    ];
    const order = [...rows]
      .sort((a, b) => compareNullableDescending(a.margin, b.margin) || compareProjectIdentity(a, b))
      .map((row) => row.name);
    expect(order).toEqual(["E", "C", "D", "A", "B"]);
  });
});

describe("profitability totals", () => {
  const row = (fields: Record<string, unknown>) => ({
    label: "Group",
    revenue: 1000,
    cost: 600,
    profit: 400,
    projectCount: 1,
    ...fields,
  });

  it("totals only complete rows, so profit and margin describe the same rows", () => {
    const totals = totalProfitabilityRows([
      row({}),
      row({ label: "No fee", revenue: null, profit: null, cost: 500 }),
    ]);
    expect(totals.revenue).toBe(1000);
    expect(totals.cost).toBe(600);
    expect(totals.profit).toBe(400);
    expect(totals.margin).toBe(40);
    expect(totals.includedCount).toBe(1);
    expect(totals.excludedCount).toBe(1);
    expect(totals.tone).toBe("is-profit");
  });

  it("is amber when any included row is provisional, and missing when nothing is complete", () => {
    expect(totalProfitabilityRows([row({ provisional: true })]).tone).toBe("is-provisional");
    expect(totalProfitabilityRows([row({ revenue: 1000, cost: 1200, profit: -200 })]).tone).toBe(
      "is-loss",
    );
    const none = totalProfitabilityRows([row({ revenue: null, profit: null })]);
    expect(none.profit).toBeNull();
    expect(none.margin).toBeNull();
    expect(none.tone).toBe("is-missing");
  });
});
