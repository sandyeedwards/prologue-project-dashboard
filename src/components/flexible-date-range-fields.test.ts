import { describe, expect, it } from "vitest";
import { parseFlexibleDateInput } from "@/components/flexible-date-range-fields";

describe("parseFlexibleDateInput", () => {
  it.each([
    ["4/4/24", "2024-04-04", "04/04/2024"],
    ["04/04/24", "2024-04-04", "04/04/2024"],
    ["4-4-24", "2024-04-04", "04/04/2024"],
    ["4/4/2024", "2024-04-04", "04/04/2024"],
    ["12-31-2026", "2026-12-31", "12/31/2026"],
  ])("normalizes %s", (input, iso, display) => {
    expect(parseFlexibleDateInput(input)).toEqual({ iso, display });
  });

  it("allows an empty value", () => {
    expect(parseFlexibleDateInput("")).toEqual({ iso: "", display: "" });
  });

  it.each(["2/30/24", "13/1/24", "4.4.24", "4/4", "not a date"])(
    "rejects %s",
    (input) => {
      expect(parseFlexibleDateInput(input)).toBeNull();
    },
  );

  it("supports leap-day validation", () => {
    expect(parseFlexibleDateInput("2/29/24")).toEqual({
      iso: "2024-02-29",
      display: "02/29/2024",
    });
    expect(parseFlexibleDateInput("2/29/23")).toBeNull();
  });
});
