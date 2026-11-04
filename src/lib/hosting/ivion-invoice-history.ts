// Source: user-provided "Navvis 2023 thru Oct 2026.xls", Expenses sheet.
// Bill dates are the available timing basis; payment dates were not supplied.
// Months without bills within this export's coverage have zero invoice activity.
// The export only contains Date, Type, No., Payee and Total. It has no line-item
// descriptions or expense categories: these are unclassified vendor bills,
// not independently verified IVION-instance-only charges.
export const IVION_INVOICE_COVERAGE_START = "2024-01";
export const IVION_INVOICE_COVERAGE_END = "2026-09";

// Exact invoice dates preserve as-of cutoffs within a month.
const IVION_INVOICES: ReadonlyArray<readonly [string, number, string]> = [
  ["2024-05-22", 17220, "INUS20240502433"],
  ["2024-06-11", 6600, "INUS20240602462"],
  ["2024-06-13", 1530, "INUS20240602473"],
  ["2024-08-12", 160.58, "INUS20240802584"],
  ["2024-11-19", 4305, "INUS20241102862"],
  ["2024-12-30", 23411.25, "INUS20241203008"],
  ["2025-01-23", 6750, "INUS20250103070"],
  ["2025-04-18", 966.74, "INUS20250403328"],
  ["2025-07-02", 11700, "INUS20250703581"],
  ["2025-07-31", 6750, "INUS20250803706"],
  ["2025-08-19", 11880, "INUS20250703657"],
  ["2026-01-08", 24180, "INUS20260104214"],
  ["2026-04-27", 6920, "INUS20260404639"],
  ["2026-05-21", 6920, "INUS20260504732"],
  ["2026-06-09", 3960, "INUS20260604853"],
  ["2026-07-07", 24180, "UNUS20260704987"],
  ["2026-09-30", 10555, "INUS20261005445"],
];

export type IvionInvoiceEntry = {
  date: string;
  amount: number;
  hostingAmount: number;
  processingAmount: number;
  invoiceNumber: string;
  classification: "processing" | "unverified";
};

// User-directed reporting allocation, 2026-11-04: Processing is accounted for
// with fieldwork. These three strong purchase-history matches are excluded
// from hosting only. Original vendor totals remain intact for reconciliation.
// Ambiguous June 2024 and July/August 2025 bills are not automatically excluded.
const PROCESSING_INVOICES = new Set(["INUS20250103070", "INUS20260404639", "INUS20260504732"]);

export function ivionInvoiceEntriesBetween(start: Date, endExclusive: Date): IvionInvoiceEntry[] {
  const from = start.toISOString().slice(0, 10);
  const to = endExclusive.toISOString().slice(0, 10);
  return IVION_INVOICES.filter(([date]) => date >= from && date < to).map(
    ([date, amount, invoiceNumber]) => ({
      date,
      amount,
      hostingAmount: PROCESSING_INVOICES.has(invoiceNumber) ? 0 : amount,
      processingAmount: PROCESSING_INVOICES.has(invoiceNumber) ? amount : 0,
      invoiceNumber,
      classification: PROCESSING_INVOICES.has(invoiceNumber) ? "processing" : "unverified",
    }),
  );
}

export function ivionInvoiceCostBetween(start: Date, endExclusive: Date): number {
  return ivionInvoiceEntriesBetween(start, endExclusive).reduce(
    (sum, entry) => sum + entry.hostingAmount,
    0,
  );
}
