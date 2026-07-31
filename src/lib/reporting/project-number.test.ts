import { describe, expect, it } from "vitest";
import { parseProjectNumber } from "./project-number";

describe("parseProjectNumber", () => {
  it("preserves a hyphenated leading project number", () => {
    expect(parseProjectNumber("26-120 - Four Seasons Jackson Hole - BDT")).toBe("26-120");
  });

  it("supports a simple numeric project number", () => {
    expect(parseProjectNumber("1024 - Municipal Building")).toBe("1024");
  });

  it("returns null when a project name has no leading number", () => {
    expect(parseProjectNumber("Internal Administration")).toBeNull();
  });
});
