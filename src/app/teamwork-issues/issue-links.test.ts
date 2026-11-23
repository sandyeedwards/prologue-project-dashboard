import { describe, expect, it } from "vitest";
import {
  ISSUE_GROUP_PAGE_SIZE,
  issueGroupLimit,
  issueViewHref,
  showMoreIssuesHref,
} from "./issue-links";

describe("issueViewHref", () => {
  it("keeps project scope, search, and filters when switching tabs", () => {
    const href = issueViewHref(
      {
        view: "ATTENTION",
        project: "6f1c2a8e-0000-4000-8000-000000000001",
        scope: "DATA_ISSUES",
        q: "hotel lobby",
        severity: "ERROR",
        code: "PROJECT_BUDGET_MISSING",
        path: "TEAMWORK_REQUIRED",
        platform: "MATTERPORT",
        status: "REVIEWED",
        limit: "200",
      },
      "REVIEWED",
    );
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/teamwork-issues");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      view: "REVIEWED",
      project: "6f1c2a8e-0000-4000-8000-000000000001",
      scope: "DATA_ISSUES",
      q: "hotel lobby",
      severity: "ERROR",
      code: "PROJECT_BUDGET_MISSING",
      path: "TEAMWORK_REQUIRED",
      platform: "MATTERPORT",
    });
  });

  it("drops default filter values but keeps the ALL view", () => {
    expect(issueViewHref({ severity: "ALL", code: "ALL", q: "  " }, "ALL")).toBe(
      "/teamwork-issues?view=ALL",
    );
  });

  it("uses the first value of repeated parameters", () => {
    expect(issueViewHref({ project: ["a", "b"] }, "ATTENTION")).toBe(
      "/teamwork-issues?view=ATTENTION&project=a",
    );
  });
});

describe("issue group pagination", () => {
  it("defaults invalid limits to the page size", () => {
    expect(issueGroupLimit(undefined)).toBe(ISSUE_GROUP_PAGE_SIZE);
    expect(issueGroupLimit("0")).toBe(ISSUE_GROUP_PAGE_SIZE);
    expect(issueGroupLimit("-5")).toBe(ISSUE_GROUP_PAGE_SIZE);
    expect(issueGroupLimit("12.5")).toBe(ISSUE_GROUP_PAGE_SIZE);
    expect(issueGroupLimit("abc")).toBe(ISSUE_GROUP_PAGE_SIZE);
    expect(issueGroupLimit("250")).toBe(250);
  });

  it("raises the limit and keeps every other parameter, including status", () => {
    const href = showMoreIssuesHref(
      { view: "ALL", status: "OPEN", project: "p1", limit: "100" },
      100,
    );
    const url = new URL(href, "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      view: "ALL",
      status: "OPEN",
      project: "p1",
      limit: String(100 + ISSUE_GROUP_PAGE_SIZE),
    });
  });
});
