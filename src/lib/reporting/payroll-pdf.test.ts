import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { type PayrollRow } from "./payroll-data";
import { payrollPdf } from "./payroll-pdf";

function entry(index: number, overrides: Partial<PayrollRow> = {}): PayrollRow {
  return {
    teamwork_id: String(index),
    person_id: `person-${index}`,
    employee_name: `Employee ${String(index).padStart(3, "0")}`,
    employee_teamwork_id: String(500 + index),
    project_id: "project-1",
    project_name: "Client A",
    task_name: "Scanning",
    logged_date: "2026-11-02",
    minutes: 480,
    description: null,
    is_pto: false,
    is_billable: true,
    lock_on: null,
    baseline: false,
    changed_after_lock: false,
    ...overrides,
  };
}

const period = { startDate: "2026-11-01", endDate: "2026-11-15" };

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("payroll PDF", () => {
  it("continues the employee summary onto new pages instead of dropping employees", async () => {
    const one = await payrollPdf([entry(1)], "2026-11-17", period, false);
    expect(await pageCount(one)).toBe(1);
    const many = Array.from({ length: 60 }, (_, index) => entry(index + 1));
    expect(await pageCount(await payrollPdf(many, "2026-11-17", period, false))).toBeGreaterThan(1);
  });

  it("lists every PTO employee total, continuing onto new pages", async () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      entry(index + 1, {
        project_name: "Internal Operations",
        task_name: "PTO",
        is_pto: true,
        is_billable: false,
        lock_on: "2026-11-17",
      }),
    );
    // 40 totals (~21 per page) spill to page 2, then 40 detail rows need two more pages.
    // Truncating totals at 4 people would produce only 3 pages.
    expect(await pageCount(await payrollPdf(rows, "2026-11-17", period, true))).toBe(4);
  });
});
