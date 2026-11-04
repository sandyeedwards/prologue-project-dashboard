import { describe, expect, it } from "vitest";
import { hostingPeriodStatus } from "./period-status";

import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_MONTHLY_OVERHEAD,
  benacoBillCostPerActivePano,
  benacoPanoBasis,
  benacoTourPanoCost,
  buildHostingReport,
  filterHostingDeals,
  hostingDealTermSummary,
  isHostingDealActiveOn,
  isHostingTermExpired,
  type HostingDealRow,
  type HostingIvionSite,
} from "./reporting";
import {
  BENACO_BILLING_HISTORY,
  BENACO_PREVIOUSLY_PAID,
  BENACO_CATCH_UP_PAYMENT,
} from "./benaco-billing-history";

function deal(overrides: Partial<HostingDealRow> = {}): HostingDealRow {
  return {
    id: "deal-1",
    hubspot_deal_id: "101",
    deal_name: "Example",
    site_name: "Example Site",
    hubspot_url: null,
    ivion_instance: null,
    ivion_hosting_start: null,
    ivion_hosting_end: null,
    ivion_contracted_fee: null,
    ivion_total_panos: null,
    ivion_active_panos: null,
    ivion_comp_start: null,
    ivion_comp_end: null,
    ivion_calculated_quarterly_fee: null,
    ivion_contracted_quarterly_fee: null,
    ivion_date_added: null,
    ivion_date_sent_to_client: null,
    ivion_bundle_archive_date: null,
    benaco_hosting_start: null,
    benaco_hosting_end: null,
    benaco_contracted_fee: null,
    benaco_total_panos: null,
    benaco_counted_grid_panos: null,
    benaco_comp_start: null,
    benaco_comp_end: null,
    benaco_url: null,
    benaco_calculated_cost: null,
    benaco_annual_fee: null,
    hosting_notes: null,
    hosting_communications_contact: null,
    ...overrides,
  };
}

function site(overrides: Partial<HostingIvionSite> = {}): HostingIvionSite {
  return {
    id: "site-1",
    label: "Prologue 1",
    url: "https://example.iv.navvis.com/",
    started_on: "2025-01-01",
    ended_on: null,
    is_active: true,
    sort_order: 10,
    cost_history: [{ effective_on: "2025-01-01", annual_cost: 1200 }],
    ...overrides,
  };
}

describe("buildHostingReport", () => {
  it("keeps exact custom date cutoffs when changing chart groupings", () => {
    const deals = [
      deal({ id: "before", ivion_hosting_start: "2026-01-08", ivion_contracted_fee: 9000 }),
      deal({ id: "within", benaco_hosting_start: "2026-02-05", benaco_contracted_fee: 1000 }),
      deal({ id: "after", ivion_hosting_start: "2026-05-22", ivion_contracted_fee: 8000 }),
    ];
    const totals = (["month", "quarter", "half", "year"] as const).map((grouping) => {
      const rows = buildHostingReport(
        deals,
        grouping,
        [],
        new Date("2026-11-03T12:00:00Z"),
        "custom",
        { from: "2026-01-09", to: "2026-05-21" },
        [],
        false,
      );
      expect(rows[0].periodStart).toBe("2026-01-09");
      expect(rows.at(-1)?.periodEnd).toBe("2026-05-21");
      return rows.reduce(
        (sum, row) => ({
          revenue: sum.revenue + row.revenue,
          ivion: sum.ivion + row.ivionCost,
          overhead: sum.overhead + row.benacoOverhead,
        }),
        { revenue: 0, ivion: 0, overhead: 0 },
      );
    });
    for (const total of totals) expect(total).toEqual({ revenue: 1000, ivion: 0, overhead: 400 });
  });

  it("keeps monthly bills as reconciliation evidence without adding the tour charges again", () => {
    const bills = [
      {
        id: "march",
        billing_month: "2026-03-01",
        billed_amount: 500,
        active_panos: 1000,
        notes: null,
        created_at: "2026-04-01",
        updated_at: "2026-04-01",
      },
      {
        id: "april",
        billing_month: "2026-04-01",
        billed_amount: 250,
        active_panos: 1000,
        notes: null,
        created_at: "2026-05-01",
        updated_at: "2026-05-01",
      },
    ];
    for (const grouping of ["month", "quarter", "half", "year"] as const) {
      const rows = buildHostingReport(
        [],
        grouping,
        [],
        new Date("2026-11-03T12:00:00Z"),
        "custom",
        { from: "2026-03-15", to: "2026-04-15" },
        bills,
        false,
      );
      const baseline = buildHostingReport(
        [],
        grouping,
        [],
        new Date("2026-11-03T12:00:00Z"),
        "custom",
        { from: "2026-03-15", to: "2026-04-15" },
        [],
        false,
      );
      expect(rows.reduce((sum, row) => sum + row.benacoCost, 0)).toBe(
        baseline.reduce((sum, row) => sum + row.benacoCost, 0),
      );
      expect(rows.reduce((sum, row) => sum + row.benacoOverhead, 0)).toBe(100);
      expect(rows.reduce((sum, row) => sum + row.benacoBilledMonths, 0)).toBe(1);
    }
  });

  it("does not count a catch-up payment again after assigning charges to tours", () => {
    for (const grouping of ["month", "quarter", "half", "year"] as const) {
      const rows = buildHostingReport(
        [],
        grouping,
        [],
        new Date("2026-11-03T12:00:00Z"),
        "custom",
        { from: "2026-08-31", to: "2026-08-31" },
        [],
        false,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].benacoHistoricalCost).toBe(0);
      expect(rows[0].benacoOverhead).toBe(0);
    }
  });

  it("keeps rolling twelve-month dates and actual totals independent of grouping", () => {
    const deals = [
      deal({ id: "outside", ivion_hosting_start: "2025-11-15", ivion_contracted_fee: 9000 }),
      deal({ id: "inside", ivion_hosting_start: "2025-12-01", ivion_contracted_fee: 1200 }),
    ];
    const totals = (["month", "quarter", "half", "year"] as const).map((grouping) => {
      const rows = buildHostingReport(
        deals,
        grouping,
        [],
        new Date("2026-11-03T12:00:00Z"),
        "12m",
        {},
        [],
        false,
      );
      expect(rows[0].periodStart).toBe("2025-12-01");
      expect(rows.at(-1)?.periodEnd).toBe("2026-11-03");
      return rows.reduce(
        (sum, row) => ({ revenue: sum.revenue + row.revenue, costs: sum.costs + row.costs }),
        { revenue: 0, costs: 0 },
      );
    });
    expect(totals[0].revenue).toBe(1200);
    for (const total of totals) expect(total).toEqual(totals[0]);
  });

  it("counts only 2024-onward invoices in historical IVION costs and keeps rates in the forecast", () => {
    const sites = [16185, 16185, 10905, 11985].map((annual_cost, index) =>
      site({
        id: `instance-${index}`,
        cost_history: [{ effective_on: "2023-01-01", annual_cost }],
        started_on: "2023-01-01",
      }),
    );
    const deals = [
      deal({ id: "old", ivion_hosting_start: "2023-06-01", ivion_contracted_fee: 50000 }),
      deal({ id: "new", ivion_hosting_start: "2024-01-01", ivion_contracted_fee: 1000 }),
    ];
    const reference = new Date("2026-11-02T12:00:00Z");
    for (const grouping of ["month", "quarter", "year"] as const) {
      const actual = buildHostingReport(deals, grouping, sites, reference, "all", {}, [], false);
      expect(actual[0].periodStart).toBe("2024-01-01");
      expect(actual.reduce((sum, row) => sum + row.ivionRevenue, 0)).toBe(1000);
      expect(actual.reduce((sum, row) => sum + row.ivionCost, 0)).toBeCloseTo(147398.57, 2);
      expect(actual.reduce((sum, row) => sum + (row.ivionEstimatedCost ?? 0), 0)).toBe(0);
    }
    const projected = buildHostingReport(deals, "month", sites, reference, "all", {}, [], true);
    expect(projected.find((row) => row.period === "2026-10")?.ivionCost).toBe(0);
    expect(projected.find((row) => row.period === "2026-11")?.ivionCost).toBe(0);
    expect(projected.find((row) => row.period === "2026-12")?.ivionEstimatedCost).toBe(4605);
  });

  it("reconciles actual monthly, quarterly, and annual totals through the same day", () => {
    const deals = [
      deal({ ivion_hosting_start: "2026-01-01", ivion_contracted_fee: 1200 }),
      deal({
        id: "future",
        ivion_hosting_start: "2026-11-20",
        ivion_contracted_fee: 9000,
        benaco_hosting_start: "2026-12-01",
        benaco_hosting_end: "2027-12-01",
        benaco_counted_grid_panos: 1000,
        benaco_contracted_fee: 500,
      }),
    ];
    const reports = (["month", "quarter", "year"] as const).map((grouping) =>
      buildHostingReport(
        deals,
        grouping,
        [site()],
        new Date("2026-11-02T12:00:00Z"),
        "ytd",
        {},
        [],
        false,
      ),
    );
    const totals = reports.map((rows) =>
      rows.reduce(
        (sum, row) => ({ revenue: sum.revenue + row.revenue, cost: sum.cost + row.costs }),
        { revenue: 0, cost: 0 },
      ),
    );
    expect(totals[0].revenue).toBe(1200);
    expect(totals[1]).toEqual(totals[0]);
    expect(totals[2]).toEqual(totals[0]);
    for (const rows of reports) {
      expect(rows.at(-1)?.periodEnd).toBe("2026-11-02");
      expect(rows.every((row) => !row.forecast)).toBe(true);
      expect(hostingPeriodStatus(rows.at(-1)!, "ivion")).toBe("Recorded");
    }
    const forecast = buildHostingReport(
      deals,
      "year",
      [site()],
      new Date("2026-11-02T12:00:00Z"),
      "ytd",
      {},
      [],
      true,
    );
    expect(forecast[0].revenue).toBe(10700);
    expect(hostingPeriodStatus(forecast[0], "ivion")).toBe("Includes forecast");
  });

  it("excludes invoices dated after the reporting day", () => {
    const september = buildHostingReport(
      [],
      "month",
      [],
      new Date("2026-09-15T12:00:00Z"),
      "ytd",
      {},
      [],
      false,
    );
    expect(september.at(-1)?.ivionCost).toBe(0);
    const august = buildHostingReport(
      [],
      "month",
      [],
      new Date("2026-08-15T12:00:00Z"),
      "ytd",
      {},
      [],
      false,
    );
    expect(august.at(-1)?.benacoHistoricalCost).toBe(0);
  });

  it("costs unmatched existing and new tours without a blanket date-based exemption", () => {
    const report = buildHostingReport(
      [
        deal({
          id: "existing-2025",
          hubspot_deal_id: "existing-2025",
          benaco_hosting_start: "2025-01-01",
          benaco_hosting_end: "2028-01-01",
          benaco_counted_grid_panos: 1000,
        }),
        deal({
          id: "existing-2026",
          hubspot_deal_id: "existing-2026",
          benaco_hosting_start: "2026-06-01",
          benaco_hosting_end: "2028-06-01",
          benaco_counted_grid_panos: 2000,
        }),
        deal({
          id: "new-tour",
          hubspot_deal_id: "new-tour",
          benaco_hosting_start: "2026-11-01",
          benaco_hosting_end: "2027-11-01",
          benaco_counted_grid_panos: 500,
        }),
      ],
      "month",
      [],
      new Date("2026-12-15T12:00:00Z"),
      "all",
      {},
      [
        {
          id: "regular-august",
          billing_month: "2026-08-01",
          billed_amount: 100,
          active_panos: 3000,
          notes: null,
          created_at: "2026-08-31",
          updated_at: "2026-08-31",
        },
      ],
    );
    expect(report.reduce((sum, row) => sum + row.benacoHistoricalCost, 0)).toBe(0);
    expect(report.find((row) => row.period === "2026-08")?.benacoCost).toBeCloseTo(100, 2);
    expect(report.find((row) => row.period === "2025-01")?.benacoPanoCosts).toBe(1140);
    expect(report.find((row) => row.period === "2026-06")?.benacoPanoCosts).toBeCloseTo(
      (2000 * 0.38 * 731) / 365,
      8,
    );
    expect(report.find((row) => row.period === "2026-11")?.benacoPanoCosts).toBeCloseTo(190, 2);
    expect(report.find((row) => row.period === "2026-12")?.benacoCost).toBe(100);
  });

  it("uses historical invoices without adding configured instance costs", () => {
    const report = buildHostingReport(
      [],
      "year",
      [site()],
      new Date("2026-10-30T12:00:00Z"),
      "custom",
      { from: "2024-01-01", to: "2026-09-30" },
    );
    expect(report[0].ivionCost).toBeCloseTo(53226.83, 2);
    expect(report[1].ivionCost).toBeCloseTo(31296.74, 2);
  });

  it("does not add instance estimates to recorded invoices after coverage ends", () => {
    const report = buildHostingReport(
      [],
      "month",
      [site()],
      new Date("2026-10-30T12:00:00Z"),
      "custom",
      { from: "2026-09-01", to: "2026-10-31" },
    );
    expect(report.map((row) => row.ivionCost)).toEqual([10555, 0]);
  });
  it("shows the blended invoice amount per pano without using it as the tour hosting rate", () => {
    expect(benacoBillCostPerActivePano(1000, 4000)).toBe(0.25);
  });

  it("records the full client payment in the hosting-start month", () => {
    const report = buildHostingReport(
      [
        deal({
          ivion_hosting_start: "2026-01-01",
          ivion_hosting_end: "2027-01-01",
          ivion_contracted_fee: 1200,
        }),
      ],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
    );

    const revenueRows = report.filter((row) => row.ivionRevenue > 0);
    expect(revenueRows).toHaveLength(1);
    expect(revenueRows[0]).toMatchObject({ period: "2026-01", ivionRevenue: 1200 });
  });

  it("records the full Benaco tour pano cost at start plus monthly company overhead", () => {
    const report = buildHostingReport(
      [
        deal({
          benaco_hosting_start: "2026-06-10",
          benaco_hosting_end: "2026-09-10",
          benaco_contracted_fee: 900,
          ivion_total_panos: 100,
          benaco_total_panos: 400,
          benaco_counted_grid_panos: 112,
        }),
      ],
      "month",
      [site()],
      new Date("2026-06-15T12:00:00.000Z"),
    );

    const june = report.find((row) => row.period === "2026-06");
    expect(june).toMatchObject({
      ivionCost: 3960,
      benacoOverhead: BENACO_MONTHLY_OVERHEAD,
    });
    expect(june?.benacoRevenue).toBe(900);
    expect(june?.benacoPanoCosts).toBeCloseTo(112 * (BENACO_ANNUAL_PANO_COST / 365) * 92, 8);
    expect(june?.benacoEstimatedPanoCosts).toBeCloseTo(june?.benacoPanoCosts ?? 0, 8);
    expect(report.find((row) => row.period === "2026-07")?.benacoPanoCosts).toBe(0);
    expect(report.find((row) => row.period === "2026-07")?.benacoOverhead).toBe(
      BENACO_MONTHLY_OVERHEAD,
    );
  });

  it("keeps client payments in the hosting-start period across report groupings", () => {
    const hostingDeal = deal({
      benaco_hosting_start: "2026-01-15",
      benaco_hosting_end: "2027-01-15",
      benaco_contracted_fee: 1200,
    });
    const options = {
      from: "2026-01-01",
      to: "2027-01-31",
    };
    const monthly = buildHostingReport(
      [hostingDeal],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      options,
    );
    const quarterly = buildHostingReport(
      [hostingDeal],
      "quarter",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      options,
    );

    expect(monthly.filter((row) => row.benacoRevenue > 0)).toEqual([
      expect.objectContaining({ period: "2026-01", benacoRevenue: 1200 }),
    ]);
    expect(quarterly.filter((row) => row.benacoRevenue > 0)).toEqual([
      expect.objectContaining({ period: "2026 Q1", benacoRevenue: 1200 }),
    ]);
  });

  it("records a multi-year Benaco contract as one payment at term start", () => {
    const report = buildHostingReport(
      [
        deal({
          benaco_hosting_start: "2025-01-01",
          benaco_hosting_end: "2028-01-01",
          benaco_contracted_fee: 21600,
        }),
      ],
      "year",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      { from: "2025-01-01", to: "2027-12-31" },
    );

    expect(report.map((row) => row.benacoRevenue)).toEqual([21600, 0, 0]);
  });

  it("marks missing grid counts instead of guessing 28 percent of total panos", () => {
    const estimatedDeal = deal({
      benaco_hosting_start: "2026-06-01",
      benaco_hosting_end: "2026-07-01",
      benaco_total_panos: 1000,
    });

    expect(benacoPanoBasis(estimatedDeal)).toEqual({ count: 0, source: "missing" });

    const june = buildHostingReport(
      [estimatedDeal],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
    ).find((row) => row.period === "2026-06");

    expect(june?.benacoPanoCosts).toBe(0);
    expect(june?.benacoEstimatedPanoCosts).toBeCloseTo(june?.benacoPanoCosts ?? 0, 8);
  });

  it("uses HubSpot Counted Grid-Pano instead of the planning estimate", () => {
    const countedDeal = deal({
      benaco_total_panos: 1000,
      benaco_counted_grid_panos: 315,
    });

    expect(benacoPanoBasis(countedDeal)).toEqual({ count: 315, source: "actual" });
  });

  it("calculates the full tour cost from counted panos and the complete term", () => {
    const hostingDeal = deal({
      benaco_hosting_start: "2026-01-01",
      benaco_hosting_end: "2028-01-01",
      benaco_counted_grid_panos: 1000,
    });

    expect(benacoTourPanoCost(hostingDeal)).toBeCloseTo(
      1000 * (BENACO_ANNUAL_PANO_COST / 365) * 730,
      8,
    );
  });

  it("reconciles prior and catch-up payments to the same historical tour charges", () => {
    expect(BENACO_PREVIOUSLY_PAID + BENACO_CATCH_UP_PAYMENT).toBeCloseTo(10859.75, 2);
    expect(BENACO_BILLING_HISTORY.reduce((sum, record) => sum + record.panoCost, 0)).toBeCloseTo(
      10859.75,
      2,
    );

    const report = buildHostingReport(
      [],
      "year",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      { from: "2024-01-01", to: "2026-12-31" },
    );

    const year2024 = report.find((row) => row.period === "2024");
    expect(year2024?.benacoHistoricalCost).toBe(0);
    expect(year2024?.benacoOverhead).toBe(BENACO_MONTHLY_OVERHEAD * 12);
    const year2026 = report.find((row) => row.period === "2026");
    expect(year2026?.benacoHistoricalCost).toBe(0);
    expect(report.reduce((sum, row) => sum + row.benacoBilledCost, 0)).toBeCloseTo(9961.59, 2);
  });

  it("requires a billing match instead of waiving all tours that started in 2024", () => {
    const report = buildHostingReport(
      [
        deal({
          benaco_hosting_start: "2024-04-01",
          benaco_hosting_end: "2025-04-01",
          benaco_counted_grid_panos: 2000,
        }),
      ],
      "year",
      [],
      new Date("2026-10-01T12:00:00.000Z"),
      "custom",
      { from: "2024-01-01", to: "2026-12-31" },
    );

    expect(report.find((row) => row.period === "2024")?.benacoPanoCosts).toBe(760);
    expect(report.find((row) => row.period === "2026")?.benacoHistoricalCost).toBe(0);
  });

  it("excludes 2023 while retaining the Benaco subscription overhead from 2024 onward", () => {
    const report = buildHostingReport([], "month", [], new Date("2024-02-15T12:00:00.000Z"), "all");

    expect(report.some((row) => row.period.startsWith("2023-"))).toBe(false);
    expect(report.find((row) => row.period === "2024-01")?.benacoOverhead).toBe(
      BENACO_MONTHLY_OVERHEAD,
    );
  });

  it("retains monthly bill evidence while counting the subscription and tour charges once", () => {
    const report = buildHostingReport(
      [
        deal({
          benaco_hosting_start: "2026-06-01",
          benaco_hosting_end: "2026-07-01",
          benaco_total_panos: 1000,
        }),
      ],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "12m",
      {},
      [
        {
          id: "bill-1",
          billing_month: "2026-06-01",
          billed_amount: 875.5,
          active_panos: 3500,
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
    );

    const june = report.find((row) => row.period === "2026-06");
    expect(june).toMatchObject({
      benacoBilledCost: 19.89,
      benacoEstimatedCost: 100,
      benacoBilledMonths: 1,
      benacoEstimatedMonths: 0,
      benacoCost: 119.89,
    });
  });

  it("retains three subscription months when a monthly bill is entered", () => {
    const report = buildHostingReport(
      [],
      "quarter",
      [],
      new Date("2026-03-15T12:00:00.000Z"),
      "custom",
      { from: "2026-01-01", to: "2026-03-31" },
      [
        {
          id: "bill-1",
          billing_month: "2026-02-01",
          billed_amount: 500,
          active_panos: 2000,
          notes: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    );

    expect(report[0]).toMatchObject({
      benacoEstimatedCost: BENACO_MONTHLY_OVERHEAD * 3,
      benacoBilledMonths: 1,
      benacoEstimatedMonths: 2,
    });
  });

  it("limits all-history reporting to 2024 and later", () => {
    const report = buildHostingReport(
      [
        deal({
          ivion_hosting_start: "2020-01-15",
          ivion_hosting_end: "2024-01-15",
          ivion_contracted_fee: 300,
        }),
      ],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "all",
    );

    expect(report[0]?.period).toBe("2024-01");
  });

  it("excludes 2023 client revenue and Benaco bills from all-history totals", () => {
    const report = buildHostingReport(
      [
        deal({
          id: "2023-deal",
          hubspot_deal_id: "2023-deal",
          ivion_hosting_start: "2023-06-01",
          ivion_hosting_end: "2023-07-01",
          ivion_contracted_fee: 16000,
        }),
        deal({
          id: "2024-deal",
          hubspot_deal_id: "2024-deal",
          ivion_hosting_start: "2024-02-01",
          ivion_hosting_end: "2024-03-01",
          ivion_contracted_fee: 500,
        }),
      ],
      "month",
      [],
      new Date("2024-06-15T12:00:00.000Z"),
      "all",
      {},
      [
        {
          id: "2023-bill",
          billing_month: "2023-12-01",
          billed_amount: 900,
          active_panos: 1000,
          notes: null,
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    );

    expect(report.some((row) => row.period.startsWith("2023-"))).toBe(false);
    expect(report.reduce((sum, row) => sum + row.revenue, 0)).toBe(500);
    expect(report.reduce((sum, row) => sum + row.benacoBilledCost, 0)).toBeCloseTo(2347.14, 2);
  });

  it("returns no periods when a custom reporting range ends before 2024", () => {
    const report = buildHostingReport(
      [],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      { from: "2020-01-01", to: "2023-03-31" },
    );

    expect(report).toEqual([]);
  });

  it("does not extend all available history before 2024 for IVION hosting records", () => {
    const report = buildHostingReport(
      [
        deal({
          ivion_hosting_start: "2020-01-15",
          ivion_hosting_end: "2020-04-15",
          ivion_contracted_fee: 300,
        }),
      ],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "all",
    );

    expect(report[0]?.period).toBe("2024-01");
  });

  it("does not extend all available history before 2024 for IVION cost records", () => {
    const report = buildHostingReport(
      [],
      "month",
      [
        site({
          started_on: null,
          cost_history: [{ effective_on: "2019-07-01", annual_cost: 900 }],
        }),
      ],
      new Date("2026-06-15T12:00:00.000Z"),
      "all",
    );

    expect(report[0]?.period).toBe("2024-01");
  });

  it("uses complimentary dates for active status without creating revenue", () => {
    const complimentary = deal({
      ivion_comp_start: "2026-06-01",
      ivion_comp_end: "2026-06-30",
    });
    const report = buildHostingReport(
      [complimentary],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
    );

    expect(isHostingDealActiveOn(complimentary, new Date("2026-06-15T12:00:00.000Z"))).toBe(true);
    expect(report.find((row) => row.period === "2026-06")?.revenue).toBe(0);
  });

  it("checks active status for the selected hosting platform", () => {
    const mixedPlatformDeal = deal({
      ivion_hosting_start: "2026-01-01",
      ivion_hosting_end: "2026-12-31",
      benaco_hosting_start: "2025-01-01",
      benaco_hosting_end: "2025-12-31",
    });
    const target = new Date("2026-06-15T12:00:00.000Z");

    expect(isHostingDealActiveOn(mixedPlatformDeal, target)).toBe(true);
    expect(isHostingDealActiveOn(mixedPlatformDeal, target, "ivion")).toBe(true);
    expect(isHostingDealActiveOn(mixedPlatformDeal, target, "benaco")).toBe(false);
  });

  it("never subtracts complimentary hosting from paid hosting revenue", () => {
    const report = buildHostingReport(
      [
        deal({
          id: "paid",
          ivion_hosting_start: "2026-06-01",
          ivion_hosting_end: "2026-07-01",
          ivion_contracted_fee: 600,
        }),
        deal({
          id: "complimentary",
          ivion_comp_start: "2026-06-01",
          ivion_comp_end: "2026-06-30",
        }),
      ],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
    );
    const june = report.find((row) => row.period === "2026-06");

    expect(june?.revenue).toBe(600);
    expect(june?.netProfit).toBeCloseTo((june?.revenue ?? 0) - (june?.costs ?? 0), 8);
  });

  it("uses a complimentary term when a paid term is unavailable", () => {
    const summary = hostingDealTermSummary(
      deal({ ivion_comp_start: "2026-06-01", ivion_comp_end: "2026-12-01" }),
      "ivion",
      new Date("2026-09-30T12:00:00.000Z"),
    );

    expect(summary).toEqual({
      start: "2026-06-01",
      end: "2026-12-01",
      kind: "complimentary",
      expired: false,
    });
  });

  it("marks the latest ended hosting term as expired", () => {
    const summary = hostingDealTermSummary(
      deal({ ivion_comp_start: "2026-03-19", ivion_comp_end: "2026-06-19" }),
      "combined",
      new Date("2026-09-30T12:00:00.000Z"),
    );

    expect(summary?.expired).toBe(true);
    expect(summary?.kind).toBe("complimentary");
    expect(isHostingTermExpired("2026-07-02", new Date("2026-09-30T12:00:00.000Z"))).toBe(true);
  });

  it("prefers a current complimentary term over an expired paid term", () => {
    const summary = hostingDealTermSummary(
      deal({
        ivion_hosting_start: "2025-01-01",
        ivion_hosting_end: "2026-01-01",
        ivion_comp_start: "2026-09-01",
        ivion_comp_end: "2026-12-01",
      }),
      "ivion",
      new Date("2026-09-30T12:00:00.000Z"),
    );

    expect(summary?.kind).toBe("complimentary");
    expect(summary?.expired).toBe(false);
  });
});

describe("filterHostingDeals", () => {
  const target = new Date("2026-10-20T12:00:00.000Z");
  const deals = [
    deal({
      id: "ivion-active",
      hubspot_deal_id: "25-195",
      deal_name: "10 Calycanthus Road - 3N",
      site_name: "10 Calycanthus Road",
      ivion_instance: "https://example.iv.navvis.com",
      ivion_hosting_start: "2026-01-01",
      ivion_hosting_end: "2027-01-01",
      ivion_contracted_fee: 600,
    }),
    deal({
      id: "benaco-expired",
      hubspot_deal_id: "26-113",
      deal_name: "1 Evelyn Place, Asheville NC",
      site_name: "1 Evelyn Place",
      benaco_url: "https://benaco.example/tour",
      benaco_hosting_start: "2025-01-01",
      benaco_hosting_end: "2026-01-01",
      benaco_contracted_fee: 0,
    }),
  ];

  it("searches deal names, site names, and HubSpot IDs", () => {
    expect(filterHostingDeals(deals, { query: "calycanthus", target })).toHaveLength(1);
    expect(filterHostingDeals(deals, { query: "26-113", target })[0]?.id).toBe("benaco-expired");
  });

  it("combines platform, term, and fee filters", () => {
    expect(
      filterHostingDeals(deals, {
        platform: "ivion",
        term: "current",
        fee: "with-fee",
        target,
      }).map((row) => row.id),
    ).toEqual(["ivion-active"]);

    expect(
      filterHostingDeals(deals, {
        platform: "benaco",
        term: "expired",
        fee: "no-fee",
        target,
      }).map((row) => row.id),
    ).toEqual(["benaco-expired"]);
  });
});
