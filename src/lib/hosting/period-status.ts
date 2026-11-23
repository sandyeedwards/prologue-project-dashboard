import type { HostingReportRow, HostingView } from "./reporting";

export type HostingPeriodStatus =
  | "Includes forecast"
  | "IVION invoices not loaded"
  | "Includes estimated costs"
  | "Provisional: unclassified NavVis bills"
  | "Recorded";

/**
 * What a period's figures rest on, most uncertain first. The fixed $100 Benaco subscription is a
 * known cost, so it does not make a period "estimated"; only modeled pano or instance costs do.
 */
export function hostingPeriodStatus(row: HostingReportRow, view: HostingView): HostingPeriodStatus {
  if (row.forecast) return "Includes forecast";
  const ivion = view !== "benaco";
  const benaco = view !== "ivion";
  if (ivion && (row.ivionMissingInvoiceMonths ?? 0) > 0) return "IVION invoices not loaded";
  const modeledCost =
    (ivion ? (row.ivionEstimatedCost ?? 0) : 0) + (benaco ? row.benacoEstimatedPanoCosts : 0);
  if (modeledCost > 0) return "Includes estimated costs";
  if (ivion && (row.ivionUnverifiedCost ?? 0) > 0) return "Provisional: unclassified NavVis bills";
  return "Recorded";
}

/** Only fully recorded periods may show a confirmed (green) result. */
export function hostingPeriodIsConfirmed(status: HostingPeriodStatus): boolean {
  return status === "Recorded";
}
