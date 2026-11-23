import { describe, expect, it } from "vitest";
import { dateLabel, easternIsoDate, reportingTimestamp } from "./format";

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

describe("business dates", () => {
  it("uses the Eastern calendar day after 8pm Eastern", () => {
    expect(easternIsoDate(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
    expect(easternIsoDate(new Date("2026-07-01T03:59:00Z"))).toBe("2026-06-30");
  });

  it("keeps plain dates on their own day and shows timestamps in Eastern time", () => {
    expect(dateLabel("2026-11-01")).toBe("Nov 1, 2026");
    expect(dateLabel(new Date("2026-11-01T00:00:00Z"))).toBe("Nov 1, 2026");
    expect(dateLabel(new Date("2026-11-18T02:30:00Z"))).toBe("Nov 17, 2026");
  });
});
