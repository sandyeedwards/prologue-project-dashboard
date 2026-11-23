import { describe, expect, it } from "vitest";
import { buildBenacoCostCommitments } from "./benaco-profitability";
import { buildHostingCostSourceIssues } from "./data-issues";
import { hostingPeriodIsConfirmed, hostingPeriodStatus } from "./period-status";
import {
  buildHostingReport,
  hostingRevenueGaps,
  isHostingTermExpired,
  normalizeHostingDealDates,
  type HostingDealRow,
  type HostingGrouping,
  type HostingIvionSite,
} from "./reporting";

const url = (id: string) => `https://benaco.com/view/${id}-1234-4567-89ab-123456789abc`;
const deal = (fields: Partial<HostingDealRow>): HostingDealRow =>
  ({
    id: "d1",
    hubspot_deal_id: "1",
    deal_name: "Deal",
    site_name: "Site",
    ...fields,
  }) as HostingDealRow;
const site: HostingIvionSite = {
  id: "s1",
  label: "Instance",
  url: "https://instance.example/",
  started_on: "2024-01-01",
  ended_on: null,
  is_active: true,
  sort_order: 1,
  cost_history: [{ effective_on: "2024-01-01", annual_cost: 12000 }],
};
const today = new Date("2026-11-16T15:00:00Z");
const total = (rows: ReturnType<typeof buildHostingReport>) =>
  rows.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, cost: sum.cost + row.costs }), {
    revenue: 0,
    cost: 0,
  });

describe("hosting dates", () => {
  it("gives the same Benaco cost whether dates arrive as text or as JS Dates", () => {
    const text = deal({
      benaco_url: url("feedface"),
      benaco_hosting_start: "2025-03-01",
      benaco_hosting_end: "2026-03-01",
      benaco_contracted_fee: 900,
      benaco_counted_grid_panos: 1000,
    });
    const asDates = {
      ...text,
      benaco_hosting_start: new Date("2025-03-01T00:00:00Z"),
      benaco_hosting_end: new Date("2026-03-01T00:00:00Z"),
    } as unknown as HostingDealRow;
    const [fromText] = buildBenacoCostCommitments([text], []);
    const [fromDates] = buildBenacoCostCommitments([asDates], []);
    expect(fromText.estimatedPanoCost).toBeCloseTo(380, 2);
    expect(fromDates).toEqual(fromText);
    expect(normalizeHostingDealDates(asDates).benaco_hosting_start).toBe("2025-03-01");
  });
});

describe("hosting forecast totals", () => {
  it("do not change with grouping for the same dates", () => {
    const deals = [
      deal({
        ivion_instance: site.url,
        ivion_hosting_start: "2026-02-01",
        ivion_contracted_fee: 3000,
      }),
      deal({
        id: "d2",
        benaco_url: url("feedbeef"),
        benaco_hosting_start: "2026-12-01",
        benaco_hosting_end: "2027-12-01",
        benaco_contracted_fee: 500,
        benaco_counted_grid_panos: 1000,
      }),
    ];
    for (const range of ["all", "ytd"] as const) {
      const totals = (["month", "quarter", "half", "year"] as HostingGrouping[]).map((grouping) =>
        total(buildHostingReport(deals, grouping, [site], today, range, {}, [], true)),
      );
      for (const value of totals.slice(1)) {
        expect(value.revenue).toBeCloseTo(totals[0].revenue, 6);
        expect(value.cost).toBeCloseTo(totals[0].cost, 6);
      }
    }
  });
});

describe("hosting gaps are flagged, not counted as zero", () => {
  it("flags a Benaco term with an end but no paid start (e.g. Ojai)", () => {
    const [tour] = buildBenacoCostCommitments(
      [
        deal({
          benaco_url: url("0a0a0a0a"),
          benaco_hosting_end: "2027-06-09",
          benaco_contracted_fee: 5500,
          benaco_counted_grid_panos: 2246,
        }),
      ],
      [],
    );
    expect(tour.missingInputs).toBe(true);
  });

  it("lists deals with a paid start but blank fee, and a fee with no paid start", () => {
    const gaps = hostingRevenueGaps([
      deal({ id: "a", site_name: "Blank fee", ivion_hosting_start: "2025-04-10" }),
      deal({
        id: "b",
        site_name: "Zero fee",
        ivion_hosting_start: "2025-08-16",
        ivion_contracted_fee: 0,
      }),
      deal({ id: "c", site_name: "No start", ivion_contracted_fee: 1200 }),
      deal({
        id: "d",
        site_name: "Complimentary",
        ivion_comp_start: "2025-01-01",
        ivion_contracted_fee: 1200,
      }),
    ]);
    expect(gaps).toEqual([
      { dealId: "a", name: "Blank fee", platform: "IVION", kind: "start-without-fee", fee: null },
      { dealId: "c", name: "No start", platform: "IVION", kind: "fee-without-start", fee: 1200 },
    ]);
  });
});

describe("hosting period status", () => {
  const rows = buildHostingReport(
    [],
    "month",
    [site],
    today,
    "custom",
    { from: "2026-08-01", to: "2026-11-16" },
    [],
    false,
  );
  const byPeriod = new Map(rows.map((row) => [row.period, row]));

  it("marks months after the loaded NavVis invoices as not loaded, not recorded", () => {
    expect(hostingPeriodStatus(byPeriod.get("2026-10")!, "ivion")).toBe(
      "IVION invoices not loaded",
    );
    expect(hostingPeriodStatus(byPeriod.get("2026-11")!, "combined")).toBe(
      "IVION invoices not loaded",
    );
  });

  it("treats unclassified NavVis bills as provisional and the $100 subscription as known", () => {
    expect(hostingPeriodStatus(byPeriod.get("2026-09")!, "ivion")).toBe(
      "Provisional: unclassified NavVis bills",
    );
    // A Benaco month with only the fixed subscription is recorded, not "estimated".
    expect(hostingPeriodStatus(byPeriod.get("2026-08")!, "benaco")).toBe("Recorded");
    expect(hostingPeriodIsConfirmed("Recorded")).toBe(true);
    expect(hostingPeriodIsConfirmed("Provisional: unclassified NavVis bills")).toBe(false);
  });
});

describe("hosting business dates", () => {
  it("does not expire a term ending tomorrow when it is evening in Eastern time", () => {
    // 9:30pm Eastern on Nov 16 is already Nov 17 in UTC.
    const evening = new Date("2026-11-17T02:30:00Z");
    expect(isHostingTermExpired("2026-11-17", evening)).toBe(false);
    expect(isHostingTermExpired("2026-11-16", evening)).toBe(true);
  });
});

describe("hosting cost source checks", () => {
  it("flags months after the loaded NavVis bills and lists unconfirmed bills", () => {
    const issues = buildHostingCostSourceIssues(
      "2026-11-17",
      [
        {
          date: "2026-09-30",
          amount: 100,
          hostingAmount: 100,
          processingAmount: 0,
          invoiceNumber: "INV1",
          classification: "unverified",
        },
        {
          date: "2026-05-21",
          amount: 50,
          hostingAmount: 0,
          processingAmount: 50,
          invoiceNumber: "INV2",
          classification: "processing",
        },
      ],
      "2026-09",
    );
    expect(issues.map((issue) => issue.code)).toEqual([
      "IVION_INVOICES_NOT_LOADED",
      "UNCLASSIFIED_NAVVIS_BILLS",
    ]);
    expect(issues[0].message).toContain("Sep 2026");
    expect(issues[1].evidence[1].value).toBe("INV1 (2026-09-30)");
  });

  it("raises nothing while the loaded bills cover the current month", () => {
    expect(buildHostingCostSourceIssues("2026-09-15", [], "2026-09")).toEqual([]);
  });
});
