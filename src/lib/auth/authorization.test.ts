import { describe, expect, it } from "vitest";
import { parseAdminEmails, roleAllows, safeReturnTo } from "./authorization";

describe("roleAllows", () => {
  it("enforces the role hierarchy", () => {
    expect(roleAllows("ADMIN", "VIEWER")).toBe(true);
    expect(roleAllows("MANAGER", "VIEWER")).toBe(true);
    expect(roleAllows("VIEWER", "MANAGER")).toBe(false);
    expect(roleAllows("MANAGER", "ADMIN")).toBe(false);
  });
});

describe("safeReturnTo", () => {
  it("allows internal paths and rejects external redirects", () => {
    expect(safeReturnTo("/admin/users?tab=active")).toBe("/admin/users?tab=active");
    expect(safeReturnTo("https://example.com")).toBe("/dashboard");
    expect(safeReturnTo("//example.com")).toBe("/dashboard");
    expect(safeReturnTo("/\\example.com")).toBe("/dashboard");
    expect(safeReturnTo(null)).toBe("/dashboard");
  });
});

describe("parseAdminEmails", () => {
  it("normalizes a comma-separated allowlist", () => {
    expect([...parseAdminEmails(" Admin@Example.com, second@example.com ")]).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
  });
});
