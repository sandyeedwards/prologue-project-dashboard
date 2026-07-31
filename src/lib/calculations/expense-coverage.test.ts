import { describe, expect, it } from "vitest";
import { resolveExpenseCoverage } from "./expense-coverage";

describe("resolveExpenseCoverage", () => {
  it("does not mark an ordinary project provisional merely because it has no expenses", () => {
    expect(resolveExpenseCoverage({ hasOutsourcedTask: false, expenseValues: [] })).toBe(
      "NOT_EXPECTED",
    );
  });

  it("expects an expense when an outsourced-cost task exists", () => {
    expect(resolveExpenseCoverage({ hasOutsourcedTask: true, expenseValues: [] })).toBe("MISSING");
  });

  it("reports complete and partial expense rows without inventing zero values", () => {
    expect(resolveExpenseCoverage({ hasOutsourcedTask: true, expenseValues: [1950, 1575] })).toBe(
      "COMPLETE",
    );
    expect(resolveExpenseCoverage({ hasOutsourcedTask: false, expenseValues: [1950, null] })).toBe(
      "PARTIAL",
    );
  });
});
