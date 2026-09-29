import { getSqlClient } from "@/db/client";

export type HostingGrouping = "month" | "quarter" | "half" | "year";
export type HostingView = "combined" | "ivion" | "benaco";
export type HostingRange = "12m" | "ytd" | "prior-year" | "all" | "custom";

export const BENACO_MONTHLY_OVERHEAD = 100;
export const BENACO_ANNUAL_PANO_COST = 0.38;
export const BENACO_GRID_ESTIMATE_RATE = 0.28;
export const BENACO_SUBSCRIPTION_START = "2023-09-01";

const DAY_MS = 24 * 60 * 60 * 1000;

export type HostingDealRow = {
  id: string;
  hubspot_deal_id: string;
  deal_name: string | null;
  site_name: string | null;
  hubspot_url: string | null;
  ivion_instance: string | null;
  ivion_hosting_start: string | null;
  ivion_hosting_end: string | null;
  ivion_contracted_fee: string | number | null;
  ivion_total_panos: string | number | null;
  ivion_active_panos: string | number | null;
  ivion_comp_start: string | null;
  ivion_comp_end: string | null;
  ivion_calculated_quarterly_fee: string | number | null;
  ivion_contracted_quarterly_fee: string | number | null;
  ivion_date_added: string | null;
  ivion_date_sent_to_client: string | null;
  ivion_bundle_archive_date: string | null;
  benaco_hosting_start: string | null;
  benaco_hosting_end: string | null;
  benaco_contracted_fee: string | number | null;
  benaco_total_panos: string | number | null;
  benaco_comp_start: string | null;
  benaco_comp_end: string | null;
  benaco_url: string | null;
  benaco_calculated_cost: string | number | null;
  benaco_annual_fee: string | number | null;
  hosting_notes: string | null;
  hosting_communications_contact: string | null;
};

export type HostingIvionSite = {
  id: string;
  label: string;
  url: string;
  started_on: string | Date | null;
  ended_on: string | Date | null;
  is_active: boolean;
  sort_order: number;
  cost_history: Array<{
    effective_on: string | Date;
    annual_cost: string | number;
  }>;
};

export type HostingReportRow = {
  period: string;
  periodStart: string;
  periodEnd: string;
  forecast: boolean;
  revenue: number;
  costs: number;
  netProfit: number;
  ivionRevenue: number;
  ivionCost: number;
  ivionNet: number;
  benacoRevenue: number;
  benacoOverhead: number;
  benacoPanoCosts: number;
  benacoEstimatedPanoCosts: number;
  benacoCost: number;
  benacoNet: number;
};

export type HostingSyncRun = {
  id: string;
  kind: string;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  records_read: number;
  records_upserted: number;
  records_removed_from_segment: number;
  warnings: number;
  errors: number;
  message: string | null;
};

type Period = {
  key: string;
  start: Date;
  endExclusive: Date;
  forecast: boolean;
};

type ReportBounds = {
  start: Date;
  endExclusive: Date;
};

export type BenacoPanoBasis = {
  count: number;
  source: "actual" | "estimated" | "missing";
};

function numeric(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function utcDate(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month, day));
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function startOfPeriod(value: Date, grouping: HostingGrouping): Date {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();

  if (grouping === "month") return utcDate(year, month);
  if (grouping === "quarter") return utcDate(year, Math.floor(month / 3) * 3);
  if (grouping === "half") return utcDate(year, month < 6 ? 0 : 6);
  return utcDate(year, 0);
}

function addMonths(value: Date, months: number): Date {
  return utcDate(value.getUTCFullYear(), value.getUTCMonth() + months);
}

function addPeriod(value: Date, grouping: HostingGrouping): Date {
  if (grouping === "month") return addMonths(value, 1);
  if (grouping === "quarter") return addMonths(value, 3);
  if (grouping === "half") return addMonths(value, 6);
  return utcDate(value.getUTCFullYear() + 1, value.getUTCMonth());
}

function periodLabel(value: Date, grouping: HostingGrouping): string {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();

  if (grouping === "month") return `${year}-${String(month + 1).padStart(2, "0")}`;
  if (grouping === "quarter") return `${year} Q${Math.floor(month / 3) + 1}`;
  if (grouping === "half") return `${year} H${month < 6 ? 1 : 2}`;
  return String(year);
}

function periodFraction(grouping: HostingGrouping): number {
  if (grouping === "month") return 1 / 12;
  if (grouping === "quarter") return 1 / 4;
  if (grouping === "half") return 1 / 2;
  return 1;
}

function defaultReportBounds(grouping: HostingGrouping, referenceDate: Date): ReportBounds {
  const current = startOfPeriod(referenceDate, grouping);
  const start =
    grouping === "year"
      ? utcDate(current.getUTCFullYear() - 1, 0)
      : grouping === "half"
        ? addMonths(current, -12)
        : grouping === "quarter"
          ? addMonths(current, -9)
          : addMonths(current, -11);
  const endExclusive =
    grouping === "year"
      ? utcDate(current.getUTCFullYear() + 2, 0)
      : grouping === "half"
        ? addMonths(current, 18)
        : grouping === "quarter"
          ? addMonths(current, 9)
          : addMonths(current, 7);

  return { start, endExclusive };
}

function futureReportEnd(grouping: HostingGrouping, referenceDate: Date): Date {
  const current = startOfPeriod(referenceDate, grouping);
  if (grouping === "month") return addMonths(current, 7);
  if (grouping === "quarter") return addMonths(current, 9);
  if (grouping === "half") return addMonths(current, 18);
  return utcDate(current.getUTCFullYear() + 2, 0);
}

function parsedCustomBounds(
  grouping: HostingGrouping,
  from: string | null | undefined,
  to: string | null | undefined,
): ReportBounds | null {
  const parsedFrom = dateValue(from);
  const parsedTo = dateValue(to);
  if (!parsedFrom || !parsedTo || parsedTo.getTime() < parsedFrom.getTime()) return null;
  return {
    start: startOfPeriod(parsedFrom, grouping),
    endExclusive: addPeriod(startOfPeriod(parsedTo, grouping), grouping),
  };
}

function reportBounds(
  grouping: HostingGrouping,
  range: HostingRange,
  referenceDate: Date,
  custom: { from?: string | null; to?: string | null } = {},
  earliestDate = dateValue(BENACO_SUBSCRIPTION_START)!,
): ReportBounds {
  if (range === "custom") {
    return (
      parsedCustomBounds(grouping, custom.from, custom.to) ??
      defaultReportBounds(grouping, referenceDate)
    );
  }
  if (range === "all") {
    return {
      start: startOfPeriod(earliestDate, grouping),
      endExclusive: futureReportEnd(grouping, referenceDate),
    };
  }
  if (range === "ytd") {
    return {
      start: startOfPeriod(utcDate(referenceDate.getUTCFullYear(), 0), grouping),
      endExclusive: futureReportEnd(grouping, referenceDate),
    };
  }
  if (range === "prior-year") {
    return {
      start: startOfPeriod(utcDate(referenceDate.getUTCFullYear() - 1, 0), grouping),
      endExclusive: utcDate(referenceDate.getUTCFullYear(), 0),
    };
  }
  return defaultReportBounds(grouping, referenceDate);
}

function earliestReportDate(deals: HostingDealRow[], sites: HostingIvionSite[]): Date {
  const candidates: Date[] = [dateValue(BENACO_SUBSCRIPTION_START)!];
  for (const deal of deals) {
    for (const value of [
      deal.ivion_hosting_start,
      deal.ivion_comp_start,
      deal.benaco_hosting_start,
      deal.benaco_comp_start,
    ]) {
      const parsed = dateValue(value);
      if (parsed) candidates.push(parsed);
    }
  }
  for (const site of sites) {
    const parsed = dateValue(site.started_on);
    if (parsed) candidates.push(parsed);
    for (const history of site.cost_history) {
      const effectiveOn = dateValue(history.effective_on);
      if (effectiveOn) candidates.push(effectiveOn);
    }
  }
  return candidates.reduce((earliest, candidate) =>
    candidate.getTime() < earliest.getTime() ? candidate : earliest,
  );
}

export function makeHostingPeriods(
  grouping: HostingGrouping,
  referenceDate = new Date(),
  bounds = defaultReportBounds(grouping, referenceDate),
): Period[] {
  let cursor = startOfPeriod(bounds.start, grouping);
  const periods: Period[] = [];

  while (cursor.getTime() < bounds.endExclusive.getTime()) {
    const endExclusive = addPeriod(cursor, grouping);
    periods.push({
      key: periodLabel(cursor, grouping),
      start: cursor,
      endExclusive,
      forecast: cursor.getTime() > referenceDate.getTime(),
    });
    cursor = endExclusive;
  }

  return periods;
}

function overlaps(start: Date | null, end: Date | null, period: Period): boolean {
  if (!start) return false;
  if (end && start.getTime() >= end.getTime()) return false;
  return (
    start.getTime() < period.endExclusive.getTime() &&
    (!end || end.getTime() > period.start.getTime())
  );
}

function countTouchedPeriods(
  start: Date | null,
  end: Date | null,
  grouping: HostingGrouping,
): number {
  if (!start || !end || start.getTime() >= end.getTime()) return 0;

  let cursor = startOfPeriod(start, grouping);
  let count = 0;

  while (cursor.getTime() < end.getTime()) {
    if (
      overlaps(start, end, {
        key: "",
        start: cursor,
        endExclusive: addPeriod(cursor, grouping),
        forecast: false,
      })
    ) {
      count += 1;
    }
    cursor = addPeriod(cursor, grouping);
  }

  return count;
}

function allocatedRevenue(
  fee: number,
  start: Date | null,
  end: Date | null,
  period: Period,
  grouping: HostingGrouping,
): number {
  if (!fee || !end || !overlaps(start, end, period)) return 0;
  const touchedPeriods = countTouchedPeriods(start, end, grouping);
  return touchedPeriods ? fee / touchedPeriods : 0;
}

function overlapInterval(
  start: Date | null,
  end: Date | null,
  period: Period,
): { start: number; end: number } | null {
  if (!overlaps(start, end, period) || !start) return null;
  const overlapStart = Math.max(start.getTime(), period.start.getTime());
  const overlapEnd = Math.min(
    end?.getTime() ?? period.endExclusive.getTime(),
    period.endExclusive.getTime(),
  );
  return overlapEnd > overlapStart ? { start: overlapStart, end: overlapEnd } : null;
}

function activeDaysInPeriod(
  intervals: Array<{ start: Date | null; end: Date | null }>,
  period: Period,
): number {
  const overlapsForPeriod = intervals
    .map((interval) => overlapInterval(interval.start, interval.end, period))
    .filter((interval): interval is { start: number; end: number } => interval !== null)
    .sort((left, right) => left.start - right.start);

  if (!overlapsForPeriod.length) return 0;

  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of overlapsForPeriod) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }

  return merged.reduce((sum, interval) => sum + (interval.end - interval.start) / DAY_MS, 0);
}

function subscriptionMonthsInPeriod(period: Period): number {
  const subscriptionStart = dateValue(BENACO_SUBSCRIPTION_START)!;
  if (period.endExclusive.getTime() <= subscriptionStart.getTime()) return 0;

  let cursor = startOfPeriod(
    new Date(Math.max(period.start.getTime(), subscriptionStart.getTime())),
    "month",
  );
  let months = 0;
  while (cursor.getTime() < period.endExclusive.getTime()) {
    if (cursor.getTime() >= subscriptionStart.getTime()) months += 1;
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function siteOverlapsPeriod(site: HostingIvionSite, period: Period): boolean {
  const startedOn = dateValue(site.started_on) ?? utcDate(1900, 0);
  const endedOn = dateValue(site.ended_on);
  if (startedOn.getTime() >= period.endExclusive.getTime()) return false;
  return !endedOn || endedOn.getTime() > period.start.getTime();
}

function annualSiteCost(site: HostingIvionSite, period: Period): number {
  const histories = [...site.cost_history]
    .map((history) => ({
      effectiveOn: dateValue(history.effective_on),
      annualCost: numeric(history.annual_cost),
    }))
    .filter(
      (history): history is { effectiveOn: Date; annualCost: number } =>
        history.effectiveOn !== null,
    )
    .sort((left, right) => left.effectiveOn.getTime() - right.effectiveOn.getTime());

  if (!histories.length) return 0;
  const applicable = histories.filter(
    (history) => history.effectiveOn.getTime() <= period.start.getTime(),
  );
  return applicable.at(-1)?.annualCost ?? histories[0].annualCost;
}

export function benacoPanoBasis(deal: HostingDealRow): BenacoPanoBasis {
  const countedGridPanos = numeric(deal.ivion_total_panos);
  if (countedGridPanos > 0) return { count: countedGridPanos, source: "actual" };

  const totalPanos = numeric(deal.benaco_total_panos);
  if (totalPanos > 0) {
    return { count: totalPanos * BENACO_GRID_ESTIMATE_RATE, source: "estimated" };
  }

  return { count: 0, source: "missing" };
}

export function hasIvionHosting(deal: HostingDealRow): boolean {
  return Boolean(
    deal.ivion_instance ||
    deal.ivion_hosting_start ||
    deal.ivion_comp_start ||
    numeric(deal.ivion_contracted_fee),
  );
}

export function hasBenacoHosting(deal: HostingDealRow): boolean {
  return Boolean(
    deal.benaco_url ||
    deal.benaco_hosting_start ||
    deal.benaco_comp_start ||
    numeric(deal.benaco_contracted_fee) ||
    numeric(deal.benaco_total_panos),
  );
}

export function buildHostingReport(
  deals: HostingDealRow[],
  grouping: HostingGrouping,
  ivionSites: HostingIvionSite[],
  referenceDate = new Date(),
  range: HostingRange = "12m",
  customRange: { from?: string | null; to?: string | null } = {},
): HostingReportRow[] {
  const bounds = reportBounds(
    grouping,
    range,
    referenceDate,
    customRange,
    earliestReportDate(deals, ivionSites),
  );

  return makeHostingPeriods(grouping, referenceDate, bounds).map((period) => {
    let ivionRevenue = 0;
    let benacoRevenue = 0;
    let benacoPanoCosts = 0;
    let benacoEstimatedPanoCosts = 0;

    for (const deal of deals) {
      const ivionStart = dateValue(deal.ivion_hosting_start);
      const ivionEnd = dateValue(deal.ivion_hosting_end);
      const benacoStart = dateValue(deal.benaco_hosting_start);
      const benacoEnd = dateValue(deal.benaco_hosting_end);

      ivionRevenue += allocatedRevenue(
        numeric(deal.ivion_contracted_fee),
        ivionStart,
        ivionEnd,
        period,
        grouping,
      );
      benacoRevenue += allocatedRevenue(
        numeric(deal.benaco_contracted_fee),
        benacoStart,
        benacoEnd,
        period,
        grouping,
      );

      if (hasBenacoHosting(deal)) {
        const activeDays = activeDaysInPeriod(
          [
            { start: benacoStart, end: benacoEnd },
            { start: dateValue(deal.benaco_comp_start), end: dateValue(deal.benaco_comp_end) },
          ],
          period,
        );
        const basis = benacoPanoBasis(deal);
        const panoCost = basis.count * (BENACO_ANNUAL_PANO_COST / 365) * activeDays;
        benacoPanoCosts += panoCost;
        if (basis.source === "estimated") benacoEstimatedPanoCosts += panoCost;
      }
    }

    const ivionCost = ivionSites.reduce((sum, site) => {
      if (!site.is_active && !site.ended_on) return sum;
      if (!siteOverlapsPeriod(site, period)) return sum;
      return sum + annualSiteCost(site, period) * periodFraction(grouping);
    }, 0);
    const benacoOverhead = subscriptionMonthsInPeriod(period) * BENACO_MONTHLY_OVERHEAD;
    const benacoCost = benacoOverhead + benacoPanoCosts;
    const revenue = ivionRevenue + benacoRevenue;
    const costs = ivionCost + benacoCost;

    return {
      period: period.key,
      periodStart: isoDate(period.start),
      periodEnd: isoDate(addDays(period.endExclusive, -1)),
      forecast: period.forecast,
      revenue,
      costs,
      netProfit: revenue - costs,
      ivionRevenue,
      ivionCost,
      ivionNet: ivionRevenue - ivionCost,
      benacoRevenue,
      benacoOverhead,
      benacoPanoCosts,
      benacoEstimatedPanoCosts,
      benacoCost,
      benacoNet: benacoRevenue - benacoCost,
    };
  });
}

function includesDate(start: string | null, end: string | null, target: Date): boolean {
  const parsedStart = dateValue(start);
  const parsedEnd = dateValue(end);
  if (!parsedStart) return false;
  const targetDay = utcDate(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return (
    targetDay.getTime() >= parsedStart.getTime() &&
    (!parsedEnd || targetDay.getTime() < parsedEnd.getTime())
  );
}

export function isHostingDealActiveOn(deal: HostingDealRow, target = new Date()): boolean {
  return (
    includesDate(deal.ivion_hosting_start, deal.ivion_hosting_end, target) ||
    includesDate(deal.ivion_comp_start, deal.ivion_comp_end, target) ||
    includesDate(deal.benaco_hosting_start, deal.benaco_hosting_end, target) ||
    includesDate(deal.benaco_comp_start, deal.benaco_comp_end, target)
  );
}

export function hostingRowForView(
  row: HostingReportRow,
  view: HostingView,
): Pick<HostingReportRow, "revenue" | "costs" | "netProfit"> {
  if (view === "ivion") {
    return { revenue: row.ivionRevenue, costs: row.ivionCost, netProfit: row.ivionNet };
  }
  if (view === "benaco") {
    return { revenue: row.benacoRevenue, costs: row.benacoCost, netProfit: row.benacoNet };
  }
  return { revenue: row.revenue, costs: row.costs, netProfit: row.netProfit };
}

export async function getHostingDashboardData({
  grouping,
  range,
  dateFrom,
  dateTo,
}: {
  grouping: HostingGrouping;
  range: HostingRange;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const sql = getSqlClient();
  const [deals, sites, syncRuns] = await Promise.all([
    sql<HostingDealRow[]>`
      select
        id,
        hubspot_deal_id,
        deal_name,
        site_name,
        hubspot_url,
        ivion_instance,
        ivion_hosting_start,
        ivion_hosting_end,
        ivion_contracted_fee,
        ivion_total_panos,
        ivion_active_panos,
        ivion_comp_start,
        ivion_comp_end,
        ivion_calculated_quarterly_fee,
        ivion_contracted_quarterly_fee,
        ivion_date_added,
        ivion_date_sent_to_client,
        ivion_bundle_archive_date,
        benaco_hosting_start,
        benaco_hosting_end,
        benaco_contracted_fee,
        benaco_total_panos,
        benaco_comp_start,
        benaco_comp_end,
        benaco_url,
        benaco_calculated_cost,
        benaco_annual_fee,
        hosting_notes,
        hosting_communications_contact
      from hosting_deals
      where is_in_all_hosting_records = true
      order by coalesce(site_name, deal_name, hubspot_deal_id)
    `,
    sql<HostingIvionSite[]>`
      select
        site.id,
        site.label,
        site.url,
        site.started_on,
        site.ended_on,
        site.is_active,
        site.sort_order,
        coalesce(
          json_agg(
            json_build_object(
              'effective_on', cost.effective_on,
              'annual_cost', cost.annual_cost
            ) order by cost.effective_on
          ) filter (where cost.id is not null),
          '[]'::json
        ) as cost_history
      from hosting_ivion_sites site
      left join hosting_ivion_site_cost_history cost on cost.site_id = site.id
      group by site.id
      order by site.sort_order, site.label
    `,
    sql<HostingSyncRun[]>`
      select
        id,
        kind,
        status,
        started_at,
        completed_at,
        records_read,
        records_upserted,
        records_removed_from_segment,
        warnings,
        errors,
        message
      from hosting_sync_runs
      order by started_at desc
      limit 10
    `,
  ]);

  const referenceDate = new Date();
  const dealRows = [...deals];
  const siteRows = [...sites];
  const bounds = reportBounds(
    grouping,
    range,
    referenceDate,
    { from: dateFrom, to: dateTo },
    earliestReportDate(dealRows, siteRows),
  );

  return {
    deals: dealRows,
    ivionSites: siteRows,
    syncRuns: [...syncRuns],
    report: buildHostingReport(dealRows, grouping, siteRows, referenceDate, range, {
      from: dateFrom,
      to: dateTo,
    }),
    range: {
      from: isoDate(bounds.start),
      to: isoDate(addDays(bounds.endExclusive, -1)),
    },
  };
}
