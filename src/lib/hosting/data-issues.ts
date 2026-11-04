import type { HostingDealRow, HostingIvionSite } from "./reporting";
import { benacoBillingRecord, benacoTourId } from "./benaco-billing-history";
import { isConfirmedBenacoLossOnly } from "./benaco-profitability";
import { currentTimeReportingDate } from "@/lib/reporting/time-reporting-rules";

export type HostingIssueDeal = Pick<
  HostingDealRow,
  | "id"
  | "hubspot_deal_id"
  | "deal_name"
  | "site_name"
  | "ivion_instance"
  | "ivion_hosting_start"
  | "ivion_hosting_end"
  | "ivion_contracted_fee"
  | "ivion_total_panos"
  | "ivion_active_panos"
  | "ivion_comp_start"
  | "ivion_comp_end"
  | "benaco_hosting_start"
  | "benaco_hosting_end"
  | "benaco_contracted_fee"
  | "benaco_total_panos"
  | "benaco_counted_grid_panos"
  | "benaco_comp_start"
  | "benaco_comp_end"
  | "benaco_url"
>;

export type HostingDataIssue = {
  id: string;
  dealId: string | null;
  hubspotDealId: string | null;
  dealName: string;
  platform: "Benaco" | "IVION";
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  title: string;
  message: string;
  impact: string;
  action: string;
  location: string;
  source: "HUBSPOT" | "HOSTING_SETTINGS";
  evidence: Array<{ field: string; value: string }>;
};

function present(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
function numeric(value: unknown): number | null {
  if (!present(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}
function urlKey(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      ? `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}`
      : null;
  } catch {
    return null;
  }
}
function visible(value: unknown): string {
  return present(value) ? String(value) : "Missing";
}

export function buildHostingDataIssues(
  deals: readonly HostingIssueDeal[],
  sites: readonly Pick<HostingIvionSite, "url">[] = [],
  reportingDate = currentTimeReportingDate(),
): HostingDataIssue[] {
  const issues: HostingDataIssue[] = [];
  const knownSites = new Set(sites.map((site) => urlKey(site.url)).filter(Boolean));
  const tourGroups = new Map<string, HostingIssueDeal[]>();
  for (const deal of deals) {
    const base = {
      dealId: deal.id,
      hubspotDealId: deal.hubspot_deal_id,
      dealName: deal.site_name ?? deal.deal_name ?? deal.hubspot_deal_id,
      source: "HUBSPOT" as const,
    };
    const add = (
      platform: HostingDataIssue["platform"],
      code: string,
      title: string,
      message: string,
      impact: string,
      action: string,
      evidence: HostingDataIssue["evidence"],
      severity: HostingDataIssue["severity"] = "WARNING",
      key = code,
    ) =>
      issues.push({
        ...base,
        id: `hosting:${deal.hubspot_deal_id}:${platform}:${key}`,
        platform,
        severity,
        code,
        title,
        message,
        impact,
        action,
        location: `HubSpot → ${platform} hosting properties`,
        evidence,
      });
    for (const platform of ["Benaco", "IVION"] as const) {
      const benaco = platform === "Benaco";
      const start = benaco ? deal.benaco_hosting_start : deal.ivion_hosting_start;
      const end = benaco ? deal.benaco_hosting_end : deal.ivion_hosting_end;
      const compStart = benaco ? deal.benaco_comp_start : deal.ivion_comp_start;
      const compEnd = benaco ? deal.benaco_comp_end : deal.ivion_comp_end;
      const fee = benaco ? deal.benaco_contracted_fee : deal.ivion_contracted_fee;
      const feeAmount = numeric(fee);
      // A platform is only checked once its identifier is known: the Benaco tour URL or the
      // IVION instance. Pano counts, notes or placeholder dates alone (for example a Benaco site
      // carrying stray IVION pano fields) do not establish that the record is on that platform.
      if (!present(benaco ? deal.benaco_url : deal.ivion_instance)) continue;
      const paidFrom = date(start),
        paidTo = date(end),
        freeFrom = date(compStart),
        freeTo = date(compEnd);
      const active = [
        [paidFrom, paidTo],
        [freeFrom, freeTo],
      ].some(([from, to]) => from && (!to || to >= reportingDate));
      const loss = benaco && isConfirmedBenacoLossOnly(deal);
      const bill = benaco ? benacoBillingRecord(deal.benaco_url) : null;
      const knownClosed = loss || !!(!active && bill?.removedOn && bill.removedOn <= reportingDate);
      for (const term of [
        { kind: "Paid", from: start, to: end },
        { kind: "Complimentary", from: compStart, to: compEnd },
      ]) {
        const invalid = [
          { field: `${term.kind} start`, value: term.from },
          { field: `${term.kind} end`, value: term.to },
        ].filter((item) => present(item.value) && !date(item.value));
        if (invalid.length) {
          add(
            platform,
            "INVALID_HOSTING_DATE",
            `${term.kind} hosting date is invalid`,
            "A hosting date cannot be interpreted as a valid calendar date.",
            "Revenue or costs can be omitted or placed in the wrong period.",
            "Correct the highlighted date in HubSpot.",
            invalid.map((item) => ({ field: item.field, value: visible(item.value) })),
            "ERROR",
            `INVALID_DATE:${term.kind}`,
          );
          continue;
        }
        if (present(term.from) !== present(term.to))
          add(
            platform,
            "INCOMPLETE_HOSTING_TERM",
            `${term.kind} hosting term is missing a date`,
            "Only one end of this hosting term is populated.",
            "The full hosting duration and remaining cost cannot be determined reliably.",
            `Complete both ${term.kind.toLowerCase()} hosting dates, or clear an unused term.`,
            [
              { field: `${term.kind} start`, value: visible(term.from) },
              { field: `${term.kind} end`, value: visible(term.to) },
            ],
            "WARNING",
            `MISSING_DATE:${term.kind}`,
          );
        const from = date(term.from),
          to = date(term.to);
        if (
          from &&
          to &&
          (to < from || (term.kind === "Paid" && to === from && (numeric(fee) ?? 0) > 0))
        )
          add(
            platform,
            "REVERSED_HOSTING_TERM",
            to === from
              ? "Paid hosting term has no duration"
              : `${term.kind} hosting ends before it starts`,
            "The end date must follow the start date for a billed hosting term.",
            "Term duration and cost estimates are invalid.",
            "Correct the start/end dates; do not change them merely to match an invoice export date.",
            [
              { field: `${term.kind} start`, value: from },
              { field: `${term.kind} end`, value: to },
            ],
            "ERROR",
            `REVERSED:${term.kind}`,
          );
      }
      if (present(fee) && (feeAmount === null || feeAmount < 0))
        add(
          platform,
          "INVALID_CONTRACTED_FEE",
          "Contracted fee is invalid",
          "The contracted fee must be a nonnegative amount.",
          "Recognized revenue cannot be trusted.",
          "Enter the agreed full-term fee; use zero for hosting that was not sold.",
          [{ field: "Contracted fee", value: visible(fee) }],
          "ERROR",
        );
      // A fee with no paid term but populated complimentary dates is treated as complimentary
      // hosting: the report already places revenue only at a paid start, so no warning is needed.
      const complimentaryOnly = present(compStart) || present(compEnd);
      if ((feeAmount ?? 0) > 0 && !present(start) && !present(end) && (loss || !complimentaryOnly))
        add(
          platform,
          loss ? "UNSOLD_CONTRACTED_FEE" : "FEE_WITHOUT_PAID_TERM",
          loss
            ? "Unsold hosting still has a contracted fee"
            : "Contracted fee has no paid hosting start",
          loss
            ? "This tour was confirmed as unsold, but HubSpot still holds a positive contracted fee."
            : "A contracted fee is populated without the paid hosting start needed to place it in the report.",
          loss
            ? "The quoted amount must not become client revenue. Vendor costs remain a loss."
            : "The report cannot place this fee in a revenue period; it may be an unsold quote.",
          loss
            ? "Clear the contracted fee or set it to zero. Keep the vendor charges."
            : "Confirm whether it was sold. Enter the paid dates if sold, or clear the unsold fee.",
          [
            { field: "Contracted fee", value: visible(fee) },
            { field: "Paid hosting start", value: visible(start) },
          ],
        );
      if (present(start) && !present(fee))
        add(
          platform,
          "MISSING_CONTRACTED_FEE",
          "Paid hosting term has no contracted fee",
          "A paid hosting start exists but its full-term fee is blank.",
          "Contracted revenue may be understated.",
          "Enter the agreed fee, explicitly enter zero if appropriate, or use the complimentary term fields.",
          [
            { field: "Paid hosting start", value: visible(start) },
            { field: "Contracted fee", value: "Missing" },
          ],
        );
      if (
        !present(start) &&
        !present(end) &&
        !present(compStart) &&
        !present(compEnd) &&
        (feeAmount ?? 0) <= 0 &&
        !knownClosed
      )
        add(
          platform,
          "MISSING_HOSTING_DATES",
          "Hosting record has no service dates",
          "Neither paid nor complimentary hosting start is recorded.",
          "Activity and term-cost estimates cannot be placed reliably in history.",
          "Enter the actual paid or complimentary term. Do not invent a paid term for an unsold tour.",
          [
            { field: "Paid hosting start", value: "Missing" },
            { field: "Complimentary hosting start", value: "Missing" },
          ],
        );
      if (
        paidFrom &&
        paidTo &&
        freeFrom &&
        freeTo &&
        freeTo > freeFrom &&
        paidTo > paidFrom &&
        paidFrom < freeTo &&
        freeFrom < paidTo
      )
        add(
          platform,
          "OVERLAPPING_HOSTING_TERMS",
          "Paid and complimentary dates overlap",
          "The same days appear in both the paid and complimentary terms.",
          benaco
            ? "The cost calculation merges overlapping days; the source dates still need confirmation."
            : "The dates do not clearly separate paid and complimentary service coverage.",
          "Confirm whether the overlap is intentional. Correct the dates if these should be consecutive terms.",
          [
            { field: "Paid term", value: `${paidFrom} through ${paidTo}` },
            { field: "Complimentary term", value: `${freeFrom} through ${freeTo}` },
          ],
          "INFO",
        );
      const total = benaco ? deal.benaco_total_panos : deal.ivion_total_panos;
      const count = benaco ? deal.benaco_counted_grid_panos : deal.ivion_active_panos;
      const countAmount = numeric(count);
      const totalAmount = numeric(total);
      if (
        present(count) &&
        (countAmount === null || countAmount < 0 || !Number.isInteger(countAmount))
      )
        add(
          platform,
          "INVALID_PANO_COUNT",
          "Pano count is invalid",
          "The pano count must be a nonnegative whole number.",
          "Vendor-cost estimates or utilization figures are unreliable.",
          "Correct the actual pano count in HubSpot.",
          [{ field: benaco ? "Counted Grid-Pano" : "IVION Active Panos", value: visible(count) }],
          "ERROR",
        );
      if (
        present(total) &&
        (totalAmount === null || totalAmount < 0 || !Number.isInteger(totalAmount))
      )
        add(
          platform,
          "INVALID_TOTAL_PANOS",
          "Total pano count is invalid",
          "Total panos must be a nonnegative whole number.",
          "Inventory comparisons cannot be checked reliably.",
          "Correct the total pano inventory in HubSpot.",
          [{ field: "Total panos", value: visible(total) }],
          "ERROR",
        );
      if (
        countAmount !== null &&
        totalAmount !== null &&
        countAmount > totalAmount &&
        totalAmount >= 0
      )
        add(
          platform,
          "PANO_COUNT_EXCEEDS_TOTAL",
          "Counted panos exceed total panos",
          "The counted/active pano count is larger than the recorded total inventory.",
          "The two inventory fields may refer to different snapshots or contain a data-entry error.",
          "Check both counts on the same site and update the mismatched field.",
          [
            { field: benaco ? "Grid panos" : "Active panos", value: visible(count) },
            { field: "Total panos", value: visible(total) },
          ],
        );
      if (benaco) {
        const id = benacoTourId(deal.benaco_url);
        if (id) tourGroups.set(id, [...(tourGroups.get(id) ?? []), deal]);
        else
          add(
            platform,
            "MISSING_OR_INVALID_BENACO_URL",
            "Benaco tour link is invalid",
            "The record needs a Benaco tour URL that identifies its tour.",
            "It cannot be matched safely to billing detail; costs may be duplicated or remain unallocated.",
            "Copy the tour's Benaco view link into Benaco URL.",
            [{ field: "Benaco URL", value: visible(deal.benaco_url) }],
          );
        if (!present(count) && !knownClosed)
          add(
            platform,
            "MISSING_GRID_PANOS",
            "Counted Grid-Pano is missing",
            bill
              ? "HubSpot's actual grid count is blank; the report currently uses matched billing detail."
              : "There is no actual grid-pano count in HubSpot or the supplied bill.",
            bill
              ? "Billing detail supplies a historical count, but HubSpot has no current count."
              : "The remaining tour-cost estimate is incomplete.",
            bill
              ? `Verify the current Benaco count and fill Counted Grid-Pano. The supplied bill lists ${bill.gridPanos.toLocaleString()} grid panos.`
              : "Read the actual grid-pano statistics in Benaco and enter Counted Grid-Pano.",
            [
              { field: "HubSpot Counted Grid-Pano", value: "Missing" },
              ...(bill ? [{ field: "August bill grid panos", value: String(bill.gridPanos) }] : []),
            ],
          );
        if (
          present(count) &&
          countAmount !== null &&
          countAmount >= 0 &&
          Number.isInteger(countAmount) &&
          bill &&
          bill.gridPanos > 0 &&
          countAmount !== bill.gridPanos
        )
          add(
            platform,
            "GRID_COUNT_CHANGED_SINCE_BILL",
            "Grid count differs from billing detail",
            "The current HubSpot grid count differs from the August billing snapshot.",
            "This can be a legitimate later inventory change. Recorded historical charges are preserved; remaining estimates use HubSpot's count.",
            "Verify the current count in Benaco and confirm when the inventory changed.",
            [
              { field: "HubSpot grid panos", value: visible(count) },
              { field: "August bill grid panos", value: String(bill.gridPanos) },
            ],
            "INFO",
          );
      } else if (active) {
        if (!present(count))
          add(
            platform,
            "MISSING_IVION_PANOS",
            "IVION active-pano count is missing",
            "A current or upcoming IVION term has no active-pano count.",
            "Active inventory and pricing comparisons are incomplete.",
            "Enter the counted/active pano count in HubSpot; use zero only when the actual count is zero.",
            [{ field: "IVION Active Panos", value: "Missing" }],
          );
        const instance = urlKey(deal.ivion_instance);
        if (!instance || !knownSites.has(instance))
          add(
            platform,
            "UNKNOWN_IVION_INSTANCE",
            "IVION instance is missing or unrecognized",
            "A current or upcoming IVION term does not match an instance in hosting settings.",
            "The site reference and future instance-cost mapping need confirmation.",
            "Correct IVION Instance in HubSpot, or add the legitimate instance in Hosting settings.",
            [{ field: "IVION Instance", value: visible(deal.ivion_instance) }],
          );
      }
    }
  }
  for (const [id, group] of tourGroups) {
    if (group.length < 2) continue;
    for (const deal of group) {
      const start = date(deal.benaco_hosting_start),
        end = date(deal.benaco_hosting_end);
      if (!start || !end || (numeric(deal.benaco_contracted_fee) ?? 0) <= 0) continue;
      const duplicates = group.filter((other) => {
        const otherStart = date(other.benaco_hosting_start);
        const otherEnd = date(other.benaco_hosting_end);
        return (
          other.hubspot_deal_id !== deal.hubspot_deal_id &&
          (numeric(other.benaco_contracted_fee) ?? 0) > 0 &&
          otherStart &&
          otherEnd &&
          otherEnd > otherStart &&
          end > start &&
          otherStart < end &&
          otherEnd > start
        );
      });
      if (duplicates.length)
        issues.push({
          id: `hosting:${deal.hubspot_deal_id}:Benaco:DUPLICATE_PAID_TOUR`,
          dealId: deal.id,
          hubspotDealId: deal.hubspot_deal_id,
          dealName: deal.site_name ?? deal.deal_name ?? deal.hubspot_deal_id,
          platform: "Benaco",
          severity: "ERROR",
          code: "DUPLICATE_PAID_TOUR",
          title: "Paid tour appears on overlapping deals",
          message:
            "Multiple deals use the same tour URL with overlapping paid terms and positive fees.",
          impact:
            "Client revenue may be counted more than once even though tour costs are grouped.",
          action:
            "Check whether these are duplicate deals or legitimate separate contracts. Correct the duplicated fee or term in HubSpot.",
          location: "HubSpot → Benaco URL, paid dates and contracted fee",
          source: "HUBSPOT",
          evidence: [
            { field: "Tour ID", value: id },
            {
              field: "Other HubSpot deal IDs",
              value: duplicates.map((other) => other.hubspot_deal_id).join(", "),
            },
          ],
        });
    }
  }
  return issues.sort(
    (a, b) =>
      ({ ERROR: 0, WARNING: 1, INFO: 2 })[a.severity] -
        { ERROR: 0, WARNING: 1, INFO: 2 }[b.severity] ||
      a.dealName.localeCompare(b.dealName) ||
      a.id.localeCompare(b.id),
  );
}

export function filterHostingDataIssues(
  issues: readonly HostingDataIssue[],
  filters: { query?: string; severity?: string; code?: string; platform?: string } = {},
): HostingDataIssue[] {
  const query = filters.query?.trim().toLowerCase();
  return issues.filter(
    (issue) =>
      (!filters.severity || filters.severity === "ALL" || issue.severity === filters.severity) &&
      (!filters.code || filters.code === "ALL" || issue.code === filters.code) &&
      (!filters.platform || filters.platform === "ALL" || issue.platform === filters.platform) &&
      (!query ||
        [
          issue.dealName,
          issue.hubspotDealId,
          issue.title,
          issue.message,
          issue.action,
          issue.code,
          ...issue.evidence.flatMap((item) => [item.field, item.value]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
}

export function hostingIssueSourceUrl(issue: HostingDataIssue, portalId = "4953519"): string {
  return issue.source === "HUBSPOT" &&
    issue.hubspotDealId &&
    /^\d+$/.test(issue.hubspotDealId) &&
    /^\d+$/.test(portalId)
    ? `https://app.hubspot.com/contacts/${portalId}/record/0-3/${issue.hubspotDealId}`
    : "/hosting";
}
