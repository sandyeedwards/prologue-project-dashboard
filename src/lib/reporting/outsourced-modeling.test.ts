import { describe, expect, it } from "vitest";
import { calculateProjectedOutsourcedCost, isOutsourcedModelingTask } from "./outsourced-modeling";

describe("outsourced modeling", () => {
  it.each(["Outsourced Modeling", "Cosmere Modeling", "cosmere-modeling"])(
    "recognizes alias %s",
    (name) => {
      expect(isOutsourcedModelingTask(name)).toBe(true);
    },
  );

  it("does not classify ordinary internal modeling work as outsourced", () => {
    expect(isOutsourcedModelingTask("Production Revit Modeling")).toBe(false);
  });

  it("calculates 235 hours at $15 per hour", () => {
    expect(calculateProjectedOutsourcedCost(235 * 60)).toBe(3525);
  });
});
