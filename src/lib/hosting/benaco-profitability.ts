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

export type BenacoCostCommitment = {
  tourId: string;
  name: string;
  start: string | null;
  recordedPanoCost: number;
  estimatedPanoCost: number;
  totalPanoCost: number;
  missingInputs: boolean;
};

function number(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function incompleteInterval(start: string | null, end: string | null): boolean {
  if (!start) return false;
  const from = time(start),
    to = time(end);
  // A same-day complimentary placeholder contributes zero days, not an error.
  return from === null || to === null || to < from;
}

function termIntervals(deals: readonly HostingDealRow[]): Array<[number, number]> {
  const intervals = deals
    .flatMap((deal) => [
      [time(deal.benaco_hosting_start), time(deal.benaco_hosting_end)],
      [time(deal.benaco_comp_start), time(deal.benaco_comp_end)],
    ])
    .filter(
      (pair): pair is [number, number] => pair[0] !== null && pair[1] !== null && pair[1] > pair[0],
    )
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
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
      intervals.every(([, to]) => to <= LOSS_CONFIRMATION_DATE);
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
    const removed = time(record?.removedOn);
    const remainingDays = lossOnly
      ? 0
      : intervals.reduce((sum, [from, to]) => {
          const end = removed !== null && from <= removed ? Math.min(to, removed) : to;
          return sum + Math.max(0, end - Math.max(from, billedThrough ?? from)) / DAY;
        }, 0);
    const estimatedPanoCost =
      grid === null ? 0 : (grid * BENACO_VERIFIED_ANNUAL_GRID_RATE * remainingDays) / 365;
    const recordedPanoCost = record?.panoCost ?? 0;
    const incompleteTerm = related.some(
      (deal) =>
        incompleteInterval(deal.benaco_hosting_start, deal.benaco_hosting_end) ||
        incompleteInterval(deal.benaco_comp_start, deal.benaco_comp_end),
    );
    return {
      tourId: id,
      name: related[0]?.site_name ?? related[0]?.deal_name ?? record?.name ?? id,
      start: start === null ? null : new Date(start).toISOString().slice(0, 10),
      recordedPanoCost,
      estimatedPanoCost,
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
