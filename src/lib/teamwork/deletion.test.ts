import { describe, expect, it } from "vitest";
import { isTeamworkRecordDeleted } from "./deletion";

const deletedAt = new Date("2026-11-13T15:32:39Z");

describe("isTeamworkRecordDeleted", () => {
  it("treats a restored task (old deletedAt, status reopened) as active", () => {
    expect(isTeamworkRecordDeleted("reopened", deletedAt)).toBe(false);
    expect(isTeamworkRecordDeleted("completed", deletedAt)).toBe(false);
    expect(isTeamworkRecordDeleted("new", deletedAt)).toBe(false);
  });

  it("treats status deleted as deleted", () => {
    expect(isTeamworkRecordDeleted("deleted", null)).toBe(true);
    expect(isTeamworkRecordDeleted("Deleted", deletedAt)).toBe(true);
  });

  it("falls back to deletedAt only when there is no status", () => {
    expect(isTeamworkRecordDeleted(null, deletedAt)).toBe(true);
    expect(isTeamworkRecordDeleted("", null)).toBe(false);
  });
});
