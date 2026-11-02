import type { HostingReportRow, HostingView } from "./reporting";

export function hostingPeriodStatus(row: HostingReportRow, view: HostingView): string {
  if (row.forecast) return "Includes forecast";
  const modeledCost =
    (view === "benaco" ? 0 : (row.ivionEstimatedCost ?? 0)) +
    (view === "ivion" ? 0 : row.benacoEstimatedCost);
  return modeledCost > 0 ? "Includes estimated costs" : "Recorded";
}
