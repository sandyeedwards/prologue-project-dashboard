import { describe, expect, it } from "vitest";
import { reportingTimestamp } from "./format";

describe("reporting timestamps", () => {
  it("labels winter sync times in Eastern rather than server time", () => {
    expect(reportingTimestamp("2026-11-03T12:17:00Z")).toBe("Nov 3, 2026, 7:17 AM EST");
  });

  it("automatically follows Eastern daylight saving time", () => {
    expect(reportingTimestamp("2026-07-03T10:10:00Z")).toBe("Jul 3, 2026, 6:10 AM EDT");
  });

  it("does not display missing or invalid timestamps as fresh imports", () => {
    expect(reportingTimestamp(null)).toBe("Not run");
    expect(reportingTimestamp("invalid")).toBe("Invalid date");
  });
});
