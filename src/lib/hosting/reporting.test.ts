import { describe, expect, it } from "vitest";

import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_MONTHLY_OVERHEAD,
  benacoPanoBasis,
  buildHostingReport,
  isHostingDealActiveOn,
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
  it("spreads paid term revenue across touched periods without a thirteenth month", () => {
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
    expect(revenueRows.every((row) => row.ivionRevenue === 100)).toBe(true);
  });

  it("accrues Benaco counted-pano cost by active day plus one company overhead", () => {
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
      benacoRevenue: 225,
      benacoOverhead: BENACO_MONTHLY_OVERHEAD,
    });
    expect(june?.benacoPanoCosts).toBeCloseTo(100 * (BENACO_ANNUAL_PANO_COST / 365) * 21, 8);
    expect(june?.benacoEstimatedPanoCosts).toBe(0);
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

  it("starts the single Benaco subscription overhead in September 2023", () => {
    const report = buildHostingReport([], "month", [], new Date("2023-10-15T12:00:00.000Z"), "all");

    expect(report.find((row) => row.period === "2023-09")?.benacoOverhead).toBe(100);
    expect(report.find((row) => row.period === "2023-10")?.benacoOverhead).toBe(100);
  });

  it("extends all available history to the earliest IVION hosting record", () => {
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

    expect(report[0]?.period).toBe("2020-01");
  });

  it("extends all available history to the earliest IVION cost record", () => {
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

    expect(report[0]?.period).toBe("2019-07");
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
});
