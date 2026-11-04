import { describe, expect, it } from "vitest";
import { ivionInvoiceCostBetween, ivionInvoiceEntriesBetween } from "./ivion-invoice-history";
import { NAVVIS_PURCHASE_EVIDENCE } from "./navvis-purchase-evidence";

describe("IVION invoice audit", () => {
  it("excludes only the user-directed processing allocations, not other product clues", () => {
    const from = new Date("2024-01-01T00:00:00Z"),
      to = new Date("2026-11-05T00:00:00Z");
    const invoices = ivionInvoiceEntriesBetween(from, to);
    const ids = new Set(invoices.map((invoice) => invoice.invoiceNumber));
    expect(Object.keys(NAVVIS_PURCHASE_EVIDENCE).every((id) => ids.has(id))).toBe(true);
    const likelyProcessing = invoices.filter(
      (invoice) =>
        NAVVIS_PURCHASE_EVIDENCE[invoice.invoiceNumber]?.category === "likely-processing",
    );
    expect(likelyProcessing).toHaveLength(3);
    expect(likelyProcessing.reduce((total, invoice) => total + invoice.amount, 0)).toBe(20590);
    expect(NAVVIS_PURCHASE_EVIDENCE.INUS20250403328.category).toBe("likely-instance");
    expect(NAVVIS_PURCHASE_EVIDENCE.INUS20250803706.category).toBe("ambiguous");
    expect(NAVVIS_PURCHASE_EVIDENCE.INUS20250703657.category).toBe("ambiguous");
    expect(
      invoices
        .filter((invoice) => invoice.classification === "processing")
        .map((invoice) => invoice.invoiceNumber)
        .sort(),
    ).toEqual(likelyProcessing.map((invoice) => invoice.invoiceNumber).sort());
    expect(invoices.reduce((total, invoice) => total + invoice.processingAmount, 0)).toBe(20590);
    expect(ivionInvoiceCostBetween(from, to)).toBeCloseTo(147398.57, 2);
  });
  it("exposes the same 2024-onward entries used by reporting, without adding instance rates", () => {
    const from = new Date("2024-01-01T00:00:00Z"),
      to = new Date("2026-11-05T00:00:00Z");
    const entries = ivionInvoiceEntriesBetween(from, to);
    expect(entries).toHaveLength(17);
    expect(new Set(entries.map((entry) => entry.invoiceNumber)).size).toBe(17);
    expect(entries.filter((entry) => entry.classification === "processing")).toHaveLength(3);
    expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBeCloseTo(167988.57, 2);
    expect(
      entries.reduce((sum, entry) => sum + entry.hostingAmount + entry.processingAmount, 0),
    ).toBeCloseTo(167988.57, 2);
    expect(ivionInvoiceCostBetween(from, to)).toBeCloseTo(147398.57, 2);
  });
  it("clips included entries exactly at the report dates", () => {
    expect(
      ivionInvoiceEntriesBetween(
        new Date("2024-06-12T00:00:00Z"),
        new Date("2024-06-14T00:00:00Z"),
      ),
    ).toEqual([
      {
        date: "2024-06-13",
        amount: 1530,
        hostingAmount: 1530,
        processingAmount: 0,
        invoiceNumber: "INUS20240602473",
        classification: "unverified",
      },
    ]);
    expect(
      ivionInvoiceCostBetween(new Date("2024-06-13T00:00:00Z"), new Date("2024-06-13T00:00:00Z")),
    ).toBe(0);
  });
  it("places each processing exclusion in its own bill period without creating extra fieldwork expenses", () => {
    for (const [start, end, excluded] of [
      ["2025-01-01", "2025-02-01", 6750],
      ["2026-04-01", "2026-05-01", 6920],
      ["2026-05-01", "2026-06-01", 6920],
    ] as const) {
      const from = new Date(`${start}T00:00:00Z`),
        to = new Date(`${end}T00:00:00Z`);
      const entries = ivionInvoiceEntriesBetween(from, to);
      expect(entries.reduce((sum, entry) => sum + entry.amount, 0)).toBe(excluded);
      expect(entries.reduce((sum, entry) => sum + entry.processingAmount, 0)).toBe(excluded);
      expect(ivionInvoiceCostBetween(from, to)).toBe(0);
    }
  });
});
