import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { HostingFinancialChart } from "@/components/hosting-financial-chart";
import { HostingSyncControl } from "@/components/hosting-sync-control";
import { requireUser } from "@/lib/auth/session";
import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_ANNUAL_OVERHEAD,
  BENACO_GRID_ESTIMATE_RATE,
  BENACO_MONTHLY_OVERHEAD,
  BENACO_2024_CATCH_UP_TOTAL,
  BENACO_SUBSCRIPTION_START,
  benacoBillCostPerActivePano,
  benacoPanoBasis,
  filterHostingDeals,
  getHostingDashboardData,
  hasBenacoHosting,
  hasIvionHosting,
  hostingDealTermSummary,
  hostingRowForView,
  isHostingDealActiveOn,
  isHostingTermExpired,
  type HostingDealRow,
  type HostingDealFeeFilter,
  type HostingDealPlatformFilter,
  type HostingDealTermFilter,
  type HostingGrouping,
  type HostingRange,
  type HostingView,
} from "@/lib/hosting/reporting";
import { saveBenacoMonthlyBill } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const groupings: Array<{ value: HostingGrouping; label: string }> = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half", label: "Half-year" },
  { value: "year", label: "Annual" },
];

const ranges: Array<{ value: HostingRange; label: string }> = [
  { value: "12m", label: "Rolling 12 months" },
  { value: "all", label: "All available history" },
  { value: "ytd", label: "Year to date" },
  { value: "prior-year", label: "Previous calendar year" },
  { value: "custom", label: "Custom dates" },
];

const views: Array<{ value: HostingView; label: string }> = [
  { value: "combined", label: "Combined" },
  { value: "ivion", label: "IVION" },
  { value: "benaco", label: "Benaco" },
];

const dealPlatformFilters: Array<{ value: HostingDealPlatformFilter; label: string }> = [
  { value: "all", label: "All platforms" },
  { value: "ivion", label: "IVION" },
  { value: "benaco", label: "Benaco" },
  { value: "both", label: "IVION + Benaco" },
];

const dealTermFilters: Array<{ value: HostingDealTermFilter; label: string }> = [
  { value: "all", label: "Any term status" },
  { value: "current", label: "Current / upcoming" },
  { value: "expired", label: "Expired" },
  { value: "missing", label: "No term dates" },
];

const dealFeeFilters: Array<{ value: HostingDealFeeFilter; label: string }> = [
  { value: "all", label: "Any contracted fee" },
  { value: "with-fee", label: "Fee above $0" },
  { value: "no-fee", label: "$0 or missing" },
];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function selectedGrouping(value: string | undefined): HostingGrouping {
  return groupings.some((option) => option.value === value) ? (value as HostingGrouping) : "month";
}

function selectedRange(value: string | undefined): HostingRange {
  return ranges.some((option) => option.value === value) ? (value as HostingRange) : "12m";
}

function selectedForecast(value: string | undefined): boolean {
  return value === "show";
}

function selectedView(value: string | undefined): HostingView {
  return views.some((option) => option.value === value) ? (value as HostingView) : "combined";
}

function selectedDealPlatform(value: string | undefined): HostingDealPlatformFilter {
  return dealPlatformFilters.some((option) => option.value === value)
    ? (value as HostingDealPlatformFilter)
    : "all";
}

function selectedDealTerm(value: string | undefined): HostingDealTermFilter {
  return dealTermFilters.some((option) => option.value === value)
    ? (value as HostingDealTermFilter)
    : "all";
}

function selectedDealFee(value: string | undefined): HostingDealFeeFilter {
  return dealFeeFilters.some((option) => option.value === value)
    ? (value as HostingDealFeeFilter)
    : "all";
}

function currency(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function wholePercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value * 100)}%`;
}

function optionalCurrency(value: string | number | null, digits = 0): string {
  if (value === null || value === "") return "Not available";
  return currency(Number(value), digits);
}

function optionalNumber(value: string | number | null): string {
  if (value === null || value === "") return "Not available";
  return number(Number(value));
}

function dateLabel(value: Date | string | null): string {
  if (!value) return "Not available";
  const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function dateTimeLabel(value: Date | string | null): string {
  if (!value) return "Not completed";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function viewHref({
  grouping,
  view,
  range,
  dateFrom,
  dateTo,
  showForecast,
}: {
  grouping: HostingGrouping;
  view: HostingView;
  range: HostingRange;
  dateFrom?: string;
  dateTo?: string;
  showForecast: boolean;
}): string {
  const params = new URLSearchParams({ grouping, view, range });
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (showForecast) params.set("forecast", "show");
  return `/hosting?${params.toString()}`;
}

function hubspotDealUrl(deal: HostingDealRow): string {
  if (deal.hubspot_url) return deal.hubspot_url;
  const portalId = process.env.HUBSPOT_PORTAL_ID?.trim() || "4953519";
  return `https://app.hubspot.com/contacts/${portalId}/record/0-3/${deal.hubspot_deal_id}`;
}

function latestAnnualCost(
  history: Array<{ effective_on: string | Date; annual_cost: string | number }>,
): number | null {
  const latest = [...history]
    .sort((left, right) => String(left.effective_on).localeCompare(String(right.effective_on)))
    .at(-1);
  if (!latest) return null;
  const value = Number(latest.annual_cost);
  return Number.isFinite(value) ? value : null;
}

function intervalOverlaps(
  start: string | null,
  end: string | null,
  rangeFrom: string,
  rangeTo: string,
): boolean {
  if (!start) return false;
  return start <= rangeTo && (!end || end >= rangeFrom);
}

function dealMatchesRange(
  deal: HostingDealRow,
  view: HostingView,
  rangeFrom: string,
  rangeTo: string,
): boolean {
  const ivionMatches =
    hasIvionHosting(deal) &&
    (intervalOverlaps(deal.ivion_hosting_start, deal.ivion_hosting_end, rangeFrom, rangeTo) ||
      intervalOverlaps(deal.ivion_comp_start, deal.ivion_comp_end, rangeFrom, rangeTo));
  const benacoMatches =
    hasBenacoHosting(deal) &&
    (intervalOverlaps(deal.benaco_hosting_start, deal.benaco_hosting_end, rangeFrom, rangeTo) ||
      intervalOverlaps(deal.benaco_comp_start, deal.benaco_comp_end, rangeFrom, rangeTo));

  if (view === "ivion") return ivionMatches;
  if (view === "benaco") return benacoMatches;
  return ivionMatches || benacoMatches;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hosting-detail-item">
      <dt>{label}</dt>
      <dd>{children || "Not available"}</dd>
    </div>
  );
}

function dateRangeLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "Not available";
  return `${dateLabel(start)} – ${end ? dateLabel(end) : "Ongoing"}`;
}

function termDateRangeLabel(start: string | null, end: string | null): string {
  if (isHostingTermExpired(end)) return "Expired";
  return dateRangeLabel(start, end);
}

export default async function HostingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/hosting");
  const params = await searchParams;
  const grouping = selectedGrouping(one(params.grouping));
  const range = selectedRange(one(params.range));
  const view = selectedView(one(params.view));
  const showForecast = selectedForecast(one(params.forecast));
  const dateFrom = one(params.dateFrom);
  const dateTo = one(params.dateTo);
  const dealQuery = one(params.dealQuery)?.trim().slice(0, 120) ?? "";
  const dealPlatform = selectedDealPlatform(one(params.dealPlatform));
  const dealTerm = selectedDealTerm(one(params.dealTerm));
  const dealFee = selectedDealFee(one(params.dealFee));
  const data = await getHostingDashboardData({ grouping, range, dateFrom, dateTo });
  const latestSync = data.syncRuns[0] ?? null;
  const hasSourceData = Boolean(
    latestSync || data.deals.length || data.ivionSites.length || data.benacoBills.length,
  );
  const actualRows = data.report.filter((row) => !row.forecast);
  const displayedRows = showForecast ? data.report : actualRows;
  const selectedRows = actualRows.map((row) => hostingRowForView(row, view));
  const totals = selectedRows.reduce(
    (sum, row) => ({
      revenue: sum.revenue + row.revenue,
      costs: sum.costs + row.costs,
      netProfit: sum.netProfit + row.netProfit,
    }),
    { revenue: 0, costs: 0, netProfit: 0 },
  );
  const filteredDeals = data.deals.filter((deal) =>
    dealMatchesRange(deal, view, data.range.from, data.range.to),
  );
  const visibleDeals = filterHostingDeals(filteredDeals, {
    query: dealQuery,
    platform: dealPlatform,
    term: dealTerm,
    fee: dealFee,
    view,
  });
  const dealFiltersActive = Boolean(
    dealQuery || dealPlatform !== "all" || dealTerm !== "all" || dealFee !== "all",
  );
  const serviceDeals = data.deals.filter((deal) =>
    view === "ivion"
      ? hasIvionHosting(deal)
      : view === "benaco"
        ? hasBenacoHosting(deal)
        : hasIvionHosting(deal) || hasBenacoHosting(deal),
  );
  const activeDeals = serviceDeals.filter((deal) => isHostingDealActiveOn(deal));
  const ivionDeals = filteredDeals.filter(hasIvionHosting);
  const benacoDeals = filteredDeals.filter(hasBenacoHosting);
  const ivionTotalPanos = ivionDeals.reduce(
    (sum, deal) => sum + Number(deal.ivion_total_panos ?? 0),
    0,
  );
  const ivionActivePanos = ivionDeals.reduce(
    (sum, deal) => sum + Number(deal.ivion_active_panos ?? 0),
    0,
  );
  const benacoTotalPanos = benacoDeals.reduce(
    (sum, deal) => sum + Number(deal.benaco_total_panos ?? 0),
    0,
  );
  const benacoPanoBases = benacoDeals.map(benacoPanoBasis);
  const benacoCountedPanos = benacoPanoBases.reduce((sum, basis) => sum + basis.count, 0);
  const estimatedCost = actualRows.reduce((sum, row) => sum + row.benacoEstimatedPanoCosts, 0);
  const billedCost = actualRows.reduce((sum, row) => sum + row.benacoBilledCost, 0);
  const historicalCost = actualRows.reduce((sum, row) => sum + row.benacoHistoricalCost, 0);
  const billedMonths = actualRows.reduce((sum, row) => sum + row.benacoBilledMonths, 0);
  const estimatedMonths = actualRows.reduce((sum, row) => sum + row.benacoEstimatedMonths, 0);
  const viewLabel = views.find((option) => option.value === view)?.label ?? "Combined";
  const rangeLabel = ranges.find((option) => option.value === range)?.label ?? "Rolling 12 months";
  const syncTone = latestSync?.status === "FAILED" ? "hosting-status--failed" : "";
  const contributionMargin = totals.revenue ? totals.netProfit / totals.revenue : null;
  const costShare = totals.revenue ? Math.min(Math.max(totals.costs / totals.revenue, 0), 1) : 0;

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide hosting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Hosting revenue &amp; platform economics</p>
            <h1>Hosting Reporting</h1>
            <p>
              A focused view of hosting revenue, direct costs, net contribution, and platform scale.
            </p>
            <div className="report-titlebar__status" aria-label="Hosting data status">
              <span className="portfolio-status-dot portfolio-status-dot--green" />
              HubSpot source{" "}
              <span className="hosting-flow-arrow" aria-hidden="true">
                →
              </span>
              Neon reporting store{" "}
              <span className="hosting-flow-arrow" aria-hidden="true">
                →
              </span>
              This report
            </div>
          </div>
          <div className="report-titlebar__actions">
            <span className={`report-date-chip ${syncTone}`}>
              {latestSync
                ? `${latestSync.kind === "SCHEDULED" ? "Last automatic sync" : "Last sync"} ${dateTimeLabel(latestSync.completed_at ?? latestSync.started_at)}`
                : "Hosting data not yet synchronized"}
            </span>
          </div>
        </section>

        <section className="hosting-controls" aria-label="Hosting report controls">
          <nav className="hosting-view-tabs" aria-label="Hosting service view">
            {views.map((option) => (
              <Link
                key={option.value}
                href={viewHref({
                  grouping,
                  view: option.value,
                  range,
                  dateFrom,
                  dateTo,
                  showForecast,
                })}
                className={
                  option.value === view
                    ? "hosting-view-tabs__item hosting-view-tabs__item--active"
                    : "hosting-view-tabs__item"
                }
                aria-current={option.value === view ? "page" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </nav>
          <details className="filter-popover filter-popover--inline">
            <summary className="filter-popover__trigger">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16l-6.25 7.1v5.35l-3.5 1.75v-7.1L4 5Z" />
                <circle cx="17.25" cy="16.75" r="3.25" />
                <path d="m19.6 19.1 2.15 2.15" />
              </svg>
              <span>Report options</span>
              <span className="filter-popover__chevron" aria-hidden="true" />
            </summary>
            <div className="hosting-options-panel filter-popover__panel">
              <form className="hosting-grouping" method="get">
                <input type="hidden" name="view" value={view} />
                <label>
                  Time range
                  <select id="hosting-range" name="range" defaultValue={range}>
                    {ranges.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Periods
                  <select id="hosting-grouping" name="grouping" defaultValue={grouping}>
                    {groupings.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="hosting-date-field">
                  From
                  <input type="date" name="dateFrom" defaultValue={dateFrom ?? ""} />
                </label>
                <label className="hosting-date-field">
                  Through
                  <input type="date" name="dateTo" defaultValue={dateTo ?? ""} />
                </label>
                <label className="hosting-forecast-toggle">
                  <input
                    type="checkbox"
                    name="forecast"
                    value="show"
                    defaultChecked={showForecast}
                  />
                  Show forecast
                </label>
                <input type="hidden" name="forecast" value="hide" />
                <div className="hosting-options-actions">
                  <Link className="button button--secondary" href={`/hosting?view=${view}`}>
                    Reset
                  </Link>
                  <button className="button button--primary" type="submit">
                    Apply options
                  </button>
                </div>
              </form>
              {session.user.role === "ADMIN" ? (
                <div className="hosting-manual-sync">
                  <span>
                    <strong>Admin fallback</strong> · Scheduled sync normally keeps this report
                    current.
                  </span>
                  <HostingSyncControl configured={Boolean(process.env.HUBSPOT_ACCESS_TOKEN)} />
                </div>
              ) : null}
            </div>
          </details>
          <p className="hosting-range-summary">
            <strong>{rangeLabel}</strong> · {dateLabel(data.range.from)} through{" "}
            {dateLabel(data.range.to)}
            {showForecast ? " · Forecast visible" : " · Actual periods"}
          </p>
        </section>

        {!latestSync ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>Hosting records have not been imported yet.</strong>
            <span>
              The Neon tables and platform settings are ready, but deal totals will remain limited
              until Render or an administrator completes the first HubSpot refresh.
            </span>
          </section>
        ) : latestSync.status === "FAILED" ? (
          <section className="notice notice--error hosting-status-banner" role="alert">
            <strong>The latest hosting refresh failed.</strong>
            <span>{latestSync.message ?? "Review the Render job log for details."}</span>
          </section>
        ) : null}

        {estimatedMonths ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>
              {estimatedMonths} displayed Benaco month{estimatedMonths === 1 ? "" : "s"} use a
              planning estimate.
            </strong>
            <span>
              Until a monthly bill is entered, active panos are estimated at{" "}
              {wholePercent(BENACO_GRID_ESTIMATE_RATE)} of Benaco Total Panos and cost is calculated
              at {currency(BENACO_ANNUAL_PANO_COST, 2)} per active pano per year plus the monthly
              subscription. Approximately {currency(estimatedCost, 2)} of the pano cost shown is
              estimated.
            </span>
          </section>
        ) : null}

        {billedMonths ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>
              {billedMonths} displayed Benaco month{billedMonths === 1 ? "" : "s"} use actual bills.
            </strong>
            <span>
              {currency(billedCost, 2)} of displayed Benaco cost comes directly from saved bills.
            </span>
          </section>
        ) : null}

        {historicalCost ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>One-time 2024 Benaco catch-up cost included.</strong>
            <span>
              {currency(historicalCost, 2)} of the {currency(BENACO_2024_CATCH_UP_TOTAL, 2)} delayed
              tour invoice falls within this view. It replaces the 2024 pano estimate, remains
              separate from the $100 monthly subscription, and does not recur after 2024.
            </span>
          </section>
        ) : null}

        <section className="hosting-overview" aria-label="Hosting financial summary">
          <article
            className={`hosting-contribution${hasSourceData && totals.netProfit < 0 ? " hosting-contribution--loss" : ""}`}
          >
            <div className="hosting-contribution__heading">
              <div>
                <p className="eyebrow">{viewLabel} contribution</p>
                <h2>Net hosting revenue</h2>
              </div>
              <span>
                {contributionMargin === null
                  ? "No margin"
                  : `${wholePercent(contributionMargin)} margin`}
              </span>
            </div>
            <strong className="hosting-contribution__value">
              {hasSourceData ? currency(totals.netProfit) : "No data"}
            </strong>
            <p>Revenue remaining after direct platform, subscription, and pano costs.</p>
            <div className="hosting-contribution__split" aria-label="Revenue and cost totals">
              <div>
                <span>Paid revenue</span>
                <strong>{hasSourceData ? currency(totals.revenue) : "No data"}</strong>
              </div>
              <div>
                <span>Direct costs</span>
                <strong>{hasSourceData ? currency(totals.costs) : "No data"}</strong>
              </div>
            </div>
            <div className="hosting-contribution__bar" aria-hidden="true">
              <span style={{ width: `${costShare * 100}%` }} />
            </div>
          </article>

          <div className="hosting-scale" aria-label="Hosting operating scale">
            <article className="hosting-scale__card hosting-scale__card--deals">
              <span>Active hosting deals</span>
              <strong>{hasSourceData ? number(activeDeals.length) : "No data"}</strong>
              <small>{filteredDeals.length} records in this reporting range</small>
            </article>
            {view === "benaco" ? (
              <>
                <article className="hosting-scale__card">
                  <span>Benaco total panos</span>
                  <strong>{hasSourceData ? number(benacoTotalPanos) : "No data"}</strong>
                  <small>Complete site pano inventory</small>
                </article>
                <article className="hosting-scale__card">
                  <span>Benaco counted panos</span>
                  <strong>{hasSourceData ? number(benacoCountedPanos) : "No data"}</strong>
                  <small>Billable basis after approved estimates</small>
                </article>
              </>
            ) : (
              <>
                <article className="hosting-scale__card">
                  <span>IVION active panos</span>
                  <strong>{hasSourceData ? number(ivionActivePanos) : "No data"}</strong>
                  <small>{number(ivionTotalPanos)} total in this range</small>
                </article>
                <article className="hosting-scale__card">
                  <span>Benaco counted panos</span>
                  <strong>{hasSourceData ? number(benacoCountedPanos) : "No data"}</strong>
                  <small>{number(benacoTotalPanos)} total in this range</small>
                </article>
              </>
            )}
          </div>
        </section>

        <section className="report-section hosting-report-section hosting-chart-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Company hosting timeline</p>
              <h2>{viewLabel} financial performance</h2>
            </div>
            <p>Monthly paid revenue, direct platform costs, and resulting net hosting revenue.</p>
          </div>
          <HostingFinancialChart rows={displayedRows} view={view} />
          <details className="hosting-methodology">
            <summary>How net revenue is calculated</summary>
            <p>
              <strong>
                Paid revenue – IVION costs – Benaco pano and subscription costs = Net revenue.
              </strong>{" "}
              Complimentary hosting never reduces paid revenue. A period can fall when a paid term
              ends while its site continues to incur direct hosting cost.
            </p>
          </details>
        </section>

        <details className="report-section hosting-report-section hosting-table-disclosure">
          <summary>
            <span>
              <strong>View financial table</strong>
              <small>Exact period values behind the graph</small>
            </span>
            <i aria-hidden="true" />
          </summary>
          <div className="table-wrap report-table-wrap">
            <table className="data-table hosting-financial-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Paid Revenue</th>
                  <th>Direct Costs</th>
                  <th>Net Revenue</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => {
                  const values = hostingRowForView(row, view);
                  return (
                    <tr key={row.period}>
                      <td>
                        <strong>{row.period}</strong>
                      </td>
                      <td>{row.forecast ? <span className="tag">Forecast</span> : "Actual"}</td>
                      <td>{currency(values.revenue)}</td>
                      <td>{currency(values.costs)}</td>
                      <td
                        className={
                          values.netProfit < 0 ? "hosting-value--loss" : "hosting-value--profit"
                        }
                      >
                        <strong>{currency(values.netProfit)}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>

        <section className="hosting-detail-grid">
          <article className="report-section hosting-report-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Neon-controlled costs</p>
                <h2>IVION site settings</h2>
              </div>
            </div>
            <div className="table-wrap report-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Started</th>
                    <th>Annual Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ivionSites.map((site) => {
                    const annualCost = latestAnnualCost(site.cost_history);
                    return (
                      <tr key={site.id}>
                        <td>
                          <a href={site.url} target="_blank" rel="noreferrer">
                            <strong>{site.label}</strong>
                          </a>
                        </td>
                        <td>{dateLabel(site.started_on)}</td>
                        <td>{annualCost === null ? "Missing" : currency(annualCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article className="report-section hosting-report-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Cost model</p>
                <h2>Benaco billing basis</h2>
              </div>
            </div>
            <dl className="hosting-cost-model">
              <DetailItem label="Actual monthly bill">
                Bill total ÷ total active panos = effective monthly cost per active pano
              </DetailItem>
              <DetailItem label="Tour allocation">
                Tour active panos × effective monthly cost per active pano
              </DetailItem>
              <DetailItem label="Subscription overhead">
                Included in the actual bill. Estimates accrue {currency(BENACO_ANNUAL_OVERHEAD)}
                per year ({currency(BENACO_MONTHLY_OVERHEAD, 2)} per month) since{" "}
                {dateLabel(BENACO_SUBSCRIPTION_START)}.
              </DetailItem>
              <DetailItem label="Counted grid panos">
                Use HubSpot Counted Grid-Pano when entered; otherwise estimate{" "}
                {wholePercent(BENACO_GRID_ESTIMATE_RATE)} of Benaco Total Panos.
              </DetailItem>
              <DetailItem label="Estimate when no bill exists">
                Estimated active panos × {currency(BENACO_ANNUAL_PANO_COST, 2)} ÷ 365 × active days
              </DetailItem>
              <DetailItem label="2024 historical adjustment">
                The one-time {currency(BENACO_2024_CATCH_UP_TOTAL, 2)} delayed-tour invoice is
                spread across January–December 2024 and replaces the pano estimate for those months.
                It never carries into later years.
              </DetailItem>
              <DetailItem label="History start">January 2023</DetailItem>
            </dl>
          </article>
        </section>

        <section className="report-section hosting-report-section hosting-benaco-bills">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Actual cost source</p>
              <h2>Benaco monthly bills</h2>
            </div>
            <p>
              Copy the month, invoice total, and active-pano total from the Benaco bill. Saving a
              month that already exists updates that month instead of creating a duplicate. Record
              catch-up invoices in the month received and identify the historical coverage in the
              notes; they remain one-time actual costs and do not change future estimates.
            </p>
          </div>

          {session.user.role === "ADMIN" ? (
            <form className="hosting-benaco-bill-form" action={saveBenacoMonthlyBill}>
              <label>
                <span>Billing month</span>
                <input type="month" name="billingMonth" min="2023-01" required />
              </label>
              <label>
                <span>Bill total</span>
                <input type="number" name="billedAmount" min="0" step="0.01" required />
              </label>
              <label>
                <span>Total active panos</span>
                <input type="number" name="activePanos" min="0.01" step="0.01" required />
              </label>
              <label className="hosting-benaco-bill-form__notes">
                <span>Invoice / reference (optional)</span>
                <input
                  type="text"
                  name="notes"
                  maxLength={1000}
                  placeholder="Invoice number or source note"
                />
              </label>
              <button className="button button--primary" type="submit">
                Save monthly bill
              </button>
            </form>
          ) : null}

          <div className="table-wrap report-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Bill total</th>
                  <th>Active panos</th>
                  <th>Cost per active pano</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.benacoBills.map((bill) => {
                  const activePanos = Number(bill.active_panos);
                  const billedAmount = Number(bill.billed_amount);
                  return (
                    <tr key={bill.id}>
                      <td>
                        <strong>{dateLabel(bill.billing_month)}</strong>
                      </td>
                      <td>{currency(billedAmount, 2)}</td>
                      <td>{number(activePanos)}</td>
                      <td>{currency(benacoBillCostPerActivePano(billedAmount, activePanos), 4)}</td>
                      <td>{bill.notes || "—"}</td>
                    </tr>
                  );
                })}
                {!data.benacoBills.length ? (
                  <tr>
                    <td colSpan={5}>No Benaco bills have been entered yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-section hosting-report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HubSpot list: All Hosting Records</p>
              <h2>Hosting deal detail</h2>
            </div>
            <p>
              {visibleDeals.length
                ? dealFiltersActive
                  ? `${visibleDeals.length} of ${filteredDeals.length} records shown`
                  : `${visibleDeals.length} records in this view`
                : "No matching records"}
            </p>
          </div>

          <form className="hosting-deal-filters" action="/hosting" method="get">
            <input type="hidden" name="grouping" value={grouping} />
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="range" value={range} />
            {dateFrom ? <input type="hidden" name="dateFrom" value={dateFrom} /> : null}
            {dateTo ? <input type="hidden" name="dateTo" value={dateTo} /> : null}
            {showForecast ? <input type="hidden" name="forecast" value="show" /> : null}

            <label className="hosting-deal-filters__search">
              <span>Deal or site</span>
              <input
                type="search"
                name="dealQuery"
                defaultValue={dealQuery}
                placeholder="Search name, project number, or HubSpot ID"
              />
            </label>

            <label>
              <span>Platform</span>
              <select name="dealPlatform" defaultValue={dealPlatform}>
                {dealPlatformFilters.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Term</span>
              <select name="dealTerm" defaultValue={dealTerm}>
                {dealTermFilters.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Contracted fee</span>
              <select name="dealFee" defaultValue={dealFee}>
                {dealFeeFilters.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="hosting-deal-filters__actions">
              <button className="button button--primary" type="submit">
                Filter deals
              </button>
              {dealFiltersActive ? (
                <Link
                  className="button button--secondary"
                  href={viewHref({ grouping, view, range, dateFrom, dateTo, showForecast })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          <div className="hosting-deal-list">
            {visibleDeals.map((deal) => {
              const hasIvion = hasIvionHosting(deal);
              const hasBenaco = hasBenacoHosting(deal);
              const basis = benacoPanoBasis(deal);
              const title = deal.site_name ?? deal.deal_name ?? deal.hubspot_deal_id;
              const dealUrl = hubspotDealUrl(deal);
              const fee =
                Number(deal.ivion_contracted_fee ?? 0) + Number(deal.benaco_contracted_fee ?? 0);
              const annualBenacoRunRate = basis.count * BENACO_ANNUAL_PANO_COST;
              const term = hostingDealTermSummary(deal, view);

              return (
                <details className="hosting-deal-disclosure" key={deal.id}>
                  <summary>
                    <span className="hosting-deal-summary__site">
                      <strong>{title}</strong>
                      <small>
                        {deal.deal_name && deal.deal_name !== title
                          ? deal.deal_name
                          : "Hosting record"}
                      </small>
                    </span>
                    <span className="tag-row">
                      {hasIvion ? <span className="tag">IVION</span> : null}
                      {hasBenaco ? <span className="tag">Benaco</span> : null}
                    </span>
                    <span>
                      <small>Term</small>
                      <strong>
                        {term?.expired
                          ? "Expired"
                          : term
                            ? dateRangeLabel(term.start, term.end)
                            : "Not available"}
                      </strong>
                    </span>
                    <span>
                      <small>Contracted fee</small>
                      <strong>{currency(fee)}</strong>
                    </span>
                    <i aria-hidden="true" />
                  </summary>
                  <div className="hosting-deal-disclosure__content">
                    <div className="hosting-deal-actions">
                      <div>
                        <strong>{title}</strong>
                        <span>{deal.deal_name ?? `HubSpot deal ${deal.hubspot_deal_id}`}</span>
                      </div>
                      <a
                        className="button button--secondary"
                        href={dealUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open HubSpot deal
                      </a>
                    </div>
                    {hasIvion ? (
                      <section className="hosting-deal-panel">
                        <h3>IVION hosting details</h3>
                        <dl className="hosting-deal-fields">
                          <DetailItem label="IVION instance">
                            {deal.ivion_instance ? (
                              <a href={deal.ivion_instance} target="_blank" rel="noreferrer">
                                Open IVION site
                              </a>
                            ) : (
                              "Not available"
                            )}
                          </DetailItem>
                          <DetailItem label="Paid hosting term">
                            {termDateRangeLabel(deal.ivion_hosting_start, deal.ivion_hosting_end)}
                          </DetailItem>
                          <DetailItem label="Complimentary term">
                            {termDateRangeLabel(deal.ivion_comp_start, deal.ivion_comp_end)}
                          </DetailItem>
                          <DetailItem label="Date added">
                            {dateLabel(deal.ivion_date_added)}
                          </DetailItem>
                          <DetailItem label="Date sent to client">
                            {dateLabel(deal.ivion_date_sent_to_client)}
                          </DetailItem>
                          <DetailItem label="Total panos">
                            {optionalNumber(deal.ivion_total_panos)}
                          </DetailItem>
                          <DetailItem label="Active panos">
                            {optionalNumber(deal.ivion_active_panos)}
                          </DetailItem>
                          <DetailItem label="Contracted term fee">
                            {optionalCurrency(deal.ivion_contracted_fee)}
                          </DetailItem>
                          <DetailItem label="Calculated quarterly fee">
                            {optionalCurrency(deal.ivion_calculated_quarterly_fee)}
                          </DetailItem>
                          <DetailItem label="Contracted quarterly fee">
                            {optionalCurrency(deal.ivion_contracted_quarterly_fee)}
                          </DetailItem>
                          <DetailItem label="Bundle archive date">
                            {dateLabel(deal.ivion_bundle_archive_date)}
                          </DetailItem>
                        </dl>
                      </section>
                    ) : null}
                    {hasBenaco ? (
                      <section className="hosting-deal-panel">
                        <h3>Benaco hosting details</h3>
                        <dl className="hosting-deal-fields">
                          <DetailItem label="Benaco site">
                            {deal.benaco_url ? (
                              <a href={deal.benaco_url} target="_blank" rel="noreferrer">
                                Open Benaco site
                              </a>
                            ) : (
                              "Not available"
                            )}
                          </DetailItem>
                          <DetailItem label="Paid hosting term">
                            {termDateRangeLabel(deal.benaco_hosting_start, deal.benaco_hosting_end)}
                          </DetailItem>
                          <DetailItem label="Complimentary term">
                            {termDateRangeLabel(deal.benaco_comp_start, deal.benaco_comp_end)}
                          </DetailItem>
                          <DetailItem label="Total panos">
                            {optionalNumber(deal.benaco_total_panos)}
                          </DetailItem>
                          <DetailItem label="Counted grid panos">
                            <span>
                              {number(basis.count)}{" "}
                              <em className={`hosting-basis hosting-basis--${basis.source}`}>
                                {basis.source}
                              </em>
                            </span>
                          </DetailItem>
                          <DetailItem label="HubSpot Counted Grid-Pano">
                            {optionalNumber(deal.benaco_counted_grid_panos)}
                          </DetailItem>
                          <DetailItem label="Estimated monthly pano cost">
                            {currency(annualBenacoRunRate / 12, 2)}
                          </DetailItem>
                          <DetailItem label="Annual pano run rate">
                            {currency(annualBenacoRunRate, 2)}
                          </DetailItem>
                          <DetailItem label="HubSpot calculated cost">
                            {optionalCurrency(deal.benaco_calculated_cost, 2)}
                          </DetailItem>
                          <DetailItem label="HubSpot annual fee">
                            {optionalCurrency(deal.benaco_annual_fee, 2)}
                          </DetailItem>
                          <DetailItem label="Contracted fee">
                            {optionalCurrency(deal.benaco_contracted_fee)}
                          </DetailItem>
                        </dl>
                      </section>
                    ) : null}
                    {deal.hosting_notes || deal.hosting_communications_contact ? (
                      <section className="hosting-deal-panel hosting-deal-notes">
                        <h3>Record notes</h3>
                        <dl className="hosting-deal-fields">
                          <DetailItem label="Hosting notes">
                            {deal.hosting_notes ?? "Not available"}
                          </DetailItem>
                          <DetailItem label="Communications contact">
                            {deal.hosting_communications_contact ?? "Not available"}
                          </DetailItem>
                        </dl>
                      </section>
                    ) : null}
                  </div>
                </details>
              );
            })}
            {!visibleDeals.length ? (
              <div className="empty-panel">
                {dealFiltersActive
                  ? "No hosting deals match these filters."
                  : "No hosting deals contribute to the selected service and time range."}
              </div>
            ) : null}
          </div>
        </section>

        <section className="report-section hosting-report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Feed health</p>
              <h2>Recent hosting refreshes</h2>
            </div>
          </div>
          {data.syncRuns.length ? (
            <ul className="hosting-sync-list">
              {data.syncRuns.map((run) => (
                <li key={run.id}>
                  <strong>{run.status.replaceAll("_", " ")}</strong>
                  <span>
                    {dateTimeLabel(run.completed_at ?? run.started_at)} · {run.records_read} read ·{" "}
                    {run.records_upserted} saved
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-panel">No hosting refresh has run.</div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
