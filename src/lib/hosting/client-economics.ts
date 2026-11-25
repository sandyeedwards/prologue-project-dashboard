/**
 * Per-client hosting economics at today's rates: what each client's current hosting pays per
 * year against what it costs per year to host.
 *
 * - Revenue: each active paid term's contracted fee, as a yearly rate (fee x 365 / term days,
 *   end date inclusive). Complimentary terms earn nothing.
 * - IVION cost: NavVis is billed per instance, not per site, so recorded NavVis hosting bills
 *   since the report start are averaged per month and shared across today's active IVION panos
 *   (an allocation, not an invoice).
 * - Benaco cost: each active tour's grid panos x the Benaco annual grid rate, plus an equal
 *   share of the company subscription. A tour shared by several deals counts once.
 */
import { BENACO_VERIFIED_ANNUAL_GRID_RATE, benacoTourId } from "./benaco-billing-history";
import { IVION_INVOICE_COVERAGE_END, ivionInvoiceCostBetween } from "./ivion-invoice-history";
import { HOSTING_REPORT_START } from "./report-start";
import { benacoPanoBasis, type HostingDealRow, type HostingView } from "./reporting";
import { easternIsoDate } from "@/lib/reporting/format";

const DAY = 86_400_000;
const BENACO_ANNUAL_SUBSCRIPTION = 1200;

// Fallback only, for deals with no associated HubSpot company: deal names end with an
// inconsistent client abbreviation ("3N", "3north", "3North"), so known spellings are merged.
const CLIENT_ALIASES: Record<string, string> = {
  "3n": "3North",
  "3north": "3North",
  peregrinehg: "Peregrine HG",
  arthurdesign: "Arthur Design Co",
  arthurdesignco: "Arthur Design Co",
  pinehurst: "Pinehurst",
  pinehurstcc: "Pinehurst",
  pinehurstresort: "Pinehurst",
  qe: "Quinn Evans",
  quinnevans: "Quinn Evans",
  jhgi: "JHGI",
  historicalconcepts: "Historical Concepts",
  vmdo: "VMDO",
  ferrisarch: "Roger Ferris + Partners",
  rogerferrispartners: "Roger Ferris + Partners",
  bdt: "BDT",
  bdtmsd: "BDT",
};

export const UNNAMED_CLIENT = "No company in HubSpot";

const aliasKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The client for a deal: its associated HubSpot company. Without one, the last " - " part of
 * the deal name, then the contact's email domain.
 */
export function hostingClientName(
  deal: Pick<HostingDealRow, "deal_name" | "hosting_communications_contact" | "company_name">,
): string {
  const company = deal.company_name?.trim();
  if (company) return company;
  const parts = (deal.deal_name ?? "").split(" - ").map((part) => part.trim());
  const domain = deal.hosting_communications_contact?.match(/@([\w.-]+)/)?.[1];
  const raw =
    parts.length >= 3 && parts.at(-1)
      ? parts.at(-1)!
      : domain
        ? domain.replace(/\.(com|net|org|edu|us|co)$/i, "")
        : UNNAMED_CLIENT;
  return CLIENT_ALIASES[aliasKey(raw)] ?? raw;
}

function day(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const parsed =
    value instanceof Date ? value.getTime() : Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type Term = { start: number; end: number; days: number };

function activeTerm(
  start: string | Date | null,
  end: string | Date | null,
  today: number,
): Term | null {
  const from = day(start);
  const to = day(end);
  if (from === null || to === null || to < from || from > today || to < today) return null;
  return { start: from, end: to, days: Math.round((to - from) / DAY) + 1 };
}

export type HostingClientEconomics = {
  client: string;
  paidSites: number;
  complimentarySites: number;
  ivionPanos: number;
  complimentaryPanos: number;
  benacoTours: number;
  annualRevenue: number;
  annualIvionCost: number;
  annualBenacoCost: number;
  annualCost: number;
  annualMargin: number;
  /**
   * Every active term is complimentary: the hosting is included in the client's scanning fees,
   * so its cost is not a loss on a hosting sale. The cost still counts in the totals.
   */
  includedInScanning: boolean;
};

export type HostingClientEconomicsSummary = {
  clients: HostingClientEconomics[];
  totals: Omit<HostingClientEconomics, "client" | "includedInScanning">;
  ivionCostPerPanoMonth: number;
  ivionBilledMonths: number;
};

function monthsBetween(startIso: string, endMonth: string): number {
  const [startYear, startMonth] = startIso.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  return Math.max(0, (endYear - startYear) * 12 + (endMonthNumber - startMonth) + 1);
}

export function hostingClientEconomics(
  deals: HostingDealRow[],
  view: HostingView = "combined",
  today: Date = new Date(),
): HostingClientEconomicsSummary {
  const todayTime = day(easternIsoDate(today))!; // the Eastern business day, as elsewhere
  const includeIvion = view !== "benaco";
  const includeBenaco = view !== "ivion";

  // Average monthly NavVis hosting bill over the loaded invoice months since the report start.
  const ivionBilledMonths = monthsBetween(HOSTING_REPORT_START, IVION_INVOICE_COVERAGE_END);
  const coverageEnd = new Date(`${IVION_INVOICE_COVERAGE_END}-01T00:00:00Z`);
  coverageEnd.setUTCMonth(coverageEnd.getUTCMonth() + 1);
  const ivionMonthlyBill = ivionBilledMonths
    ? ivionInvoiceCostBetween(new Date(`${HOSTING_REPORT_START}T00:00:00Z`), coverageEnd) /
      ivionBilledMonths
    : 0;

  const byClient = new Map<string, HostingClientEconomics>();
  const entry = (client: string) => {
    let row = byClient.get(client);
    if (!row) {
      row = {
        client,
        paidSites: 0,
        complimentarySites: 0,
        ivionPanos: 0,
        complimentaryPanos: 0,
        benacoTours: 0,
        annualRevenue: 0,
        annualIvionCost: 0,
        annualBenacoCost: 0,
        annualCost: 0,
        annualMargin: 0,
        includedInScanning: false,
      };
      byClient.set(client, row);
    }
    return row;
  };

  const ivionSites: Array<{ client: string; panos: number }> = [];
  const benacoTours = new Map<string, { client: string; grid: number }>();
  const clientsWithPaidTerms = new Set<string>();

  for (const deal of deals) {
    const client = hostingClientName(deal);
    if (includeIvion) {
      const paid = activeTerm(deal.ivion_hosting_start, deal.ivion_hosting_end, todayTime);
      const complimentary = activeTerm(deal.ivion_comp_start, deal.ivion_comp_end, todayTime);
      if (paid || complimentary) {
        const row = entry(client);
        const panos = amount(deal.ivion_active_panos);
        ivionSites.push({ client, panos });
        row.ivionPanos += panos;
        if (paid) {
          clientsWithPaidTerms.add(client);
          row.paidSites += 1;
          row.annualRevenue += (amount(deal.ivion_contracted_fee) * 365) / paid.days;
        } else {
          row.complimentarySites += 1;
          row.complimentaryPanos += panos;
        }
      }
    }
    if (includeBenaco) {
      const paid = activeTerm(deal.benaco_hosting_start, deal.benaco_hosting_end, todayTime);
      const complimentary = activeTerm(deal.benaco_comp_start, deal.benaco_comp_end, todayTime);
      if (paid || complimentary) {
        const row = entry(client);
        if (paid) {
          clientsWithPaidTerms.add(client);
          row.annualRevenue += (amount(deal.benaco_contracted_fee) * 365) / paid.days;
        }
        const tour = benacoTourId(deal.benaco_url) ?? `deal:${deal.hubspot_deal_id}`;
        if (!benacoTours.has(tour)) {
          // HubSpot Counted Grid-Pano, otherwise the matched billing record, as in the report.
          benacoTours.set(tour, { client, grid: benacoPanoBasis(deal).count });
        }
      }
    }
  }

  const activePanos = ivionSites.reduce((sum, site) => sum + site.panos, 0);
  const ivionCostPerPanoMonth = activePanos ? ivionMonthlyBill / activePanos : 0;
  for (const site of ivionSites) {
    entry(site.client).annualIvionCost += site.panos * ivionCostPerPanoMonth * 12;
  }
  const subscriptionShare = benacoTours.size ? BENACO_ANNUAL_SUBSCRIPTION / benacoTours.size : 0;
  for (const tour of benacoTours.values()) {
    const row = entry(tour.client);
    row.benacoTours += 1;
    row.annualBenacoCost += tour.grid * BENACO_VERIFIED_ANNUAL_GRID_RATE + subscriptionShare;
  }

  const clients = [...byClient.values()]
    .map((row) => {
      const annualCost = row.annualIvionCost + row.annualBenacoCost;
      return {
        ...row,
        annualCost,
        annualMargin: row.annualRevenue - annualCost,
        includedInScanning: !clientsWithPaidTerms.has(row.client),
      };
    })
    .sort(
      (left, right) =>
        right.annualRevenue - left.annualRevenue || left.annualMargin - right.annualMargin,
    );

  const totals = clients.reduce(
    (sum, row) => ({
      paidSites: sum.paidSites + row.paidSites,
      complimentarySites: sum.complimentarySites + row.complimentarySites,
      ivionPanos: sum.ivionPanos + row.ivionPanos,
      complimentaryPanos: sum.complimentaryPanos + row.complimentaryPanos,
      benacoTours: sum.benacoTours + row.benacoTours,
      annualRevenue: sum.annualRevenue + row.annualRevenue,
      annualIvionCost: sum.annualIvionCost + row.annualIvionCost,
      annualBenacoCost: sum.annualBenacoCost + row.annualBenacoCost,
      annualCost: sum.annualCost + row.annualCost,
      annualMargin: sum.annualMargin + row.annualMargin,
    }),
    {
      paidSites: 0,
      complimentarySites: 0,
      ivionPanos: 0,
      complimentaryPanos: 0,
      benacoTours: 0,
      annualRevenue: 0,
      annualIvionCost: 0,
      annualBenacoCost: 0,
      annualCost: 0,
      annualMargin: 0,
    },
  );

  return { clients, totals, ivionCostPerPanoMonth, ivionBilledMonths };
}
