import { describe, expect, it } from "vitest";
import {
  adminBenchmark,
  buildMeetingProjects,
  filterMeetingProjects,
  forecastConfidence,
  meetingWindow,
  type MeetingProjectSource,
  type MeetingTask,
} from "./mmm-report";
import type { ProjectReportRow } from "./dashboard-data";

const now = new Date("2026-11-04T13:00:00Z");
const source: MeetingProjectSource = {
  id: "p1",
  teamworkId: 101,
  name: "Example project",
  projectNumber: "26-101",
  companyName: "Example client",
  owner: "Andrew",
  status: "active",
  startDate: "2026-10-01",
  endDate: "2026-11-20",
  archivedAt: null,
  completedAt: null,
  lastSyncedAt: new Date("2026-11-04T10:00:00Z"),
};
const metric: ProjectReportRow = {
  ...source,
  canonicalEstimatedMinutes: 600,
  loggedMinutes: 240,
  forecastProfit: "1200",
  forecastCost: "800",
  actualTotalCost: "300",
  clientFee: "2000",
  forecastMarginPercent: "60",
  isProvisional: false,
  dataQualityIssueCount: 0,
  calculatedAt: new Date("2026-11-04T11:00:00Z"),
  projectType: "Scanning",
  targetCost: "1000",
  actualLaborCost: "200",
  actualNonLaborCost: "100",
  plannedLoggedMinutes: 240,
  unplannedLoggedMinutes: 0,
  completedTaskCount: 0,
  totalTaskCount: 1,
  progressPercent: "0",
  healthScore: "100",
  healthBand: "GREEN",
  laborCoverage: "COMPLETE",
  assignmentCoverage: "COMPLETE",
  taskListBudgetCoverage: "COMPLETE",
  expenseCoverage: "COMPLETE",
  tags: ["Scanning"],
  calculationVersion: "test",
};
const task = (fields: Partial<MeetingTask> = {}): MeetingTask => ({
  id: "t1",
  projectId: "p1",
  teamworkId: 1001,
  parentTaskId: null,
  name: "Scanning",
  taskListName: "Field services",
  group: "Fieldwork",
  status: "new",
  dueDate: "2026-11-05",
  completedAt: null,
  assignees: ["Andrew"],
  ownLoggedMinutes: 240,
  lastWeekMinutes: 120,
  countedEstimatedMinutes: 600,
  branchLoggedMinutes: 240,
  remainingMinutes: 360,
  isCanonicalHolder: true,
  isBranchComplete: false,
  isOutsourced: false,
  coveredByTaskId: "t1",
  metricsAvailable: true,
  ...fields,
});
const build = (
  tasks: MeetingTask[] = [task()],
  metrics: ProjectReportRow[] = [metric],
  sources: MeetingProjectSource[] = [source],
) =>
  buildMeetingProjects(
    sources,
    metrics.map((row) => ({
      ...row,
      totalTaskCount: tasks.filter((task) => task.projectId === row.id).length,
    })),
    tasks,
    [{ projectId: "p1", lastWeekMinutes: 180, unallocatedMinutes: 30 }],
    now,
  );

describe("Monday meeting report", () => {
  it("uses Monday–Sunday Eastern dates through DST and UTC midnight", () => {
    expect(meetingWindow(new Date("2026-11-02T03:30:00Z"))).toEqual({
      today: "2026-11-01",
      weekStart: "2026-10-26",
      weekEnd: "2026-11-01",
      lastWeekStart: "2026-10-19",
      lastWeekEnd: "2026-10-25",
    });
    expect(meetingWindow(now)).toEqual({
      today: "2026-11-04",
      weekStart: "2026-11-02",
      weekEnd: "2026-11-08",
      lastWeekStart: "2026-10-26",
      lastWeekEnd: "2026-11-01",
    });
  });

  it("includes only active, unfinished source projects", () => {
    const sources = [
      source,
      ...["completed", "closed", "archived", "on-hold", "unknown"].map((status, index) => ({
        ...source,
        id: `p${index + 2}`,
        status,
      })),
      { ...source, id: "archived", archivedAt: now },
      { ...source, id: "finished", completedAt: now },
    ];
    expect(build([], [], sources).map((p) => p.id)).toEqual(["p1"]);
  });

  it("counts parent and child estimates once and keeps direct task time separate", () => {
    const parent = task({
      id: "parent",
      isCanonicalHolder: false,
      countedEstimatedMinutes: 0,
      remainingMinutes: 360,
      ownLoggedMinutes: 0,
      coveredByTaskId: null,
    });
    const child = task({ parentTaskId: "parent" });
    const [project] = build([parent, child]);
    expect(project.remainingMinutes).toBe(360);
    expect(project.forecastMinutes).toBe(600);
    expect(project.stages[0].estimatedMinutes).toBe(600);
    expect(project.stages[0].loggedMinutes).toBe(240);
    expect(project.unallocatedMinutes).toBe(30);
    expect(project.lastWeekMinutes).toBe(180);
  });

  it("uses logged plus remaining hours, without treating completion percent as effort", () => {
    const [project] = build([
      task({
        isBranchComplete: true,
        completedAt: now,
        status: "completed",
        remainingMinutes: 360,
      }),
    ]);
    expect(project.progressPercent).toBe(100);
    expect(project.remainingMinutes).toBe(0);
    expect(project.forecastMinutes).toBe(240);
    expect(project.varianceMinutes).toBe(-360);
  });

  it("shows actual final hours for a completed zero-estimate work group", () => {
    const [project] = build([
      task({
        countedEstimatedMinutes: 0,
        isCanonicalHolder: false,
        remainingMinutes: 0,
        completedAt: now,
        status: "complete",
        isBranchComplete: true,
      }),
    ]);
    expect(project.stages[0].estimatedMinutes).toBe(0);
    expect(project.stages[0].forecastMinutes).toBe(240);
  });

  it("excludes vendor estimates and inherited vendor subtasks from internal remaining work", () => {
    const vendor = task({
      id: "vendor",
      group: "Modeling",
      isOutsourced: true,
      countedEstimatedMinutes: 6000,
      remainingMinutes: 5500,
    });
    const child = task({
      id: "vendor-child",
      parentTaskId: "vendor",
      group: "Modeling",
      isOutsourced: false,
      countedEstimatedMinutes: 100,
      remainingMinutes: 100,
    });
    const [project] = build([task(), vendor, child]);
    expect(project.remainingMinutes).toBe(360);
    expect(project.tasks.find((t) => t.id === "vendor-child")?.isOutsourced).toBe(true);
    expect(project.stages.find((s) => s.name === "Modeling")?.estimatedMinutes).toBe(0);
    expect(project.metrics?.forecastCost).toBe("800");
  });

  it("uses Teamwork task estimates for projects and tasks not yet calculated", () => {
    const [uncalculated] = build(
      [task({ metricsAvailable: false, ownEstimatedMinutes: 600, isCanonicalHolder: null })],
      [],
    );
    expect(uncalculated.metrics).toBeNull();
    // 240 logged on the task + 30 unallocated, plus 600 − 240 remaining on the task.
    expect(uncalculated.forecastMinutes).toBe(630);
    expect(uncalculated.signals.some((s) => s.label.includes("Not calculated yet"))).toBe(true);
    const [partial] = build([
      task(),
      task({
        id: "new-task",
        metricsAvailable: false,
        isCanonicalHolder: null,
        ownEstimatedMinutes: 120,
        ownLoggedMinutes: 0,
      }),
    ]);
    expect(partial.remainingMinutes).toBe(480);
    expect(partial.uncalculatedTasks).toBe(1);
  });

  it("keeps hours when the task count changed, but says so", () => {
    const [project] = buildMeetingProjects(
      [source],
      [{ ...metric, totalTaskCount: 2 }],
      [task()],
      [],
      now,
    );
    expect(project.remainingMinutes).toBe(360);
    expect(project.forecastMinutes).toBe(600);
    expect(project.signals.some((signal) => signal.label.includes("Task list changed"))).toBe(true);
  });

  it("leaves projected hours missing only for Estimate Hours tasks without an estimate, and names them", () => {
    const [project] = build([
      task(),
      task({
        id: "needs-estimate",
        name: "Static Scanning (log time)",
        tags: ["Estimate Hours", "Log Time to Task"],
        countedEstimatedMinutes: 0,
        ownEstimatedMinutes: 0,
        isCanonicalHolder: false,
        coveredByTaskId: null,
        remainingMinutes: 0,
      }),
    ]);
    expect(project.forecastMinutes).toBeNull();
    expect(project.missingEstimateTasks.map((row) => row.name)).toEqual([
      "Static Scanning (log time)",
    ]);
    expect(project.signals.some((s) => s.label.includes("tagged Estimate Hours"))).toBe(true);
    // An untagged task without an estimate does not blank the projection.
    const [untagged] = build([
      task(),
      task({
        id: "x",
        tags: [],
        countedEstimatedMinutes: 0,
        isCanonicalHolder: false,
        coveredByTaskId: null,
      }),
    ]);
    expect(untagged.forecastMinutes).not.toBeNull();
  });

  it("puts projects with delivery risk before projects without flags", () => {
    const sources = [source, { ...source, id: "p2", name: "A healthy project" }];
    const rows = build(
      [task({ dueDate: "2026-11-01" }), task({ id: "t2", projectId: "p2" })],
      [metric, { ...metric, id: "p2" }],
      sources,
    );
    expect(filterMeetingProjects(rows).map((project) => project.id)).toEqual(["p1", "p2"]);
    expect(
      filterMeetingProjects(rows, { focus: "ATTENTION" }).map((project) => project.id),
    ).toEqual(["p1"]);
  });

  it("flags an exhausted estimate while the task remains open", () => {
    const [project] = build(
      [task({ branchLoggedMinutes: 700, ownLoggedMinutes: 700, remainingMinutes: 0 })],
      [{ ...metric, loggedMinutes: 700 }],
    );
    expect(project.completedTasks).toBe(0);
    expect(project.exhaustedEstimates).toBe(1);
    expect(project.forecastMinutes).toBe(700);
    expect(project.signals.map((s) => s.label).join(" ")).toContain(
      "remaining effort needs review",
    );
  });

  it("does not call an unestimated child uncovered when a parent estimate covers it", () => {
    const child = task({
      id: "child",
      parentTaskId: "t1",
      isCanonicalHolder: false,
      countedEstimatedMinutes: 0,
      coveredByTaskId: "t1",
    });
    expect(build([task(), child])[0].unestimatedTasks).toBe(0);
    expect(build([task({ ...child, coveredByTaskId: null })])[0].unestimatedTasks).toBe(1);
  });

  it("separates overdue, due this week, and completed tasks with Eastern completion dates", () => {
    const [project] = build([
      task({ id: "overdue", dueDate: "2026-11-03" }),
      task({ id: "today", dueDate: "2026-11-04" }),
      task({ id: "future", dueDate: "2026-11-08" }),
      task({
        id: "complete",
        dueDate: "2026-11-03",
        completedAt: new Date("2026-11-02T03:30:00Z"),
        status: "completed",
        isBranchComplete: true,
      }),
      task({ id: "undated", dueDate: null }),
    ]);
    expect(project.overdueTasks).toBe(1);
    expect(project.dueThisWeek).toBe(3);
    expect(project.completedLastWeek).toBe(1);
    expect(project.undatedTasks).toBe(1);
  });

  it("preserves the financial forecast and makes provisional or stale inputs visible", () => {
    const [project] = build(
      [task()],
      [{ ...metric, isProvisional: true, calculatedAt: new Date("2026-11-03T11:00:00Z") }],
    );
    expect(project.metrics?.forecastProfit).toBe("1200");
    expect(project.signals.some((s) => s.label.includes("Provisional"))).toBe(true);
    expect(project.signals.some((s) => s.label.includes("newer than"))).toBe(true);
  });

  it("orders work groups Admin, Mobilization, Fieldwork, Modeling, then unclassified", () => {
    expect(
      build(
        ["Modeling", "Unclassified", "Fieldwork", "Admin", "Mobilization"].map((group, index) =>
          task({ id: String(index), group }),
        ),
      )[0].stages.map((s) => s.name),
    ).toEqual(["Admin", "Mobilization", "Fieldwork", "Modeling", "Unclassified"]);
  });

  it("filters owners, clients, names and focus without changing project totals", () => {
    const rows = build([task({ dueDate: "2026-11-03" })]);
    expect(
      filterMeetingProjects(rows, {
        query: "26-101",
        owner: "Andrew",
        client: "Example client",
        focus: "OVERDUE",
      }),
    ).toHaveLength(1);
    expect(filterMeetingProjects(rows, { owner: "Someone else" })).toHaveLength(0);
    expect(rows[0].forecastMinutes).toBe(600);
  });
});

describe("MMM forecast confidence", () => {
  it("counts each project once: fully costed, provisional, or without a forecast", () => {
    const projects = [
      { metrics: metric }, // A: fee, fully costed
      { metrics: { ...metric, id: "b" } }, // B: fee, fully costed
      { metrics: { ...metric, id: "c", isProvisional: true } }, // C: fee, provisional
      { metrics: { ...metric, id: "d", clientFee: null, isProvisional: true } }, // D: no fee
      { metrics: { ...metric, id: "e", clientFee: null, isProvisional: true } }, // E: no fee
      { metrics: null }, // not calculated
    ];
    expect(forecastConfidence(projects)).toEqual({
      fullyCosted: 2,
      provisional: 1,
      withoutForecast: 3,
    });
  });
});

describe("unbudgeted Admin", () => {
  const admin = (fields: Partial<MeetingTask> = {}) =>
    task({
      id: "pm",
      teamworkId: 2001,
      name: "Project management",
      taskListName: "Admin",
      group: "Admin",
      ownLoggedMinutes: 600,
      countedEstimatedMinutes: 0,
      ownEstimatedMinutes: 0,
      remainingMinutes: 0,
      isCanonicalHolder: false,
      coveredByTaskId: null,
      ...fields,
    });
  const benchmark = { typicalPercent: 8, highPercent: 12, projectCount: 10 };

  it("tracks Admin with no estimates as a share of hours, not as missing estimates", () => {
    const [project] = buildMeetingProjects(
      [source],
      [{ ...metric, totalTaskCount: 2 }],
      [task(), admin()],
      [],
      now,
      benchmark,
    );
    const stage = project.stages.find((s) => s.name === "Admin");
    expect(stage?.unbudgeted).toBe(true);
    expect(stage?.label).toBe("Admin");
    expect(stage?.sharePercent).toBeCloseTo((600 / 840) * 100);
    expect(project.unestimatedTasks).toBe(0);
    expect(project.signals.map((s) => s.label)).toContain(
      "Admin is 71% of hours logged (typical 8%)",
    );
  });

  it("stays quiet below the typical range or with little Admin time", () => {
    const [project] = buildMeetingProjects(
      [source],
      [{ ...metric, totalTaskCount: 2 }],
      [task(), admin({ ownLoggedMinutes: 120 })],
      [],
      now,
      benchmark,
    );
    expect(project.signals.some((s) => s.label.startsWith("Admin is"))).toBe(false);
  });

  it("reviews an Admin list that has estimates (older projects) like other work", () => {
    const [project] = buildMeetingProjects(
      [{ ...source, jobType: "Ready Set" }],
      [{ ...metric, totalTaskCount: 2 }],
      [
        task(),
        admin({ countedEstimatedMinutes: 900, isCanonicalHolder: true, remainingMinutes: 300 }),
      ],
      [],
      now,
      benchmark,
    );
    const stage = project.stages.find((s) => s.name === "Admin");
    expect(stage?.unbudgeted).toBe(false);
    expect(stage?.label).toBe("Admin");
    expect(stage?.estimatedMinutes).toBe(900);
  });

  it("does not count the $0 Admin list as missing estimates beside budgeted Project Management", () => {
    const pm = admin({
      id: "pm-budgeted",
      taskListName: "Project Management",
      countedEstimatedMinutes: 600,
      ownEstimatedMinutes: 600,
      isCanonicalHolder: true,
      remainingMinutes: 300,
    });
    const adminTime = admin({
      id: "admin-time",
      taskListName: "Admin",
      metricsAvailable: true,
      coveredByTaskId: null,
    });
    const [project] = buildMeetingProjects(
      [{ ...source, jobType: "Ready Set" }],
      [{ ...metric, totalTaskCount: 3 }],
      [task(), pm, adminTime],
      [],
      now,
      benchmark,
    );
    expect(project.unestimatedTasks).toBe(0);
    expect(project.stages.find((s) => s.name === "Admin")?.unbudgeted).toBe(false);
  });

  it("builds the benchmark from finished projects with logged time only", () => {
    const rows = [5, 6, 8, 10, 20].map((share) => ({ adminMinutes: share, loggedMinutes: 100 }));
    expect(adminBenchmark([...rows, { adminMinutes: 0, loggedMinutes: 0 }])).toEqual({
      typicalPercent: 8,
      highPercent: 10,
      projectCount: 5,
    });
    expect(adminBenchmark(rows.slice(0, 4))).toBeNull();
  });
});
