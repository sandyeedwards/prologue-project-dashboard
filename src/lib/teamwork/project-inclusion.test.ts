import { describe, expect, it } from "vitest";
import {
  isDataHallProjectTag,
  isExcludedProjectTag,
  isTimeReportingProjectName,
  projectReportingPolicy,
  shouldIncludeProject,
} from "./project-inclusion";

describe("project reporting policy", () => {
  it.each(["NoReport", "no report", "NO-REPORT", "no_report", " NoReport "])(
    "normalizes the exclusion tag %s",
    (tag) => {
      expect(isExcludedProjectTag(tag)).toBe(true);
    },
  );

  it("excludes a project when any tag is NoReport", () => {
    expect(shouldIncludeProject(["Scanning", "NoReport", "Ready Set"])).toBe(false);
    expect(projectReportingPolicy(["DataHall", "NoReport"]).exclusionReason).toBe("NoReport tag");
  });

  it.each(["Internal Operations", "internal operations", " INTERNAL OPERATIONS "])(
    "recognizes the configured Time Reporting project name %s",
    (projectName) => {
      expect(isTimeReportingProjectName(projectName)).toBe(true);
    },
  );

  it.each([
    "Internal-Operations",
    "Internal_Operations",
    "Internal Operations 2",
    "Operations Internal",
    "Client Internal Operations",
  ])("does not broaden the Time Reporting project exception to %s", (projectName) => {
    expect(isTimeReportingProjectName(projectName)).toBe(false);
  });

  it("keeps the NoReport project-reporting policy intact for Time Reporting", () => {
    expect(isTimeReportingProjectName("Internal Operations")).toBe(true);
    expect(shouldIncludeProject(["NoReport"])).toBe(false);
    expect(projectReportingPolicy(["NoReport"]).excluded).toBe(true);
  });

  it("includes Ready Set projects", () => {
    const policy = projectReportingPolicy(["Ready Set"]);
    expect(policy.excluded).toBe(false);
    expect(policy.isReadySet).toBe(true);
    expect(policy.projectType).toBe("Ready Set");
  });

  it.each(["DataHall", "data hall", "DATA-HALL", "data_hall"])(
    "recognizes the DataHall tag %s",
    (tag) => {
      expect(isDataHallProjectTag(tag)).toBe(true);
      expect(projectReportingPolicy([tag]).projectType).toBe("DataHall");
    },
  );

  it("derives the normal scanning and modeling project types", () => {
    expect(projectReportingPolicy(["Scanning"]).projectType).toBe("Scanning");
    expect(projectReportingPolicy(["Modeling"]).projectType).toBe("Modeling");
    expect(projectReportingPolicy(["Scanning", "Modeling"]).projectType).toBe(
      "Scanning + Modeling",
    );
  });
});
