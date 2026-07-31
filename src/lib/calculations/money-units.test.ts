import { describe, expect, it } from "vitest";
import { teamworkBudgetMoney, teamworkExpenseMoney } from "./money-units";

describe("teamworkBudgetMoney", () => {
  it("converts Teamwork budget minor units into currency units", () => {
    expect(teamworkBudgetMoney(12_000_000)).toBe(120_000);
    expect(teamworkBudgetMoney(5_400_000)).toBe(54_000);
    expect(teamworkBudgetMoney(0)).toBe(0);
  });

  it("preserves missing and rejects invalid values", () => {
    expect(teamworkBudgetMoney(null)).toBeNull();
    expect(teamworkBudgetMoney(Number.NaN)).toBeNull();
  });
});

describe("teamworkExpenseMoney", () => {
  it("converts budget-expense minor units into currency units", () => {
    expect(teamworkExpenseMoney(195_000, "BUDGET")).toBe(1_950);
    expect(teamworkExpenseMoney(157_500, "BUDGET")).toBe(1_575);
    expect(teamworkExpenseMoney(352_500, "BUDGET")).toBe(3_525);
  });

  it("preserves legacy expense decimal currency values", () => {
    expect(teamworkExpenseMoney(1_950, "LEGACY")).toBe(1_950);
    expect(teamworkExpenseMoney(1_575.25, "LEGACY")).toBe(1_575.25);
  });

  it("preserves missing and rejects invalid values", () => {
    expect(teamworkExpenseMoney(null, "BUDGET")).toBeNull();
    expect(teamworkExpenseMoney(Number.NaN, "LEGACY")).toBeNull();
  });
});
