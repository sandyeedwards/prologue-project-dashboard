import { describe, expect, it } from "vitest";
import {
  isCompleteSinglePageProjectFetch,
  missingTeamworkProjectIds,
} from "./project-reconciliation";

describe("missingTeamworkProjectIds", () => {
  it("identifies local projects absent from the latest Teamwork project set", () => {
    const result = missingTeamworkProjectIds(
      new Set([1253928, 1258073, 1260000]),
      new Set([1253928, 1260000]),
    );

    expect(result).toEqual([1258073]);
  });

  it("does not treat newly returned Teamwork projects as missing", () => {
    const result = missingTeamworkProjectIds(new Set([1001]), new Set([1001, 1002]));

    expect(result).toEqual([]);
  });
});

describe("isCompleteSinglePageProjectFetch", () => {
  it("allows reconciliation when the returned page is not full", () => {
    expect(isCompleteSinglePageProjectFetch(80, 500)).toBe(true);
    expect(isCompleteSinglePageProjectFetch(499, 500)).toBe(true);
  });

  it("refuses reconciliation when the page may have been truncated", () => {
    expect(isCompleteSinglePageProjectFetch(500, 500)).toBe(false);
  });
});
