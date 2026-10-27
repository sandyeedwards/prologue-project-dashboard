import { describe, expect, it } from "vitest";

import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_2024_CATCH_UP_TOTAL,
  BENACO_MONTHLY_OVERHEAD,
  allocateBenacoTourCost,
  benacoBillCostPerActivePano,
  benacoHistoricalCatchUpCost,
  benacoPanoBasis,
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

  it("recognizes term revenue by active day without a thirteenth month", () => {
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
    expect(revenueRows).toHaveLength(12);
    expect(revenueRows.reduce((sum, row) => sum + row.ivionRevenue, 0)).toBeCloseTo(1200, 8);
    expect(revenueRows[0].ivionRevenue).toBeCloseTo(1200 * (31 / 365), 8);
  });

  it("accrues estimated Benaco active-pano cost by active day plus one company overhead", () => {
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
    expect(june?.benacoRevenue).toBeCloseTo(900 * (21 / 92), 8);
    expect(june?.benacoPanoCosts).toBeCloseTo(400 * 0.28 * (BENACO_ANNUAL_PANO_COST / 365) * 21, 8);
    expect(june?.benacoEstimatedPanoCosts).toBeCloseTo(june?.benacoPanoCosts ?? 0, 8);
  });

  it("keeps recognized revenue consistent across report groupings", () => {
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

    expect(monthly.reduce((sum, row) => sum + row.benacoRevenue, 0)).toBeCloseTo(1200, 8);
    expect(quarterly.reduce((sum, row) => sum + row.benacoRevenue, 0)).toBeCloseTo(1200, 8);
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

  it("spreads the one-time catch-up invoice across 2024 without recurring", () => {
    expect(benacoHistoricalCatchUpCost("2024-01")).toBe(705.56);
    expect(benacoHistoricalCatchUpCost("2024-12")).toBe(705.55);
    expect(benacoHistoricalCatchUpCost("2025-01")).toBe(0);

    const report = buildHostingReport(
      [],
      "year",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      { from: "2024-01-01", to: "2025-12-31" },
    );

    const year2024 = report.find((row) => row.period === "2024");
    expect(year2024?.benacoHistoricalCost).toBeCloseTo(BENACO_2024_CATCH_UP_TOTAL, 8);
    expect(year2024?.benacoOverhead).toBe(BENACO_MONTHLY_OVERHEAD * 12);
    expect(year2024?.benacoCost).toBeCloseTo(
      BENACO_2024_CATCH_UP_TOTAL + BENACO_MONTHLY_OVERHEAD * 12,
      8,
    );
    expect(report.find((row) => row.period === "2025")?.benacoHistoricalCost).toBe(0);
  });

  it("starts the single Benaco subscription overhead in September 2023", () => {
    const report = buildHostingReport([], "month", [], new Date("2023-10-15T12:00:00.000Z"), "all");

    expect(report.find((row) => row.period === "2023-09")?.benacoOverhead).toBe(
      BENACO_MONTHLY_OVERHEAD,
    );
    expect(report.find((row) => row.period === "2023-10")?.benacoOverhead).toBe(
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

  it("limits all-history reporting to 2023 and later", () => {
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

    expect(report[0]?.period).toBe("2023-01");
  });

  it("limits custom reporting ranges to 2023 and later", () => {
    const report = buildHostingReport(
      [],
      "month",
      [],
      new Date("2026-06-15T12:00:00.000Z"),
      "custom",
      { from: "2020-01-01", to: "2023-03-31" },
    );

    expect(report[0]?.period).toBe("2023-01");
    expect(report.at(-1)?.period).toBe("2023-03");
  });

  it("does not extend all available history before 2023 for IVION hosting records", () => {
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

    expect(report[0]?.period).toBe("2023-01");
  });

  it("does not extend all available history before 2023 for IVION cost records", () => {
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

    expect(report[0]?.period).toBe("2023-01");
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
