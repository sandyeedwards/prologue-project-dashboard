import { describe, expect, it } from "vitest";
import { UNNAMED_CLIENT, hostingClientEconomics, hostingClientName } from "./client-economics";
import { ivionInvoiceCostBetween } from "./ivion-invoice-history";
import type { HostingDealRow } from "./reporting";

const deal = (fields: Partial<HostingDealRow>): HostingDealRow =>
  ({
    id: "d",
    hubspot_deal_id: "1",
    deal_name: null,
    hosting_communications_contact: null,
    ...fields,
  }) as HostingDealRow;
const url = (id: string) => `https://benaco.com/view/${id}-1234-4567-89ab-123456789abc`;
const today = new Date("2026-11-25T17:00:00Z");
// NavVis hosting bills Jan 2025 - Sep 2026 (21 months), averaged per month.
const monthlyBill =
  ivionInvoiceCostBetween(new Date("2025-01-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z")) / 21;

describe("hostingClientName", () => {
  it("uses the last part of the deal name and merges known spellings", () => {
    expect(hostingClientName(deal({ deal_name: "26-140 - 1001 West Avenue - 3N" }))).toBe("3North");
    expect(hostingClientName(deal({ deal_name: "25-001 - Site - 3north" }))).toBe("3North");
    expect(hostingClientName(deal({ deal_name: "26-132 - 100 E Broad - DDC" }))).toBe("DDC");
  });

  it("falls back to the contact's email domain, then to an unnamed client", () => {
    expect(
      hostingClientName(
        deal({ deal_name: "Ojai", hosting_communications_contact: "A (a@ojaivalleyinn.com)" }),
      ),
    ).toBe("ojaivalleyinn");
    expect(hostingClientName(deal({ deal_name: "Four Seasons Resort Maui" }))).toBe(UNNAMED_CLIENT);
  });

  it("prefers the deal's HubSpot company over the deal name", () => {
    expect(
      hostingClientName(
        deal({ deal_name: "26-140 - 1001 West Avenue - 3N", company_name: "3North Architects" }),
      ),
    ).toBe("3North Architects");
    expect(
      hostingClientName(deal({ deal_name: "Four Seasons Resort Maui", company_name: "  " })),
    ).toBe(UNNAMED_CLIENT);
  });
});

describe("hostingClientEconomics", () => {
  const deals = [
    deal({
      id: "a",
      deal_name: "26-1 - Paid site - ACME",
      ivion_hosting_start: "2026-11-01",
      ivion_hosting_end: "2027-01-30", // 91 days
      ivion_contracted_fee: 910,
      ivion_active_panos: 3000,
    }),
    deal({
      id: "b",
      deal_name: "26-2 - Complimentary site - ACME",
      ivion_comp_start: "2026-11-01",
      ivion_comp_end: "2026-11-25", // ends today: still active
      ivion_active_panos: 1000,
    }),
    deal({
      id: "c",
      deal_name: "26-3 - Expired - OLD",
      ivion_hosting_start: "2025-01-01",
      ivion_hosting_end: "2025-12-31",
      ivion_contracted_fee: 5000,
      ivion_active_panos: 9000,
    }),
    deal({
      id: "d",
      deal_name: "26-4 - Tour - BEN",
      benaco_url: url("feedcafe"),
      benaco_hosting_start: "2026-06-01",
      benaco_hosting_end: "2027-05-31", // 365 days
      benaco_contracted_fee: 1500,
      benaco_counted_grid_panos: 1000,
    }),
    deal({
      id: "e",
      deal_name: "26-5 - Same tour, complimentary - BEN",
      benaco_url: url("feedcafe"),
      benaco_comp_start: "2026-11-01",
      benaco_comp_end: "2026-12-31",
      benaco_counted_grid_panos: 1000,
    }),
  ];

  it("turns active fees into yearly rates and shares IVION bills by active panos", () => {
    const result = hostingClientEconomics(deals, "combined", today);
    const acme = result.clients.find((row) => row.client === "ACME")!;
    expect(acme).toMatchObject({
      paidSites: 1,
      complimentarySites: 1,
      ivionPanos: 4000,
      complimentaryPanos: 1000,
    });
    expect(acme.annualRevenue).toBeCloseTo((910 * 365) / 91, 6);
    // Only active sites share the bill; the expired 9,000-pano site does not.
    expect(result.ivionCostPerPanoMonth).toBeCloseTo(monthlyBill / 4000, 8);
    expect(acme.annualIvionCost).toBeCloseTo(monthlyBill * 12, 6);
    expect(result.clients.some((row) => row.client === "OLD")).toBe(false);
  });

  it("counts a shared Benaco tour once and adds the subscription", () => {
    const ben = hostingClientEconomics(deals, "combined", today).clients.find(
      (row) => row.client === "BEN",
    )!;
    expect(ben.benacoTours).toBe(1);
    expect(ben.annualRevenue).toBeCloseTo(1500, 6);
    expect(ben.annualBenacoCost).toBeCloseTo(1000 * 0.38 + 1200, 6);
    expect(ben.annualMargin).toBeCloseTo(1500 - 1580, 6);
  });

  it("marks clients with only complimentary hosting as included in scanning", () => {
    const result = hostingClientEconomics(
      [
        ...deals,
        deal({
          id: "f",
          deal_name: "26-6 - Lodge - GT",
          ivion_comp_start: "2026-10-01",
          ivion_comp_end: "2026-12-31",
          ivion_active_panos: 500,
        }),
      ],
      "combined",
      today,
    );
    const row = (client: string) => result.clients.find((entry) => entry.client === client)!;
    expect(row("GT").includedInScanning).toBe(true);
    expect(row("GT").annualCost).toBeGreaterThan(0); // the cost is still counted
    expect(row("ACME").includedInScanning).toBe(false); // paid + complimentary
    expect(row("BEN").includedInScanning).toBe(false); // paid Benaco term
    const costSum = result.clients.reduce((total, entry) => total + entry.annualCost, 0);
    expect(result.totals.annualCost).toBeCloseTo(costSum, 8);
  });

  it("follows the platform view and keeps totals equal to the client rows", () => {
    const ivion = hostingClientEconomics(deals, "ivion", today);
    expect(ivion.clients.map((row) => row.client)).toEqual(["ACME"]);
    const all = hostingClientEconomics(deals, "combined", today);
    const sum = all.clients.reduce((total, row) => total + row.annualMargin, 0);
    expect(all.totals.annualMargin).toBeCloseTo(sum, 8);
    expect(all.totals.annualCost).toBeCloseTo(
      all.totals.annualIvionCost + all.totals.annualBenacoCost,
      8,
    );
  });
});
