import { describe, expect, it } from "vitest";
import {
  combineProjectForecasts,
  profitabilityPlotComplete,
  profitLabel,
  profitTone,
  resolveProfitabilityRow,
} from "./forecast-position";

describe("combined project forecast", () => {
  it("uses one project set, so revenue − forecast cost equals the stated profit", () => {
    const combined = combineProjectForecasts([
      {
        clientFee: "100000",
        actualTotalCost: "20000",
        forecastCost: "60000",
        isProvisional: false,
      },
      // No client fee: excluded and counted, never added as $0 revenue against its cost.
      { clientFee: null, actualTotalCost: "10000", forecastCost: "50000", isProvisional: false },
    ]);
    expect(combined).toEqual({
      revenue: 100000,
      actualCost: 20000,
      remainingCost: 40000,
      forecastCost: 60000,
      profit: 40000,
      margin: 40,
      includedCount: 1,
      excludedCount: 1,
      provisionalCount: 0,
    });
  });

  it("excludes projects with missing current or forecast cost instead of treating them as $0", () => {
    const combined = combineProjectForecasts([
      { clientFee: 20000, actualTotalCost: 3000, forecastCost: 8000, isProvisional: false },
      { clientFee: 20000, actualTotalCost: null, forecastCost: null, isProvisional: true },
      { clientFee: 20000, actualTotalCost: 1000, forecastCost: null, isProvisional: true },
    ]);
    expect(combined?.revenue).toBe(20000);
    expect(combined?.profit).toBe(12000);
    expect(combined && combined.revenue - combined.forecastCost).toBe(combined?.profit);
    expect(combined?.excludedCount).toBe(2);
  });

  it("counts provisional projects among those included and gives no margin for a zero fee", () => {
    const combined = combineProjectForecasts([
      { clientFee: 0, actualTotalCost: 500, forecastCost: 900, isProvisional: true },
    ]);
    expect(combined?.provisionalCount).toBe(1);
    expect(combined?.profit).toBe(-900);
    expect(combined?.margin).toBeNull();
  });

  it("returns null when no project has complete financials", () => {
    expect(combineProjectForecasts([])).toBeNull();
    expect(
      combineProjectForecasts([
        { clientFee: null, actualTotalCost: 1, forecastCost: 2, isProvisional: false },
      ]),
    ).toBeNull();
  });
});

describe("profitability row display rules", () => {
  it("keeps missing costs missing instead of showing $0 and a 100% margin", () => {
    const values = resolveProfitabilityRow({
      label: "Provisional project",
      revenue: 20000,
      cost: null,
      actualCost: null,
      remainingCost: null,
      profit: null,
      margin: null,
    });
    expect(values.known).toEqual({
      revenue: true,
      actual: false,
      remaining: false,
      forecastCost: false,
      profit: false,
    });
    expect(values.margin).toBeNull();
    expect(profitabilityPlotComplete(values)).toBe(false);
    expect(profitTone({}, values)).toBe("is-missing");
  });

  it("never colours provisional profit as confirmed", () => {
    const values = resolveProfitabilityRow({
      label: "p",
      revenue: 100,
      cost: 60,
      actualCost: 20,
      profit: 40,
    });
    expect(profitabilityPlotComplete(values)).toBe(true);
    expect(profitTone({ provisional: false }, values)).toBe("is-profit");
    expect(profitTone({ provisional: true }, values)).toBe("is-provisional");
    expect(profitLabel({ provisional: true }, values)).toBe("Known Projected Profit");
  });

  it("shows a loss as a loss whether or not it is provisional", () => {
    const values = resolveProfitabilityRow({ label: "p", revenue: 100, cost: 140, profit: -40 });
    expect(profitTone({ provisional: true }, values)).toBe("is-loss");
    expect(profitLabel({ provisional: true }, values)).toBe("Projected Loss");
  });

  it("derives remaining cost only when both forecast and current cost are known", () => {
    expect(
      resolveProfitabilityRow({ label: "p", revenue: 100, cost: 60, actualCost: 20, profit: 40 })
        .remaining,
    ).toBe(40);
    expect(
      resolveProfitabilityRow({ label: "p", revenue: 100, cost: 60, actualCost: null, profit: 40 })
        .known.remaining,
    ).toBe(false);
  });
});
