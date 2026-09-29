import { describe, expect, it } from "vitest";
import { csvCell, mostRecentClosedPayPeriod, payPeriod, ptoLockDate } from "./pay-period";

describe("payroll dates and CSV", () => {
  it("uses the 1st through 15th and the 16th through month end", () => {
    expect(payPeriod("2026-09-15")).toEqual({ startDate: "2026-09-01", endDate: "2026-09-15" });
    expect(payPeriod("2026-09-16")).toEqual({ startDate: "2026-09-16", endDate: "2026-09-30" });
    expect(payPeriod("2028-02-29").endDate).toBe("2028-02-29");
    expect(payPeriod("2027-02-16").endDate).toBe("2027-02-28");
    expect(() => payPeriod("2026-02-30")).toThrow();
  });

  it("finds the most recently closed semi-monthly period", () => {
    expect(mostRecentClosedPayPeriod("2026-09-16")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-15",
    });
    expect(mostRecentClosedPayPeriod("2026-10-01")).toEqual({
      startDate: "2026-09-16",
      endDate: "2026-09-30",
    });
    expect(mostRecentClosedPayPeriod("2028-03-01")).toEqual({
      startDate: "2028-02-16",
      endDate: "2028-02-29",
    });
  });
  it("locks after thirty calendar days across month and year boundaries", () => {
    expect(ptoLockDate("2026-12-15")).toBe("2026-12-30");
    expect(ptoLockDate("2028-02-01")).toBe("2028-02-16");
  });
  it("quotes cells and prevents spreadsheet formulas from source text", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
  });
});
