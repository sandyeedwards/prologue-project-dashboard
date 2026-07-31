export const dashboardRoles = ["VIEWER", "MANAGER", "ADMIN"] as const;
export type DashboardRole = (typeof dashboardRoles)[number];

const roleRank: Record<DashboardRole, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function isDashboardRole(value: unknown): value is DashboardRole {
  return typeof value === "string" && dashboardRoles.includes(value as DashboardRole);
}

export function roleAllows(actual: DashboardRole, required: DashboardRole): boolean {
  return roleRank[actual] >= roleRank[required];
}

export function safeReturnTo(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "http://local.invalid");
    if (parsed.origin !== "http://local.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
