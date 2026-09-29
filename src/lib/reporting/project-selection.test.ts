import { describe, expect, it } from "vitest";
import {
  COMBINE_PROJECT_LIMIT,
  COMPARE_PROJECT_LIMIT,
  combinedProjectsHref,
  projectSelectionExceedsLimit,
} from "./project-selection";

function ids(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`,
  );
}

describe("project report selection limits", () => {
  it("keeps Compare at six projects and caps Combine at thirty", () => {
    expect(COMPARE_PROJECT_LIMIT).toBe(6);
    expect(COMBINE_PROJECT_LIMIT).toBe(30);
    expect(projectSelectionExceedsLimit("compare", ids(6))).toBe(false);
    expect(projectSelectionExceedsLimit("compare", ids(7))).toBe(true);
    expect(projectSelectionExceedsLimit("combine", ids(30))).toBe(false);
    expect(projectSelectionExceedsLimit("combine", ids(31))).toBe(true);
  });

  it("generates only valid, deduplicated combined-report links", () => {
    const atLimit = ids(COMBINE_PROJECT_LIMIT);
    const href = combinedProjectsHref([...atLimit, atLimit[0]]);

    expect(href).not.toBeNull();
    expect(new URL(href!, "https://dashboard.example").searchParams.getAll("project")).toEqual(
      atLimit,
    );
    expect(href!.length).toBeLessThan(1_500);
    expect(combinedProjectsHref(ids(COMBINE_PROJECT_LIMIT + 1))).toBeNull();
    expect(combinedProjectsHref([])).toBeNull();
  });
});
