import { describe, expect, it } from "vitest";
import { teamworkDateText } from "./date";

describe("teamworkDateText", () => {
  it("reads the V3 timeLogged field through a nested object", () => {
    expect(teamworkDateText({ timeLogged: "2026-07-31" })).toBe("2026-07-31");
  });

  it("preserves the source calendar day when a timestamp includes an offset", () => {
    expect(teamworkDateText("2026-07-31T23:45:00-04:00")).toBe("2026-07-31");
  });

  it("accepts compact Teamwork dates as strings and numbers", () => {
    expect(teamworkDateText("20260731")).toBe("2026-07-31");
    expect(teamworkDateText(20260731)).toBe("2026-07-31");
  });

  it("accepts Unix seconds and milliseconds", () => {
    const timestamp = Date.UTC(2026, 6, 31);
    expect(teamworkDateText(timestamp / 1000)).toBe("2026-07-31");
    expect(teamworkDateText(timestamp)).toBe("2026-07-31");
  });

  it("reads common nested date wrappers", () => {
    expect(teamworkDateText({ date: { value: "2026-07-31" } })).toBe("2026-07-31");
  });

  it("rejects invalid and pre-2000 dates", () => {
    expect(teamworkDateText("1970-01-01")).toBeNull();
    expect(teamworkDateText("2026-02-31")).toBeNull();
    expect(teamworkDateText("not-a-date")).toBeNull();
  });
});
