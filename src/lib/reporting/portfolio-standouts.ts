import type { ProjectReportRow } from "./dashboard-data";

export type PortfolioStandout = {
  key: "margin" | "accuracy" | "revenue" | "hours";
  label: string;
  value: string;
  detail: string;
  project: ProjectReportRow;
};

function numeric(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(minutes: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
}

function isActive(project: ProjectReportRow): boolean {
  const status = project.status.trim().toLowerCase();
  return (
    !project.archivedAt &&
    !project.completedAt &&
    status !== "archived" &&
    status !== "completed" &&
    status !== "complete" &&
    status !== "cancelled" &&
    status !== "canceled"
  );
}

function isCompleted(project: ProjectReportRow): boolean {
  const status = project.status.trim().toLowerCase();
  return Boolean(
    project.completedAt ||
    project.archivedAt ||
    status === "completed" ||
    status === "complete" ||
    status === "archived",
  );
}

export function getPortfolioStandouts(projects: ProjectReportRow[]): PortfolioStandout[] {
  const active = projects.filter(isActive);
  const marginLeader = active
    .filter(
      (project) =>
        !project.isProvisional &&
        numeric(project.clientFee) !== null &&
        numeric(project.forecastMarginPercent) !== null,
    )
    .sort(
      (left, right) =>
        (numeric(right.forecastMarginPercent) ?? Number.NEGATIVE_INFINITY) -
        (numeric(left.forecastMarginPercent) ?? Number.NEGATIVE_INFINITY),
    )[0];
  const revenueLeader = active
    .filter((project) => numeric(project.clientFee) !== null)
    .sort(
      (left, right) =>
        (numeric(right.clientFee) ?? Number.NEGATIVE_INFINITY) -
        (numeric(left.clientFee) ?? Number.NEGATIVE_INFINITY),
    )[0];
  const hoursLeader = projects
    .filter((project) => project.loggedMinutes > 0)
    .sort((left, right) => right.loggedMinutes - left.loggedMinutes)[0];
  const completedWithEstimates = projects
    .filter(
      (project) =>
        isCompleted(project) && project.canonicalEstimatedMinutes > 0 && project.loggedMinutes > 0,
    )
    .map((project) => ({
      project,
      ratio: project.loggedMinutes / project.canonicalEstimatedMinutes,
    }))
    .sort((left, right) => Math.abs(left.ratio - 1) - Math.abs(right.ratio - 1));
  const accuracyLeader = completedWithEstimates[0];

  return [
    marginLeader
      ? {
          key: "margin" as const,
          label: "Strongest active margin",
          value: `${numeric(marginLeader.forecastMarginPercent)?.toFixed(1)}%`,
          detail: "Forecast margin",
          project: marginLeader,
        }
      : null,
    accuracyLeader
      ? {
          key: "accuracy" as const,
          label: "Closest completed estimate",
          value: `${(accuracyLeader.ratio * 100).toFixed(1)}%`,
          detail: `${formatHours(accuracyLeader.project.loggedMinutes)} logged of ${formatHours(accuracyLeader.project.canonicalEstimatedMinutes)} estimated`,
          project: accuracyLeader.project,
        }
      : null,
    revenueLeader
      ? {
          key: "revenue" as const,
          label: "Largest active engagement",
          value: formatMoney(numeric(revenueLeader.clientFee) ?? 0),
          detail: "Current project revenue",
          project: revenueLeader,
        }
      : null,
    hoursLeader
      ? {
          key: "hours" as const,
          label: "Most hours delivered",
          value: formatHours(hoursLeader.loggedMinutes),
          detail: "Logged project time",
          project: hoursLeader,
        }
      : null,
  ].filter((item): item is PortfolioStandout => item !== null);
}
