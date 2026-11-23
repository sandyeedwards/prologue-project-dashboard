import { describe, expect, it } from "vitest";
import {
  addWeeks,
  carryForward,
  easternMidnight,
  emptyNotes,
  mondayOf,
  parseNotes,
  parseWeek,
  scheduledHost,
} from "./agenda";

describe("all-hands weeks and host rotation", () => {
  it("finds the Monday of any day", () => {
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(parseWeek("2026-11-25")).toBe("2026-11-23");
    expect(parseWeek("2026-02-30")).toBeNull();
    expect(parseWeek("nope")).toBeNull();
  });

  it("follows the rotation from the anchor, both directions", () => {
    expect(scheduledHost("2026-11-30")).toBe("KEK");
    expect(scheduledHost("2026-11-23")).toBe("AEE");
    expect(scheduledHost("2026-12-07")).toBe("CPS");
    expect(scheduledHost("2026-12-14")).toBe("RBT");
    expect(scheduledHost("2026-12-21")).toBe("FSR");
    expect(scheduledHost(addWeeks("2026-11-30", -7))).toBe("KEK");
  });
});

describe("all-hands notes", () => {
  it("reads damaged or partial notes as blank sections", () => {
    const notes = parseNotes({ missionMoment: 42, longRange: "CPS 12/2", actionItems: "x" });
    expect(notes.missionMoment).toBe("");
    expect(notes.longRange).toBe("CPS 12/2");
    expect(notes.actionItems).toEqual([]);
    expect(parseNotes(null)).toEqual(emptyNotes());
  });

  it("carries ongoing sections and open action items, not week-specific ones", () => {
    const next = carryForward({
      ...emptyNotes(),
      missionMoment: "Story",
      calendar: "Tue AEE WFH",
      hostOverride: "AEE",
      longRange: "RBT 12/10",
      technology: "IVION release",
      actionItems: [
        { id: "a", text: "Virginia Housing HQ follow-up", done: false },
        { id: "b", text: "Jefferson Hotel", done: true },
        { id: "c", text: "  ", done: false },
      ],
    });
    expect(next.missionMoment).toBe("");
    expect(next.calendar).toBe("");
    expect(next.hostOverride).toBe("");
    expect(next.longRange).toBe("RBT 12/10");
    expect(next.technology).toBe("IVION release");
    expect(next.actionItems.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("easternMidnight", () => {
  it("is 05:00 UTC in winter and 04:00 UTC in summer", () => {
    expect(easternMidnight("2026-11-23").toISOString()).toBe("2026-11-23T05:00:00.000Z");
    expect(easternMidnight("2026-07-06").toISOString()).toBe("2026-07-06T04:00:00.000Z");
  });
});
