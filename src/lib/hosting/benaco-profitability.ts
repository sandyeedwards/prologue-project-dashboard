import type { HostingDealRow } from "./reporting";
import {
  BENACO_BILLING_HISTORY,
  BENACO_VERIFIED_ANNUAL_GRID_RATE,
  benacoTourId,
  type BenacoBillingRecord,
} from "./benaco-billing-history";

const DAY = 86400000;
// Confirmed by the user as billed hosting with no sale. A future paid term on
// the same tour is still allowed; these flags only apply without a paid term.
const LOSS_ONLY_TOURS = new Set(["c48fb24c", "ef392542", "6be67ce2"]);
const LOSS_CONFIRMATION_DATE = Date.parse("2026-11-03T00:00:00Z");

export function isConfirmedBenacoLossOnly(
  deal: Pick<
    HostingDealRow,
    "benaco_url" | "benaco_hosting_start" | "benaco_contracted_fee" | "benaco_comp_end"
  >,
): boolean {
  const id = benacoTourId(deal.benaco_url);
  return (
    !!id &&
    LOSS_ONLY_TOURS.has(id) &&
    !deal.benaco_hosting_start &&
    (!deal.benaco_comp_end || (time(deal.benaco_comp_end) ?? Infinity) <= LOSS_CONFIRMATION_DATE)
  );
}

// The estimated cost of the uncovered days in one HubSpot term, booked at that term's start.
export type BenacoEstimatePiece = { start: string; days: number; cost: number };

export type BenacoCostCommitment = {
  tourId: string;
  name: string;
  start: string | null;
  recordedPanoCost: number;
  estimatedPanoCost: number;
  // Per-term pieces of estimatedPanoCost. A renewal's cost belongs to its own term start, like
  // its fee, not to the tour's first start (which may fall before the report start).
  estimatePieces: BenacoEstimatePiece[];
  // The days Benaco's recorded charges cover: from the billing record's creation date, for its
  // billed days. Recorded charges are spread evenly over these days (owner decision 2026-11-25).
  recordedCoverage: { start: string; days: number } | null;
  totalPanoCost: number;
  missingInputs: boolean;
};

const isoDay = (value: number) => new Date(value).toISOString().slice(0, 10);

/**
 * The part of a tour's recorded Benaco charges that covers days in [from, toExclusive).
 * Charges are spread evenly over the billed days; a record with no billed days is counted in
 * full on its billing date (or the tour start when there is no billing record).
 */
export function recordedCostBetween(
  tour: Pick<BenacoCostCommitment, "recordedPanoCost" | "recordedCoverage" | "start">,
  from: number,
  toExclusive: number,
): number {
  if (!tour.recordedPanoCost) return 0;
  const coverage = tour.recordedCoverage;
  const coverageStart = time(coverage?.start ?? tour.start);
  if (coverageStart === null) return 0;
  if (!coverage || coverage.days <= 0) {
    return coverageStart >= from && coverageStart < toExclusive ? tour.recordedPanoCost : 0;
  }
  const coverageEnd = coverageStart + coverage.days * DAY;
  const overlapDays =
    Math.max(0, Math.min(coverageEnd, toExclusive) - Math.max(coverageStart, from)) / DAY;
  return (tour.recordedPanoCost * overlapDays) / coverage.days;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// Date columns can arrive as "YYYY-MM-DD" strings or as JS Dates, depending on how the shared
// database client was initialised. Both must give the same day, or terms silently drop out.
function time(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function incompleteInterval(start: string | Date | null, end: string | Date | null): boolean {
  // An end date with no start (for example a sold term missing its paid start) cannot be placed
  // in history: its revenue and remaining cost would otherwise drop out without any warning.
  if (!start) return Boolean(end);
  const from = time(start),
    to = time(end);
  // A same-day complimentary placeholder contributes zero days, not an error.
  return from === null || to === null || to < from;
}

// Each paid or complimentary term as [first day, day after the last covered day]. HubSpot end
// dates are the last covered day (inclusive), so a 2026-01-01 to 2026-12-31 term is 365 days.
// A same-day complimentary placeholder (end = start) still contributes zero days.
function termIntervals(deals: readonly HostingDealRow[]): Array<[number, number]> {
  return deals
    .flatMap((deal) => [
      [time(deal.benaco_hosting_start), time(deal.benaco_hosting_end)],
      [time(deal.benaco_comp_start), time(deal.benaco_comp_end)],
    ])
    .filter(
      (pair): pair is [number, number] => pair[0] !== null && pair[1] !== null && pair[1] > pair[0],
    )
    .map(([from, last]): [number, number] => [from, last + DAY])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function buildBenacoCostCommitments(
  deals: readonly HostingDealRow[],
  history: readonly BenacoBillingRecord[] = BENACO_BILLING_HISTORY,
): BenacoCostCommitment[] {
  const grouped = new Map<string, HostingDealRow[]>();
  for (const deal of deals) {
    if (!deal.benaco_url && !deal.benaco_hosting_start && !deal.benaco_comp_start) continue;
    const id = benacoTourId(deal.benaco_url) ?? `deal:${deal.hubspot_deal_id}`;
    grouped.set(id, [...(grouped.get(id) ?? []), deal]);
  }
  const billing = new Map(history.map((record) => [record.shortId, record]));
  const ids = new Set([...billing.keys(), ...grouped.keys()]);
  return [...ids].map((id) => {
    const related = grouped.get(id) ?? [];
    const record: BenacoBillingRecord | undefined = billing.get(id);
    const intervals = termIntervals(related);
    const paidTerm = related.some(
      (deal) => deal.benaco_hosting_start && number(deal.benaco_contracted_fee),
    );
    const lossOnly =
      LOSS_ONLY_TOURS.has(id) &&
      !paidTerm &&
      intervals.every(([, after]) => after - DAY <= LOSS_CONFIRMATION_DATE);
    const knownCounts = related
      .map((deal) => number(deal.benaco_counted_grid_panos))
      .filter((count): count is number => count !== null);
    const grid =
      related
        .map((deal) => number(deal.benaco_counted_grid_panos))
        .find((count) => count !== null) ??
      (record && record.gridPanos > 0 ? record.gridPanos : null);
    const starts = related
      .flatMap((deal) => [time(deal.benaco_hosting_start), time(deal.benaco_comp_start)])
      .filter((value): value is number => value !== null);
    // A recorded charge can anchor an unsold tour even when HubSpot has no dates.
    const start = starts.length ? Math.min(...starts) : time(record?.created);
    const billedThrough = record ? time(record.created)! + record.billedDays * DAY : null;
    // Historical charges are already captured once by the workbook. Only model
    // uncovered days after their coverage ends, not a second full-term charge.
    // Walk the terms in order so overlapping terms never count a day twice, and book each term's
    // uncovered days at that term's own start. The removal date is the last hosted day: no cost
    // is estimated after it, even for a term that HubSpot still shows later.
    const removed = time(record?.removedOn);
    const hostedUntil = removed === null ? Infinity : removed + DAY;
    let covered = billedThrough ?? -Infinity;
    const estimatePieces: BenacoEstimatePiece[] = [];
    if (!lossOnly) {
      for (const [from, after] of intervals) {
        const end = Math.min(after, hostedUntil);
        const begin = Math.max(from, covered);
        const days = Math.max(0, end - begin) / DAY;
        if (days > 0) {
          const cost = grid === null ? 0 : (grid * BENACO_VERIFIED_ANNUAL_GRID_RATE * days) / 365;
          estimatePieces.push({ start: isoDay(from), days, cost });
        }
        covered = Math.max(covered, end);
      }
    }
    const remainingDays = estimatePieces.reduce((sum, piece) => sum + piece.days, 0);
    const estimatedPanoCost = estimatePieces.reduce((sum, piece) => sum + piece.cost, 0);
    const recordedPanoCost = record?.panoCost ?? 0;
    const incompleteTerm = related.some(
      (deal) =>
        incompleteInterval(deal.benaco_hosting_start, deal.benaco_hosting_end) ||
        incompleteInterval(deal.benaco_comp_start, deal.benaco_comp_end) ||
        // A contracted fee with no paid start cannot be booked as revenue. (A fee with only
        // complimentary dates is treated as complimentary hosting, matching the source checks.)
        ((number(deal.benaco_contracted_fee) ?? 0) > 0 &&
          !deal.benaco_hosting_start &&
          !deal.benaco_comp_start),
    );
    return {
      tourId: id,
      name: related[0]?.site_name ?? related[0]?.deal_name ?? record?.name ?? id,
      start: start === null ? null : new Date(start).toISOString().slice(0, 10),
      recordedPanoCost,
      estimatedPanoCost,
      estimatePieces,
      recordedCoverage: record ? { start: record.created, days: record.billedDays } : null,
      totalPanoCost: recordedPanoCost + estimatedPanoCost,
      missingInputs:
        !lossOnly &&
        !record?.removedOn &&
        (incompleteTerm ||
          (!record && intervals.length === 0) ||
          new Set(knownCounts).size > 1 ||
          (remainingDays > 0 && grid === null)),
    };
  });
}
