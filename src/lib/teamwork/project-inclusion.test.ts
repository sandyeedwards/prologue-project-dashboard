import { describe, expect, it } from "vitest";
import {
  isDataHallProjectTag,
  isExcludedProjectTag,
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
    expect(projectReportingPolicy(["DataHall", "NoReport"]).exclusionReason).toBe(
      "NoReport tag",
    );
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
