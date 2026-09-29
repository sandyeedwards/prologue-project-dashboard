import { describe, expect, it } from "vitest";
import { teamworkUserCostRate } from "./user-cost";

describe("teamworkUserCostRate", () => {
  it("converts Teamwork userCost minor units to hourly dollars", () => {
    expect(teamworkUserCostRate(9500)).toBe(95);
    expect(teamworkUserCostRate(7500)).toBe(75);
    expect(teamworkUserCostRate(9550)).toBe(95.5);
    expect(teamworkUserCostRate(0)).toBe(0);
  });

  it("returns null when Teamwork does not return a usable userCost", () => {
    expect(teamworkUserCostRate(null)).toBeNull();
    expect(teamworkUserCostRate(Number.NaN)).toBeNull();
  });
});
