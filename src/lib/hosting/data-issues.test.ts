import { describe, expect, it } from "vitest";
import {
  buildHostingDataIssues,
  filterHostingDataIssues,
  hostingIssueSourceUrl,
  type HostingIssueDeal,
} from "./data-issues";

const tour = (id = "aabbccdd") => `https://benaco.com/view/${id}-1234-4567-89ab-123456789abc`;
const makeDeal = (fields: Partial<HostingIssueDeal> = {}) =>
  ({
    id: "db-1",
    hubspot_deal_id: "101",
    deal_name: "Example tour",
    site_name: null,
    benaco_url: tour(),
    benaco_hosting_start: "2026-01-01",
    benaco_hosting_end: "2027-01-01",
    benaco_contracted_fee: 500,
    benaco_total_panos: 1000,
    benaco_counted_grid_panos: 100,
    benaco_comp_start: null,
    benaco_comp_end: null,
    ...fields,
  }) as HostingIssueDeal;
const check = (deals: HostingIssueDeal[]) => buildHostingDataIssues(deals, [], "2026-11-03");
const codes = (deal: HostingIssueDeal) => check([deal]).map((issue) => issue.code);

describe("hosting source-data checks", () => {
  it("accepts a complete paid tour", () => expect(check([makeDeal()])).toEqual([]));

  it("shows missing term evidence and clears after the date is corrected", () => {
    const missing = check([makeDeal({ benaco_hosting_end: null })]);
    expect(
      missing.find((issue) => issue.code === "INCOMPLETE_HOSTING_TERM")?.evidence,
    ).toContainEqual({ field: "Paid end", value: "Missing" });
    expect(codes(makeDeal())).not.toContain("INCOMPLETE_HOSTING_TERM");
  });

  it("rejects invalid calendar dates and reversed paid terms", () => {
    expect(codes(makeDeal({ benaco_hosting_start: "2026-02-30" }))).toContain(
      "INVALID_HOSTING_DATE",
    );
    expect(codes(makeDeal({ benaco_hosting_end: "2025-01-01" }))).toContain(
      "REVERSED_HOSTING_TERM",
    );
  });

  it("allows a zero-day complimentary placeholder", () => {
    expect(
      check([makeDeal({ benaco_comp_start: "2026-01-28", benaco_comp_end: "2026-01-28" })]),
    ).toEqual([]);
  });

  it("distinguishes an explicit zero fee from a missing fee", () => {
    expect(codes(makeDeal({ benaco_contracted_fee: 0 }))).not.toContain("MISSING_CONTRACTED_FEE");
    expect(codes(makeDeal({ benaco_contracted_fee: null }))).toContain("MISSING_CONTRACTED_FEE");
  });

  it("does not require paid dates or client revenue for complimentary hosting", () => {
    expect(
      check([
        makeDeal({
          benaco_hosting_start: null,
          benaco_hosting_end: null,
          benaco_contracted_fee: null,
          benaco_comp_start: "2026-10-29",
          benaco_comp_end: "2026-11-13",
        }),
      ]),
    ).toEqual([]);
  });

  it("does not report missing revenue, terms or grids for the confirmed loss-only tours", () => {
    for (const id of ["c48fb24c", "ef392542", "6be67ce2"]) {
      const issues = check([
        makeDeal({
          benaco_url: tour(id),
          benaco_hosting_start: null,
          benaco_hosting_end: null,
          benaco_contracted_fee: 0,
          benaco_counted_grid_panos: null,
          benaco_total_panos: null,
        }),
      ]);
      expect(issues).toEqual([]);
    }
  });

  it("flags Scottsdale's stale quote as an unsold fee instead of missing revenue", () => {
    const issues = check([
      makeDeal({
        benaco_url: tour("c48fb24c"),
        benaco_hosting_start: null,
        benaco_hosting_end: null,
        benaco_contracted_fee: 6000,
        benaco_counted_grid_panos: null,
      }),
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(["UNSOLD_CONTRACTED_FEE"]);
    expect(issues[0].impact).toContain("Vendor costs remain a loss");
  });

  it("suggests Boca's verified count while preserving its revenue and paid dates", () => {
    const missing = makeDeal({
      benaco_url: tour("872ac132"),
      benaco_counted_grid_panos: null,
      benaco_total_panos: 12598,
      benaco_contracted_fee: 5000,
    });
    const issues = check([missing]);
    expect(issues.map((issue) => issue.code)).toEqual(["MISSING_GRID_PANOS"]);
    expect(issues[0].action).toContain("3,425");
    expect(check([{ ...missing, benaco_counted_grid_panos: 3425 }])).toEqual([]);
  });

  it("uses an information note for a later grid change rather than declaring the invoice wrong", () => {
    const issue = check([
      makeDeal({
        benaco_url: tour("872ac132"),
        benaco_counted_grid_panos: 3500,
        benaco_total_panos: 12598,
      }),
    ]).find((issue) => issue.code === "GRID_COUNT_CHANGED_SINCE_BILL");
    expect(issue?.severity).toBe("INFO");
    expect(issue?.message).toContain("August");
  });

  it("flags impossible inventory counts and malformed counts", () => {
    expect(codes(makeDeal({ benaco_counted_grid_panos: 1200 }))).toContain(
      "PANO_COUNT_EXCEEDS_TOTAL",
    );
    expect(codes(makeDeal({ benaco_counted_grid_panos: -1 }))).toContain("INVALID_PANO_COUNT");
    expect(codes(makeDeal({ benaco_counted_grid_panos: 1.5 }))).toContain("INVALID_PANO_COUNT");
    expect(codes(makeDeal({ benaco_total_panos: -1 }))).toContain("INVALID_TOTAL_PANOS");
    expect(codes(makeDeal({ benaco_total_panos: 0 }))).toContain("PANO_COUNT_EXCEEDS_TOTAL");
  });

  it("does not duplicate missing-date warnings for the same term", () => {
    const missingStart = codes(makeDeal({ benaco_hosting_start: null }));
    expect(missingStart).toContain("INCOMPLETE_HOSTING_TERM");
    expect(missingStart).not.toContain("FEE_WITHOUT_PAID_TERM");
    expect(missingStart).not.toContain("MISSING_HOSTING_DATES");
    expect(codes(makeDeal({ benaco_hosting_start: null, benaco_hosting_end: null }))).toEqual([
      "FEE_WITHOUT_PAID_TERM",
    ]);
  });

  it("flags a negative fee and does not describe invalid grids as inventory changes", () => {
    expect(codes(makeDeal({ benaco_contracted_fee: -500 }))).toContain("INVALID_CONTRACTED_FEE");
    const issues = codes(
      makeDeal({
        benaco_url: tour("872ac132"),
        benaco_counted_grid_panos: "invalid",
      }),
    );
    expect(issues).toContain("INVALID_PANO_COUNT");
    expect(issues).not.toContain("GRID_COUNT_CHANGED_SINCE_BILL");
  });

  it("treats zero-only fields on an unused platform as unused", () => {
    expect(
      check([makeDeal({ ivion_contracted_fee: 0, ivion_active_panos: 0, ivion_total_panos: 0 })]),
    ).toEqual([]);
  });

  it("skips a platform whose instance or tour link is unknown", () => {
    // 820 Southlake Blvd: Benaco site with IVION pano counts but no IVION instance or dates.
    const southlake = makeDeal({
      site_name: "820 Southlake Blvd",
      benaco_url: null,
      benaco_hosting_start: null,
      benaco_hosting_end: null,
      benaco_contracted_fee: null,
      benaco_total_panos: null,
      benaco_counted_grid_panos: null,
      ivion_instance: null,
      ivion_total_panos: 841,
      ivion_active_panos: 200,
    });
    expect(check([southlake])).toEqual([]);
    expect(
      codes(
        makeDeal({
          benaco_url: null,
          ivion_instance: null,
          ivion_hosting_start: "2026-01-01",
          ivion_hosting_end: "2027-01-01",
          ivion_contracted_fee: 500,
        }),
      ),
    ).toEqual([]);
  });

  it("treats a fee with only complimentary dates as complimentary hosting", () => {
    const comp = makeDeal({
      benaco_hosting_start: null,
      benaco_hosting_end: null,
      benaco_comp_start: "2026-01-01",
      benaco_comp_end: "2027-01-01",
    });
    expect(codes(comp)).not.toContain("FEE_WITHOUT_PAID_TERM");
    expect(codes({ ...comp, benaco_comp_start: null, benaco_comp_end: null })).toContain(
      "FEE_WITHOUT_PAID_TERM",
    );
  });

  it("ignores an IVION record that is only an instance link, with no panos, dates or fee", () => {
    const input = makeDeal({
      ivion_instance: "https://unmapped.example/",
      ivion_hosting_start: null,
      ivion_hosting_end: null,
      ivion_comp_start: null,
      ivion_comp_end: null,
      ivion_contracted_fee: null,
      ivion_active_panos: null,
      ivion_total_panos: null,
    });
    expect(check([input]).filter((issue) => issue.platform === "IVION")).toEqual([]);
    expect(codes({ ...input, ivion_total_panos: 300 })).toContain("MISSING_HOSTING_DATES");
  });

  it("still flags blank IVION pano counts once the record has a paid term or fee", () => {
    // This record books revenue, so missing panos must not be hidden (missing is not zero).
    const input = makeDeal({
      ivion_instance: "https://unmapped.example/",
      ivion_hosting_start: "2026-01-01",
      ivion_hosting_end: "2027-01-01",
      ivion_contracted_fee: 500,
      ivion_active_panos: null,
      ivion_total_panos: null,
    });
    expect(codes(input)).toEqual(
      expect.arrayContaining(["MISSING_IVION_PANOS", "UNKNOWN_IVION_INSTANCE"]),
    );
    const feeOnly = { ...input, ivion_hosting_start: null, ivion_hosting_end: null };
    expect(codes(feeOnly)).toContain("FEE_WITHOUT_PAID_TERM");
  });

  it("still checks a platform once its identifier is present", () => {
    expect(codes(makeDeal({ benaco_url: "not a url" }))).toContain("MISSING_OR_INVALID_BENACO_URL");
    expect(
      codes(
        makeDeal({
          ivion_instance: "https://unmapped.example/",
          ivion_hosting_start: "2026-01-01",
          ivion_hosting_end: "2027-01-01",
          ivion_contracted_fee: 500,
          ivion_active_panos: 100,
        }),
      ),
    ).toContain("UNKNOWN_IVION_INSTANCE");
  });

  it("checks current IVION instance mapping but permits different historical instances", () => {
    const input = makeDeal({
      ivion_instance: "https://old.example/",
      ivion_hosting_start: "2026-01-01",
      ivion_hosting_end: "2027-01-01",
      ivion_contracted_fee: 500,
      ivion_active_panos: 100,
      ivion_total_panos: 200,
    });
    expect(codes(input)).toContain("UNKNOWN_IVION_INSTANCE");
    expect(codes({ ...input, ivion_hosting_end: "2026-01-02" })).not.toContain(
      "UNKNOWN_IVION_INSTANCE",
    );
    expect(
      buildHostingDataIssues([input], [{ url: "https://old.example" }], "2026-11-03").map(
        (issue) => issue.code,
      ),
    ).not.toContain("UNKNOWN_IVION_INSTANCE");
  });

  it("flags overlapping paid records sharing a tour but permits consecutive renewals", () => {
    const first = makeDeal();
    const second = makeDeal({ id: "db-2", hubspot_deal_id: "202" });
    expect(
      check([first, second]).filter((issue) => issue.code === "DUPLICATE_PAID_TOUR"),
    ).toHaveLength(2);
    expect(
      check([
        first,
        { ...second, benaco_hosting_start: "2027-01-01", benaco_hosting_end: "2028-01-01" },
      ]).filter((issue) => issue.code === "DUPLICATE_PAID_TOUR"),
    ).toHaveLength(0);
  });

  it("filters by fields, source IDs, severity, issue type and platform", () => {
    const issues = check([makeDeal({ benaco_hosting_end: null })]);
    expect(
      filterHostingDataIssues(issues, {
        query: "Paid end",
        platform: "Benaco",
        severity: "WARNING",
        code: "INCOMPLETE_HOSTING_TERM",
      }),
    ).toHaveLength(1);
    expect(filterHostingDataIssues(issues, { query: "101" })).toHaveLength(1);
    expect(filterHostingDataIssues(issues, { platform: "IVION" })).toHaveLength(0);
  });

  it("generates source links only for valid HubSpot identities", () => {
    const issue = check([makeDeal({ benaco_hosting_end: null })])[0];
    expect(hostingIssueSourceUrl(issue, "4953519")).toBe(
      "https://app.hubspot.com/contacts/4953519/record/0-3/101",
    );
    expect(hostingIssueSourceUrl({ ...issue, hubspotDealId: "not-an-id" })).toBe("/hosting");
  });
});
