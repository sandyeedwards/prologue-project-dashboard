import { describe, expect, it } from "vitest";

import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_2024_CATCH_UP_INVOICE_DATE,
  BENACO_2024_CATCH_UP_TOTAL,
  BENACO_MONTHLY_OVERHEAD,
  allocateBenacoTourCost,
  benacoBillCostPerActivePano,
  benacoHistoricalCatchUpCost,
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
  it("allocates a monthly Benaco bill proportionally by active panos", () => {
    expect(benacoBillCostPerActivePano(1000, 4000)).toBe(0.25);
    expect(allocateBenacoTourCost(600, 1000, 4000)).toBe(150);
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
        }),
      ],
      "month",
      [site()],
      new Date("2026-06-15T12:00:00.000Z"),
    );

    const june = report.find((row) => row.period === "2026-06");
    expect(june).toMatchObject({
      ivionCost: 100,
      benacoOverhead: BENACO_MONTHLY_OVERHEAD,
    });
    expect(june?.benacoRevenue).toBe(900);
    expect(june?.benacoPanoCosts).toBeCloseTo(400 * 0.28 * (BENACO_ANNUAL_PANO_COST / 365) * 92, 8);
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

  it("uses the 28 percent planning estimate only when counted panos are missing", () => {
    const estimatedDeal = deal({
      benaco_hosting_start: "2026-06-01",
      benaco_hosting_end: "2026-07-01",
      benaco_total_panos: 1000,
    });

    expect(benacoPanoBasis(estimatedDeal)).toEqual({ count: 280, source: "estimated" });

    const june = buildHostingReport(
      [estimatedDeal],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
    ).find((row) => row.period === "2026-06");

    expect(june?.benacoPanoCosts).toBeCloseTo(280 * (BENACO_ANNUAL_PANO_COST / 365) * 30, 8);
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

  it("records the one-time catch-up invoice in its invoice month without recurring", () => {
    const catchUpMonth = BENACO_2024_CATCH_UP_INVOICE_DATE.slice(0, 7);
    expect(benacoHistoricalCatchUpCost("2024-01")).toBe(0);
    expect(benacoHistoricalCatchUpCost(catchUpMonth)).toBe(BENACO_2024_CATCH_UP_TOTAL);
    expect(benacoHistoricalCatchUpCost("2026-09")).toBe(0);

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
    expect(year2026?.benacoHistoricalCost).toBe(BENACO_2024_CATCH_UP_TOTAL);
    expect(year2026?.benacoCost).toBeCloseTo(
      BENACO_2024_CATCH_UP_TOTAL + BENACO_MONTHLY_OVERHEAD * 12,
      8,
    );
  });

  it("does not double count calculated costs for 2024 tours covered by the catch-up invoice", () => {
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

    expect(report.find((row) => row.period === "2024")?.benacoPanoCosts).toBe(0);
    expect(report.find((row) => row.period === "2026")?.benacoHistoricalCost).toBe(
      BENACO_2024_CATCH_UP_TOTAL,
    );
  });

  it("excludes 2023 while retaining the Benaco subscription overhead from 2024 onward", () => {
    const report = buildHostingReport([], "month", [], new Date("2024-02-15T12:00:00.000Z"), "all");

    expect(report.some((row) => row.period.startsWith("2023-"))).toBe(false);
    expect(report.find((row) => row.period === "2024-01")?.benacoOverhead).toBe(
      BENACO_MONTHLY_OVERHEAD,
    );
  });

  it("uses an entered Benaco bill as the full cost for that month", () => {
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
      benacoBilledCost: 875.5,
      benacoEstimatedCost: 0,
      benacoBilledMonths: 1,
      benacoEstimatedMonths: 0,
      benacoCost: 875.5,
    });
  });

  it("combines actual bills with estimates for uncovered months in a quarter", () => {
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
      benacoBilledCost: 500,
      benacoEstimatedCost: BENACO_MONTHLY_OVERHEAD * 2,
      benacoBilledMonths: 1,
      benacoEstimatedMonths: 2,
      benacoCost: 500 + BENACO_MONTHLY_OVERHEAD * 2,
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
    expect(report.reduce((sum, row) => sum + row.benacoBilledCost, 0)).toBe(0);
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
