import { describe, expect, it } from "vitest";
import { csvCell, payPeriod, ptoLockDate } from "./pay-period";

describe("payroll dates and CSV", () => {
  it("uses the 1st through 14th and the 15th through month end", () => {
    expect(payPeriod("2026-09-14")).toEqual({ startDate: "2026-09-01", endDate: "2026-09-14" });
    expect(payPeriod("2026-09-15")).toEqual({ startDate: "2026-09-15", endDate: "2026-09-30" });
    expect(payPeriod("2028-02-29").endDate).toBe("2028-02-29");
    expect(payPeriod("2027-02-15").endDate).toBe("2027-02-28");
    expect(() => payPeriod("2026-02-30")).toThrow();
  });
  it("locks after thirty calendar days across month and year boundaries", () => {
    expect(ptoLockDate("2026-12-15")).toBe("2027-01-14");
    expect(ptoLockDate("2028-02-01")).toBe("2028-03-02");
  });
  it("quotes cells and prevents spreadsheet formulas from source text", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
  });
});
