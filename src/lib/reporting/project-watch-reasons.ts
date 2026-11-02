import type { ProjectReportRow } from "./dashboard-data";

const numeric = (value: string | null | undefined): number | null => {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

export function projectWatchReasons(project: ProjectReportRow): string[] {
  const reasons: string[] = [];
  const overrides = project.healthOverrides ?? [];
  const progress = numeric(project.progressPercent);
  const margin = numeric(project.forecastMarginPercent);
  const low = (value: string | null | undefined) => {
    const score = numeric(value);
    return score !== null && score < 80;
  };
  const consumption =
    project.canonicalEstimatedMinutes > 0 && project.plannedLoggedMinutes !== null
      ? (project.plannedLoggedMinutes / project.canonicalEstimatedMinutes) * 100
      : null;

  if (overrides.includes("NEGATIVE_FORECAST_MARGIN"))
    reasons.push("Forecast costs exceed the client fee");
  if (overrides.includes("MATERIAL_INCOMPLETION_PAST_DUE")) {
    reasons.push(
      `Past project end date with ${progress === null ? "less than 80%" : `${progress.toFixed(0)}%`} of tasks complete`,
    );
  }
  if (overrides.includes("SEVERE_MISSING_DATA")) reasons.push("Severely incomplete reporting data");
  if (low(project.financialScore) && !overrides.includes("NEGATIVE_FORECAST_MARGIN")) {
    const fee = numeric(project.clientFee);
    const targetCost = numeric(project.targetCost);
    const targetMargin =
      fee !== null && fee > 0 && targetCost !== null ? ((fee - targetCost) / fee) * 100 : null;
    reasons.push(
      margin !== null && targetMargin !== null && targetMargin > 0
        ? `Forecast margin ${margin.toFixed(1)}% vs target ${targetMargin.toFixed(1)}%`
        : `Low financial health${margin === null ? "" : `: forecast margin ${margin.toFixed(1)}%`}`,
    );
  }
  if (low(project.scheduleScore) && !overrides.includes("MATERIAL_INCOMPLETION_PAST_DUE")) {
    reasons.push(
      project.startDate && project.endDate
        ? `Task completion behind schedule${progress === null ? "" : ` (${progress.toFixed(0)}% complete)`}`
        : "Low task completion; schedule dates unavailable",
    );
  }
  if (low(project.effortScore)) {
    reasons.push(
      consumption !== null && progress !== null
        ? `${consumption.toFixed(1)}% of planned hours used vs ${progress.toFixed(0)}% of tasks complete`
        : "Hours used are ahead of task completion",
    );
  }
  const overdue = numeric(project.overdueScore);
  if (overdue !== null && overdue < 100) reasons.push("Overdue tasks remain incomplete");
  const missingCosts = [
    ["labor costs", project.laborCoverage],
    ["remaining-work cost rates", project.assignmentCoverage],
    ["vendor expenses", project.expenseCoverage],
  ]
    .filter(([, coverage]) => coverage === "MISSING" || coverage === "PARTIAL")
    .map(([label]) => label);
  if (project.isProvisional)
    reasons.push(
      missingCosts.length
        ? `Provisional forecast: incomplete ${missingCosts.join(", ")}`
        : "Provisional forecast: financial inputs need review",
    );
  if (project.dataQualityIssueCount > 0)
    reasons.push(
      `${project.dataQualityIssueCount} unresolved data issue${project.dataQualityIssueCount === 1 ? "" : "s"}`,
    );
  if (!reasons.length)
    reasons.push(
      project.healthBand === "GRAY"
        ? "Insufficient data to calculate health"
        : `Combined health score ${numeric(project.healthScore)?.toFixed(0) ?? "unavailable"}; review project details`,
    );
  return reasons;
}
