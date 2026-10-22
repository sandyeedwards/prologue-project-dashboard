import { describe, expect, it } from "vitest";

import { ptoDaysLabel, ptoDaysLongLabel, ptoHoursLabel } from "./pto-display";

describe("PTO display", () => {
  it("does not round partial usage up to a full allowance", () => {
    expect(ptoDaysLabel(119.9 * 60)).toBe("14.99d");
    expect(ptoHoursLabel(119.9 * 60)).toBe("119.9h");
  });

  it("shows actual usage beyond the allowance", () => {
    expect(ptoDaysLabel(121 * 60)).toBe("15.13d");
    expect(ptoHoursLabel(121 * 60)).toBe("121h");
  });

  it("formats signed balances without negative zero", () => {
    expect(ptoDaysLabel(-60)).toBe("-0.13d");
    expect(ptoDaysLabel(0)).toBe("0d");
    expect(ptoDaysLongLabel(480)).toBe("1 day");
  });
});
