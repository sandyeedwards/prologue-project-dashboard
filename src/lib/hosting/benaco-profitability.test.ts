import { describe, expect, it } from "vitest";
import type { HostingDealRow } from "./reporting";
import { buildBenacoCostCommitments } from "./benaco-profitability";
import { BENACO_BILLING_HISTORY, benacoTourId } from "./benaco-billing-history";

// Only the Benaco input fields are read by this calculation.
const deal = (fields: Partial<HostingDealRow>) =>
  ({ hubspot_deal_id: "1", ...fields }) as HostingDealRow;
const url = (id: string) => `https://benaco.com/view/${id}-1234-4567-89ab-123456789abc`;

describe("reconciled full-term Benaco costs", () => {
  it("retains all 29 unique source charges and the flat-fee exception", () => {
    expect(new Set(BENACO_BILLING_HISTORY.map((record) => record.shortId)).size).toBe(29);
    expect(BENACO_BILLING_HISTORY.reduce((sum, record) => sum + record.panoCost, 0)).toBeCloseTo(
      10859.75,
      2,
    );
    expect(BENACO_BILLING_HISTORY.find((record) => record.shortId === "a4404168")?.panoCost).toBe(
      50,
    );
  });

  it("matches canonical tour IDs while ignoring camera/query parameters", () => {
    expect(benacoTourId(`${url("0e57eeb5")}?camera=example`)).toBe("0e57eeb5");
    expect(benacoTourId("https://other.example/view/0e57eeb5")).toBeNull();
  });

  it("adds only uncovered days to Maui's actual billed cost", () => {
    const rows = buildBenacoCostCommitments([
      deal({
        benaco_url: url("0e57eeb5"),
        benaco_hosting_start: "2024-01-01",
        benaco_hosting_end: "2027-01-01",
        benaco_counted_grid_panos: 4969,
        benaco_contracted_fee: 9500,
      }),
    ]);
    const maui = rows.find((row) => row.tourId === "0e57eeb5")!;
    expect(maui.start).toBe("2024-01-01");
    expect(maui.recordedPanoCost).toBe(2907.34);
    // 125 days after the worksheet's billed coverage ends on August 30, through the
    // 2027-01-01 end date, which is the last covered day.
    expect(maui.estimatedPanoCost).toBeCloseTo((4969 * 0.38 * 125) / 365, 8);
    expect(maui.totalPanoCost).toBeCloseTo(2907.34 + (4969 * 0.38 * 125) / 365, 8);
    expect(maui.missingInputs).toBe(false);
  });

  it("counts a shared tour's bill and overlapping term only once", () => {
    const input = deal({
      benaco_url: url("872ac132"),
      benaco_hosting_start: "2024-05-25",
      benaco_hosting_end: "2027-05-25",
      benaco_contracted_fee: 5000,
    });
    const rows = buildBenacoCostCommitments([input, { ...input, hubspot_deal_id: "2" }]);
    const boca = rows.filter((row) => row.tourId === "872ac132");
    expect(boca).toHaveLength(1);
    // Same single tour cost as before the inclusive end-date fix, plus the end date itself
    // (one day at 3,425 grid panos).
    expect(boca[0].totalPanoCost).toBeCloseTo(2071.701917808219 + (3425 * 0.38) / 365, 8);
  });

  it("retains all three user-confirmed losses without making up a paid term", () => {
    const inputs = ["c48fb24c", "ef392542", "6be67ce2"].map((id) => deal({ benaco_url: url(id) }));
    const rows = buildBenacoCostCommitments(inputs).filter((row) =>
      inputs.some((input) => benacoTourId(input.benaco_url) === row.tourId),
    );
    expect(rows.reduce((sum, row) => sum + row.totalPanoCost, 0)).toBeCloseTo(2069.82, 2);
    expect(rows.every((row) => row.estimatedPanoCost === 0)).toBe(true);
    expect(rows.find((row) => row.tourId === "c48fb24c")?.start).toBe("2024-11-22");
  });

  it("costs Jackson Hole's new complimentary term without assuming catch-up coverage", () => {
    const row = buildBenacoCostCommitments(
      [
        deal({
          benaco_url: url("55c43207"),
          benaco_comp_start: "2026-10-29",
          benaco_comp_end: "2026-11-13",
          benaco_counted_grid_panos: 802,
        }),
      ],
      [],
    )[0];
    expect(row.recordedPanoCost).toBe(0);
    // Oct 29 through Nov 13 inclusive is 16 days.
    expect(row.estimatedPanoCost).toBeCloseTo((802 * 0.38 * 16) / 365, 8);
    expect(row.start).toBe("2026-10-29");
  });

  it("merges complimentary and paid overlap before costing a new tour", () => {
    const row = buildBenacoCostCommitments(
      [
        deal({
          benaco_hosting_start: "2026-01-01",
          benaco_hosting_end: "2026-12-31",
          benaco_comp_start: "2025-12-01",
          benaco_comp_end: "2026-02-01",
          benaco_counted_grid_panos: 1000,
        }),
      ],
      [],
    )[0];
    // Dec 1, 2025 through Dec 31, 2026 inclusive, overlapping days counted once.
    expect(row.estimatedPanoCost).toBeCloseTo((1000 * 0.38 * 396) / 365, 8);
    expect(row.start).toBe("2025-12-01");
  });

  it("exposes missing grid counts and term ends instead of estimating them", () => {
    const missingGrid = buildBenacoCostCommitments(
      [
        deal({
          benaco_hosting_start: "2026-01-01",
          benaco_hosting_end: "2027-01-01",
          benaco_total_panos: 1000,
        }),
      ],
      [],
    )[0];
    expect(missingGrid.missingInputs).toBe(true);
    expect(missingGrid.estimatedPanoCost).toBe(0);
    const missingEnd = buildBenacoCostCommitments(
      [deal({ benaco_hosting_start: "2026-01-01", benaco_counted_grid_panos: 1000 })],
      [],
    )[0];
    expect(missingEnd.missingInputs).toBe(true);
  });

  it("accepts a zero-day complimentary placeholder alongside a complete paid term", () => {
    const row = buildBenacoCostCommitments(
      [
        deal({
          benaco_hosting_start: "2026-01-01",
          benaco_hosting_end: "2026-12-31",
          benaco_counted_grid_panos: 1000,
          benaco_comp_start: "2026-01-28",
          benaco_comp_end: "2026-01-28",
        }),
      ],
      [],
    )[0];
    expect(row.missingInputs).toBe(false);
    expect(row.totalPanoCost).toBe(380);
  });

  it("does not treat an unrecognized tour without dates as a complete zero-cost record", () => {
    const row = buildBenacoCostCommitments([deal({ benaco_url: url("abcdef12") })], [])[0];
    expect(row.missingInputs).toBe(true);
    expect(row.start).toBeNull();
  });

  it("allows a later complimentary term on a previously written-off tour to incur costs", () => {
    const row = buildBenacoCostCommitments([
      deal({
        benaco_url: url("ef392542"),
        benaco_comp_start: "2027-01-01",
        benaco_comp_end: "2027-12-31",
        benaco_counted_grid_panos: 403,
      }),
    ]).find((cost) => cost.tourId === "ef392542")!;
    expect(row.recordedPanoCost).toBe(87.27);
    expect(row.estimatedPanoCost).toBeCloseTo(153.14, 2);
  });

  it("counts a full year when the end date is the last covered day", () => {
    const row = buildBenacoCostCommitments(
      [
        deal({
          benaco_hosting_start: "2026-01-01",
          benaco_hosting_end: "2026-12-31",
          benaco_counted_grid_panos: 4969,
        }),
      ],
      [],
    )[0];
    expect(row.estimatePieces.map((piece) => piece.days)).toEqual([365]);
    expect(row.estimatedPanoCost).toBeCloseTo(4969 * 0.38, 8);
  });

  it("books a renewal term's estimate at that term's start, not the tour's first start", () => {
    const rows = buildBenacoCostCommitments(
      [
        deal({
          benaco_url: url("feedcafe"),
          benaco_hosting_start: "2024-03-01",
          benaco_hosting_end: "2025-02-28",
          benaco_counted_grid_panos: 1000,
        }),
        deal({
          benaco_url: url("feedcafe"),
          hubspot_deal_id: "2",
          benaco_hosting_start: "2025-03-01",
          benaco_hosting_end: "2026-02-28",
          benaco_counted_grid_panos: 1000,
        }),
      ],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].start).toBe("2024-03-01");
    expect(rows[0].estimatePieces.map((piece) => [piece.start, piece.days])).toEqual([
      ["2024-03-01", 365],
      ["2025-03-01", 365],
    ]);
  });

  it("estimates no cost after the Benaco site removal date", () => {
    // Fairmont Olympic (6598d381) was removed on 2026-07-27.
    const row = buildBenacoCostCommitments([
      deal({
        benaco_url: url("6598d381"),
        benaco_hosting_start: "2026-08-01",
        benaco_hosting_end: "2027-07-31",
        benaco_counted_grid_panos: 3348,
      }),
    ]).find((cost) => cost.tourId === "6598d381")!;
    expect(row.estimatedPanoCost).toBe(0);
    expect(row.estimatePieces).toEqual([]);
  });
});
