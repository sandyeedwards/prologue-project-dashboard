import { describe, expect, it } from "vitest";
import { normalizeTeamworkLabel, teamworkLabelText } from "./normalize";

describe("Teamwork label normalization", () => {
  it("normalizes ordinary strings", () => {
    expect(normalizeTeamworkLabel("Ready Set")).toBe("readyset");
  });

  it("reads object-backed tag names", () => {
    expect(normalizeTeamworkLabel({ id: 12, name: "Ready Set" })).toBe("readyset");
  });

  it("reads nested tag references", () => {
    expect(teamworkLabelText({ tag: { name: "Modeling" } })).toBe("Modeling");
  });

  it("returns an empty key for unsupported values", () => {
    expect(normalizeTeamworkLabel(null)).toBe("");
    expect(normalizeTeamworkLabel({ id: 12 })).toBe("");
  });
});
