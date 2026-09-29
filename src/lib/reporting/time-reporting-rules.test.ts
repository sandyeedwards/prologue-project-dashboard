import { describe, expect, it } from "vitest";
import {
  businessDaysBetween,
  classifyTimeReportingEntry,
  clericalShare,
  currentTimeReportingDate,
  expectedMinutesForRange,
  isClericalTime,
  isPtoTime,
  resolveTimeReportingRange,
} from "./time-reporting-rules";

const NOW = new Date("2026-08-24T13:00:00.000Z");

describe("Time Reporting business rules", () => {
  it("uses Richmond/Eastern calendar dates", () => {
    expect(currentTimeReportingDate(new Date("2026-08-25T02:00:00.000Z"))).toBe("2026-08-24");
  });

  it("defaults to the current month through today", () => {
    expect(resolveTimeReportingRange({}, NOW)).toEqual({
      preset: "month",
      startDate: "2026-08-01",
      endDate: "2026-08-24",
    });
  });

  it("uses Monday as the start of the current week", () => {
    expect(resolveTimeReportingRange({ preset: "week" }, NOW)).toEqual({
      preset: "week",
      startDate: "2026-08-24",
      endDate: "2026-08-24",
    });
  });

  it("supports rolling quick ranges", () => {
    expect(resolveTimeReportingRange({ preset: "3m" }, NOW).startDate).toBe("2026-05-24");

    expect(resolveTimeReportingRange({ preset: "6m" }, NOW).startDate).toBe("2026-02-24");

    expect(resolveTimeReportingRange({ preset: "1y" }, NOW).startDate).toBe("2025-08-24");
  });

  it("uses a valid custom range", () => {
    expect(
      resolveTimeReportingRange(
        {
          preset: "custom",
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
        NOW,
      ),
    ).toEqual({
      preset: "custom",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
  });

  it("falls back to current month for invalid custom dates", () => {
    expect(
      resolveTimeReportingRange(
        {
          preset: "custom",
          startDate: "2026-08-31",
          endDate: "2026-08-01",
        },
        NOW,
      ),
    ).toEqual({
      preset: "month",
      startDate: "2026-08-01",
      endDate: "2026-08-24",
    });
  });

  it("calculates eight expected hours per weekday", () => {
    expect(businessDaysBetween("2026-08-01", "2026-08-24")).toBe(16);

    expect(
      expectedMinutesForRange(
        {
          startDate: "2026-08-01",
          endDate: "2026-08-24",
        },
        "2026-08-24",
      ),
    ).toBe(16 * 8 * 60);
  });

  it("treats every project outside Internal Operations as billable", () => {
    expect(
      classifyTimeReportingEntry({
        projectName: "26-124 - JW Marriott Marco Island - Trinity",
        taskListName: null,
      }),
    ).toBe("BILLABLE");
  });

  it("classifies Internal Operations by task list", () => {
    expect(
      classifyTimeReportingEntry({
        projectName: "Internal Operations",
        taskListName: "Office Time",
      }),
    ).toBe("OFFICE_TIME");

    expect(
      classifyTimeReportingEntry({
        projectName: "Internal Operations",
        taskListName: "Out Of Office",
      }),
    ).toBe("OUT_OF_OFFICE");

    expect(
      classifyTimeReportingEntry({
        projectName: "Internal Operations",
        taskListName: "Special Initiatives",
      }),
    ).toBe("SPECIAL_INITIATIVES");

    expect(
      classifyTimeReportingEntry({
        projectName: "Internal Operations",
        taskListName: null,
      }),
    ).toBe("OTHER_NON_BILLABLE");
  });

  it("recognizes the actual PTO and clerical source tasks", () => {
    expect(
      isPtoTime({
        projectName: "Internal Operations",
        taskListName: "Out Of Office",
        taskName: "PTO",
      }),
    ).toBe(true);

    expect(
      isClericalTime({
        projectName: "Internal Operations",
        taskListName: "Office Time",
        taskName: "Clerical (routine tasks, day-to-day office tasks)",
      }),
    ).toBe(true);
  });

  it("warns only above ten percent clerical time", () => {
    expect(clericalShare(60, 600).warning).toBe(false);
    expect(clericalShare(61, 600).warning).toBe(true);

    // Known August validation case: 725 / 7,255 = 9.99%.
    expect(clericalShare(725, 7255).warning).toBe(false);
  });
});
