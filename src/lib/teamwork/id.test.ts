import { describe, expect, it } from "vitest";
import { teamworkNumericId } from "./id";

describe("teamworkNumericId", () => {
  it("accepts positive numbers and numeric strings", () => {
    expect(teamworkNumericId(1226371)).toBe(1226371);
    expect(teamworkNumericId(" 1226371 ")).toBe(1226371);
  });

  it("extracts IDs from nested Teamwork references", () => {
    expect(teamworkNumericId({ id: "1226371", type: "projects" })).toBe(1226371);
    expect(teamworkNumericId({ projectId: { id: 1226371 } })).toBe(1226371);
    expect(teamworkNumericId(undefined, { tasklistId: "3765747" })).toBe(3765747);
  });

  it("rejects malformed, zero, negative, fractional, and unsafe values", () => {
    expect(teamworkNumericId({ type: "projects" })).toBeNull();
    expect(teamworkNumericId("not-an-id")).toBeNull();
    expect(teamworkNumericId(0)).toBeNull();
    expect(teamworkNumericId(-1)).toBeNull();
    expect(teamworkNumericId(1.5)).toBeNull();
    expect(teamworkNumericId(Number.NaN)).toBeNull();
  });

  it("handles circular objects safely", () => {
    const value: Record<string, unknown> = {};
    value.id = value;
    expect(teamworkNumericId(value)).toBeNull();
  });
});
