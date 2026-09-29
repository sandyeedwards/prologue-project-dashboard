import { describe, expect, it } from "vitest";

import { payrollCsv, payrollStatus, type PayrollRow } from "./payroll-data";

const row: PayrollRow = {
  teamwork_id: "42",
  person_id: "person-1",
  employee_name: "Alex Morgan",
  employee_teamwork_id: "501",
  project_id: "project-1",
  project_name: "Internal Operations",
  task_name: "PTO",
  logged_date: "2026-07-01",
  minutes: 480,
  description: "Paid time off",
  is_pto: true,
  is_billable: false,
  lock_on: "2026-07-31",
  baseline: false,
  changed_after_lock: false,
};

describe("payroll exports", () => {
  it("labels locked PTO source differences for payroll review", () => {
    expect(payrollStatus({ ...row, changed_after_lock: true }, "2026-09-18")).toBe(
      "Locked - source change requires review",
    );
  });

  it("emits a general CSV with exact minutes and stable identifiers", () => {
    const csv = payrollCsv([row], "2026-09-18", {
      startDate: "2026-07-01",
      endDate: "2026-07-14",
    });

    expect(csv).toContain('"Teamwork employee ID"');
    expect(csv).toContain('"501"');
    expect(csv).toContain('"480"');
    expect(csv).toContain('"42"');
    expect(csv).toContain('"Locked"');
  });
});
