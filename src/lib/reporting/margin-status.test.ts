import { describe, expect, it } from "vitest";
import { marginTone } from "./margin-status";

describe("margin tone", () => {
  it.each([
    [-10, "red"],
    [0, "red"],
    [35, "red"],
    [35.01, "yellow"],
    [40, "yellow"],
    [49.99, "yellow"],
    [50, "green"],
    [75, "green"],
  ] as const)("classifies %s%% as %s", (value, expected) => {
    expect(marginTone(value)).toBe(expected);
  });

  it.each([null, undefined, "", "not-a-number"] as const)("treats %s as neutral", (value) => {
    expect(marginTone(value)).toBe("neutral");
  });
});

describe("provisional margin tone", () => {
  it("shows a provisional margin that would be green as yellow", () => {
    expect(marginTone(75, { provisional: true })).toBe("yellow");
    expect(marginTone(75, { provisional: false })).toBe("green");
  });

  it("keeps red, yellow and neutral unchanged for provisional margins", () => {
    expect(marginTone(10, { provisional: true })).toBe("red");
    expect(marginTone(40, { provisional: true })).toBe("yellow");
    expect(marginTone(null, { provisional: true })).toBe("neutral");
  });
});
