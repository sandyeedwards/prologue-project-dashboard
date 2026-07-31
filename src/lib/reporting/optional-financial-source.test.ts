import { describe, expect, it } from "vitest";
import {
  resolveOptionalFinancialSource,
  summarizeFinancialCoverage,
} from "./optional-financial-source";

const warning = "No Teamwork task-list target budget was returned for this budget period.";

describe("resolveOptionalFinancialSource", () => {
  it("prefers Teamwork over a dashboard override", () => {
    expect(
      resolveOptionalFinancialSource({
        teamworkAmountUsd: 100,
        dashboardOverrideUsd: 90,
        missingWarning: warning,
      }),
    ).toEqual({ amountUsd: 100, source: "teamwork", warning: null });
  });

  it("uses an override only when Teamwork is missing", () => {
    expect(
      resolveOptionalFinancialSource({
        teamworkAmountUsd: null,
        dashboardOverrideUsd: 90,
        missingWarning: warning,
      }),
    ).toEqual({
      amountUsd: 90,
      source: "dashboard-override",
      warning: "Using an audited dashboard override because Teamwork returned no value.",
    });
  });

  it("preserves missing as null rather than zero", () => {
    expect(
      resolveOptionalFinancialSource({ teamworkAmountUsd: null, missingWarning: warning }),
    ).toEqual({ amountUsd: null, source: "missing", warning });
  });
});

describe("summarizeFinancialCoverage", () => {
  it("returns a complete total when every item has a numeric value, including zero", () => {
    expect(
      summarizeFinancialCoverage(
        [
          { amountUsd: 100, source: "teamwork", warning: null },
          { amountUsd: 0, source: "teamwork", warning: null },
          { amountUsd: 50, source: "dashboard-override", warning: "Audited override." },
        ],
        "Incomplete target-cost coverage.",
      ),
    ).toEqual({
      amountUsd: 150,
      knownSubtotalUsd: 150,
      coveredItemCount: 3,
      totalItemCount: 3,
      missingItemCount: 0,
      isComplete: true,
      warning: null,
    });
  });

  it("does not present a partial subtotal as a complete total", () => {
    expect(
      summarizeFinancialCoverage(
        [
          { amountUsd: 100, source: "teamwork", warning: null },
          { amountUsd: null, source: "missing", warning },
        ],
        "Incomplete target-cost coverage.",
      ),
    ).toEqual({
      amountUsd: null,
      knownSubtotalUsd: 100,
      coveredItemCount: 1,
      totalItemCount: 2,
      missingItemCount: 1,
      isComplete: false,
      warning: "Incomplete target-cost coverage.",
    });
  });

  it("treats an empty group as incomplete rather than a zero-dollar total", () => {
    expect(summarizeFinancialCoverage([], "No task lists were available.")).toEqual({
      amountUsd: null,
      knownSubtotalUsd: 0,
      coveredItemCount: 0,
      totalItemCount: 0,
      missingItemCount: 0,
      isComplete: false,
      warning: "No task lists were available.",
    });
  });
});
