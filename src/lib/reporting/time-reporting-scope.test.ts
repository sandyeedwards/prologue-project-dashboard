import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake SQL client: records the employee filter each query receives and returns the employee
// option list for the people query. This checks the scope is enforced in the query itself.
const calls: Array<{ text: string; values: unknown[] }> = [];
const peopleOptions = [
  {
    personId: "11111111-1111-4111-8111-111111111111",
    teamworkId: 101,
    firstName: "Ana",
    lastName: "A",
    email: null,
  },
  {
    personId: "22222222-2222-4222-8222-222222222222",
    teamworkId: 202,
    firstName: "Ben",
    lastName: "B",
    email: null,
  },
];
function fakeSql(strings: TemplateStringsArray, ...values: unknown[]) {
  const text = strings.join("?");
  calls.push({ text, values });
  if (text.includes("from people person") && !text.includes("pto_allowance_overrides"))
    return Promise.resolve(peopleOptions);
  return Promise.resolve([]);
}
vi.mock("@/db/client", () => ({ getSqlClient: () => fakeSql }));

const { getTimeReportingReport } = await import("./time-reporting-data");

/** The employee filter value passed to queries that filter on it. */
function employeeFilters(): string[] {
  return calls
    .filter((call) => call.text.includes("string_to_array(nullif("))
    .flatMap((call) =>
      call.text.includes("person.id = any") || call.text.includes("te.person_id = any")
        ? call.values
            .filter((value): value is string => typeof value === "string")
            .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value))
        : [],
    );
}

describe("time reporting employee scope", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("limits a scoped report to the signed-in employee, ignoring a requested employee", async () => {
    const report = await getTimeReportingReport({
      employeeIds: [peopleOptions[1].personId],
      scopeToTeamworkUserId: 101,
      now: new Date("2026-11-09T15:00:00Z"),
    });
    expect(report.filters.employeeIds).toEqual([peopleOptions[0].personId]);
    expect(report.filterOptions.employees.map((row) => row.personId)).toEqual([
      peopleOptions[0].personId,
    ]);
    expect(employeeFilters().length).toBeGreaterThan(0);
    expect(new Set(employeeFilters())).toEqual(new Set([peopleOptions[0].personId]));
  });

  it("returns no employee data when the signed-in user has no linked person", async () => {
    const report = await getTimeReportingReport({
      scopeToTeamworkUserId: null,
      now: new Date("2026-11-09T15:00:00Z"),
    });
    expect(report.filters.employeeIds).toEqual(["00000000-0000-0000-0000-000000000000"]);
    expect(report.filterOptions.employees).toEqual([]);
  });

  it("keeps the all-employee view and its filter when no scope is given", async () => {
    const report = await getTimeReportingReport({
      employeeIds: [peopleOptions[1].personId],
      now: new Date("2026-11-09T15:00:00Z"),
    });
    expect(report.filters.employeeIds).toEqual([peopleOptions[1].personId]);
    expect(report.filterOptions.employees).toHaveLength(2);
  });
});
