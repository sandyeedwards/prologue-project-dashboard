// Source: user-provided "Navvis 2023 thru Oct 2026.xls", Expenses sheet.
// Bill dates are the available timing basis; payment dates were not supplied.
// Months without bills within this export's coverage have zero invoice activity.
export const IVION_INVOICE_COVERAGE_START = "2024-01";
export const IVION_INVOICE_COVERAGE_END = "2026-09";

// Exact invoice dates preserve as-of cutoffs within a month.
const IVION_INVOICES: ReadonlyArray<readonly [string, number]> = [
  ["2024-05-22", 17220],
  ["2024-06-11", 6600],
  ["2024-06-13", 1530],
  ["2024-08-12", 160.58],
  ["2024-11-19", 4305],
  ["2024-12-30", 23411.25],
  ["2025-01-23", 6750],
  ["2025-04-18", 966.74],
  ["2025-07-02", 11700],
  ["2025-07-31", 6750],
  ["2025-08-19", 11880],
  ["2026-01-08", 24180],
  ["2026-04-27", 6920],
  ["2026-05-21", 6920],
  ["2026-06-09", 3960],
  ["2026-07-07", 24180],
  ["2026-09-30", 10555],
];

export function ivionInvoiceCostBetween(start: Date, endExclusive: Date): number {
  const from = start.toISOString().slice(0, 10);
  const to = endExclusive.toISOString().slice(0, 10);
  return IVION_INVOICES.reduce(
    (sum, [date, amount]) => sum + (date >= from && date < to ? amount : 0),
    0,
  );
}
