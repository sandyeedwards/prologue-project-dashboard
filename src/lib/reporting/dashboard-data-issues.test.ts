import { describe, expect, it } from "vitest";
import {
  assembleTeamworkIssueCenterRows,
  buildQualityIssueRows,
  businessDateFromTimestamp,
  type IssueCenterProject,
  type QualityIssueRow,
  type RawIssueTimeEntryRow,
  type RawQualityIssueRow,
  type UnplannedWorkRow,
} from "./dashboard-data";

const detectedAt = new Date("2026-11-10T15:00:00Z");

function rawIssue(overrides: Partial<RawQualityIssueRow>): RawQualityIssueRow {
  return {
    id: "issue",
    taskId: null,
    severity: "WARNING",
    code: "PROJECT_BUDGET_MISSING",
    message: "message",
    taskListName: null,
    taskName: null,
    details: null,
    lastDetectedAt: detectedAt,
    taskTeamworkId: null,
    ...overrides,
  };
}

function timeEntry(overrides: Partial<RawIssueTimeEntryRow>): RawIssueTimeEntryRow {
  return {
    id: "te",
    teamworkId: 1,
    taskId: null,
    taskName: null,
    taskListName: null,
    loggedDate: "2026-11-01",
    minutes: 60,
    description: null,
    historicalCostTotal: "50.00",
    historicalCostRate: "50.00",
    costInfoReturned: true,
    personName: "Pat Lee",
    ...overrides,
  };
}

describe("buildQualityIssueRows", () => {
  const timeEntries = [
    timeEntry({ id: "unallocated", taskId: null }),
    timeEntry({ id: "uncosted", taskId: "t1", costInfoReturned: false, taskName: "Model" }),
    timeEntry({ id: "on-task", taskId: "t2", taskName: "Scan", taskListName: "Fieldwork" }),
  ];

  it("routes evidence by issue type and builds Teamwork links", () => {
    const rows = buildQualityIssueRows({
      rows: [
        rawIssue({ id: "a", code: "UNALLOCATED_PROJECT_TIME" }),
        rawIssue({ id: "b", code: "ACTUAL_LABOR_COST_INCOMPLETE" }),
        rawIssue({ id: "c", code: "MISSING_TASK_ASSIGNMENT", taskId: "t2", taskTeamworkId: 77 }),
        rawIssue({ id: "d", code: "TASK_LIST_BUDGET_COVERAGE_INCOMPLETE" }),
      ],
      timeEntries,
      missingTaskLists: [{ id: "tl1", teamworkId: 9, name: "Drafting" }],
      teamworkBase: "https://example.teamwork.com",
      projectTeamworkId: 42,
    });

    expect(rows.map((row) => row.evidence.map((item) => item.id))).toEqual([
      ["unallocated"],
      ["uncosted"],
      ["on-task"],
      ["tl1"],
    ]);
    expect(rows[0]?.evidence[0]?.label).toBe("Time logged directly to the project");
    expect(rows[2]?.evidence[0]?.label).toBe("Fieldwork · Scan");
    expect(rows.map((row) => row.teamworkUrl)).toEqual([
      "https://example.teamwork.com/app/projects/42/time",
      "https://example.teamwork.com/app/projects/42/time",
      "https://example.teamwork.com/app/tasks/77",
      "https://example.teamwork.com/app/projects/42/finance/budgets",
    ]);
    expect(rows[0]?.lastDetectedAt).toEqual(detectedAt);
  });

  it("leaves links empty without a Teamwork site", () => {
    const [row] = buildQualityIssueRows({
      rows: [rawIssue({ code: "UNALLOCATED_PROJECT_TIME" })],
      timeEntries,
      missingTaskLists: [],
      teamworkBase: null,
      projectTeamworkId: 42,
    });
    expect(row?.teamworkUrl).toBeNull();
    expect(row?.evidence[0]?.teamworkUrl).toBeNull();
  });
});

describe("assembleTeamworkIssueCenterRows", () => {
  const projects: IssueCenterProject[] = [
    {
      id: "p-b",
      teamworkId: 2,
      name: "Bravo",
      projectNumber: "26-002",
      companyName: "Client B",
      status: "active",
    },
    {
      id: "p-a",
      teamworkId: 1,
      name: "Alpha",
      projectNumber: null,
      companyName: null,
      status: "active",
    },
  ];

  const quality = (id: string, severity: QualityIssueRow["severity"]): QualityIssueRow => ({
    id,
    taskId: null,
    severity,
    code: "PROJECT_BUDGET_MISSING",
    message: "message",
    taskListName: null,
    taskName: null,
    lastDetectedAt: detectedAt,
    details: null,
    teamworkUrl: null,
    evidence: [],
  });

  const unplanned = (issueId: string, overrides: Partial<UnplannedWorkRow>): UnplannedWorkRow => ({
    issueId,
    projectId: "p-a",
    taskId: "task",
    teamworkTaskId: null,
    taskName: "Task",
    taskListName: "List",
    loggedMinutes: 90,
    laborCost: "75.00",
    firstLoggedDate: "2026-11-01",
    lastLoggedDate: "2026-11-02",
    lastDetectedAt: detectedAt,
    isDismissed: false,
    dismissedAt: null,
    dismissedByName: null,
    ...overrides,
  });

  it("orders open before reviewed, then severity, then project name", () => {
    const rows = assembleTeamworkIssueCenterRows({
      projects,
      qualityIssuesByProject: new Map([
        ["p-b", [quality("b-warning", "WARNING"), quality("b-error", "ERROR")]],
        ["p-a", [quality("a-warning", "WARNING")]],
      ]),
      unplannedWorkByProject: new Map([
        [
          "p-a",
          [
            unplanned("a-reviewed", { isDismissed: true, dismissedByName: "Admin" }),
            unplanned("a-open", { teamworkTaskId: 55 }),
          ],
        ],
      ]),
      teamworkBase: "https://example.teamwork.com",
    });

    expect(rows.map((row) => row.id)).toEqual([
      "b-error",
      "a-warning",
      "b-warning",
      "a-open",
      "a-reviewed",
    ]);
    const open = rows.find((row) => row.id === "a-open");
    expect(open).toMatchObject({
      status: "OPEN",
      severity: "INFO",
      code: "UNPLANNED_ACTUAL_WORK",
      projectName: "Alpha",
      teamworkUrl: "https://example.teamwork.com/app/tasks/55",
      details: { loggedMinutes: 90, laborCost: "75.00", teamworkTaskId: 55 },
    });
    expect(rows.find((row) => row.id === "a-reviewed")).toMatchObject({
      status: "REVIEWED",
      reviewedByName: "Admin",
      teamworkUrl: "https://example.teamwork.com/app/projects/1/time",
    });
    expect(rows.find((row) => row.id === "b-error")).toMatchObject({
      status: "OPEN",
      projectNumber: "26-002",
      companyName: "Client B",
    });
  });

  it("returns no rows for projects without issues", () => {
    expect(
      assembleTeamworkIssueCenterRows({
        projects,
        qualityIssuesByProject: new Map(),
        unplannedWorkByProject: new Map(),
        teamworkBase: null,
      }),
    ).toEqual([]);
  });
});

describe("businessDateFromTimestamp", () => {
  it("buckets evening Eastern timestamps on the Eastern day, not the UTC day", () => {
    // 9:30 PM EST on Nov 17 is already Nov 18 in UTC.
    expect(businessDateFromTimestamp(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
    // 9:30 PM EDT on Jul 1.
    expect(businessDateFromTimestamp(new Date("2026-07-02T01:30:00Z"))).toBe("2026-07-01");
  });

  it("keeps plain dates stored as UTC midnight on their calendar day", () => {
    expect(businessDateFromTimestamp(new Date("2026-11-18T00:00:00Z"))).toBe("2026-11-18");
  });

  it("returns null for missing or invalid values", () => {
    expect(businessDateFromTimestamp(null)).toBeNull();
    expect(businessDateFromTimestamp(new Date("invalid"))).toBeNull();
  });
});
