import { describe, expect, it } from "vitest";
import { parseJobRoleCostRate } from "./job-role-rates";

describe("Teamwork job-role cost rates", () => {
  it("prefers a USD rate from the currency map", () => {
    expect(
      parseJobRoleCostRate({
        costRatesByCurrencyId: {
          "1": { rate: { amount: 80, currency: { code: "EUR" } } },
          "2": { rate: { amount: 95, currency: { code: "USD" } } },
        },
      }),
    ).toEqual({ costRate: 95, currencyCode: "USD" });
  });

  it("accepts a direct cost rate", () => {
    expect(parseJobRoleCostRate({ costRate: 72.5, currencyCode: "USD" })).toEqual({
      costRate: 72.5,
      currencyCode: "USD",
    });
  });

  it("does not divide hourly role rates as expense minor units", () => {
    expect(
      parseJobRoleCostRate({ costRatesByCurrencyId: { "1": { rate: { amount: 125 } } } }),
    ).toEqual({ costRate: 125, currencyCode: "USD" });
  });
});
