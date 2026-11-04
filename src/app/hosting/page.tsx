import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import {
  HostingCumulativeChart,
  HostingFinancialChart,
} from "@/components/hosting-financial-chart";
import { HostingSyncControl } from "@/components/hosting-sync-control";
import { requireUser } from "@/lib/auth/session";
import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_ANNUAL_OVERHEAD,
  BENACO_MONTHLY_OVERHEAD,
  HOSTING_REPORT_START,
  benacoBillCostPerActivePano,
  benacoPanoBasis,
  benacoTourPanoCost,
  buildHostingReport,
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
  type HostingReportRow,
  type HostingRange,
  type HostingView,
} from "@/lib/hosting/reporting";
import { saveBenacoMonthlyBill } from "./actions";
import { reportingTimestamp } from "@/lib/reporting/format";
import { hostingPeriodStatus } from "@/lib/hosting/period-status";
import {
  BENACO_PREVIOUSLY_PAID,
  BENACO_CATCH_UP_PAYMENT,
  BENACO_VERIFIED_PANO_TOTAL,
  benacoTourId,
} from "@/lib/hosting/benaco-billing-history";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const groupings: Array<{ value: HostingGrouping; label: string }> = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half", label: "Half-year" },
  { value: "year", label: "Annual" },
];

const ranges: Array<{ value: HostingRange; label: string }> = [
  { value: "all", label: "All available history" },
  { value: "12m", label: "Rolling 12 months" },
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
  return ranges.some((option) => option.value === value) ? (value as HostingRange) : "all";
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

function reportTotals(rows: HostingReportRow[], view: HostingView) {
  return rows
    .map((row) => hostingRowForView(row, view))
    .reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        costs: sum.costs + row.costs,
        netProfit: sum.netProfit + row.netProfit,
      }),
      { revenue: 0, costs: 0, netProfit: 0 },
    );
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
  return reportingTimestamp(value);
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
  const data = await getHostingDashboardData({
    grouping,
    range,
    dateFrom,
    dateTo,
    includeForecast: showForecast,
  });
  const latestSync = data.syncRuns[0] ?? null;
  const lastSuccessfulSync = data.latestSuccessfulSync;
  const lastSuccessfulDate = lastSuccessfulSync
    ? new Date(lastSuccessfulSync.completed_at ?? lastSuccessfulSync.started_at)
    : null;
  const hostingStale =
    !lastSuccessfulDate || new Date().getTime() - lastSuccessfulDate.getTime() > 8 * 60 * 60 * 1000;
  const hasSourceData = Boolean(
    latestSync || data.deals.length || data.ivionSites.length || data.benacoBills.length,
  );
  const actualRows = showForecast
    ? buildHostingReport(
        data.deals,
        grouping,
        data.ivionSites,
        new Date(),
        range,
        { from: dateFrom, to: dateTo },
        data.benacoBills,
        false,
      )
    : data.report;
  const displayedRows = showForecast ? data.report : actualRows;
  const displayedRangeFrom = displayedRows[0]?.periodStart ?? data.range.from;
  const displayedRangeTo = displayedRows.at(-1)?.periodEnd ?? data.range.to;
  const selectedPeriodTotals = reportTotals(displayedRows, view);
  const overallActualRows =
    range === "all" && grouping === "month"
      ? actualRows
      : buildHostingReport(
          data.deals,
          "month",
          data.ivionSites,
          new Date(),
          "all",
          {},
          data.benacoBills,
          false,
        ).filter((row) => !row.forecast);
  const overallTotals = reportTotals(overallActualRows, view);
  const filteredDeals = data.deals.filter((deal) =>
    dealMatchesRange(deal, view, displayedRangeFrom, displayedRangeTo),
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
  const activeOn = new Date();
  const activeDeals = serviceDeals.filter((deal) => isHostingDealActiveOn(deal, activeOn, view));
  const activeIvionDeals = data.deals.filter(
    (deal) => hasIvionHosting(deal) && isHostingDealActiveOn(deal, activeOn, "ivion"),
  );
  const activeBenacoDeals = data.deals.filter(
    (deal) => hasBenacoHosting(deal) && isHostingDealActiveOn(deal, activeOn, "benaco"),
  );
  const ivionTotalPanos = activeIvionDeals.reduce(
    (sum, deal) => sum + Number(deal.ivion_total_panos ?? 0),
    0,
  );
  const ivionActivePanos = activeIvionDeals.reduce(
    (sum, deal) => sum + Number(deal.ivion_active_panos ?? 0),
    0,
  );
  const benacoTotalPanos = activeBenacoDeals.reduce(
    (sum, deal) => sum + Number(deal.benaco_total_panos ?? 0),
    0,
  );
  const benacoPanoBases = activeBenacoDeals.map(benacoPanoBasis);
  const benacoCountedPanos = benacoPanoBases.reduce((sum, basis) => sum + basis.count, 0);
  const benacoActualCountedPanos = benacoPanoBases.reduce(
    (sum, basis) => sum + (basis.source === "actual" ? basis.count : 0),
    0,
  );
  const benacoEstimatedCountedPanos = benacoPanoBases.reduce(
    (sum, basis) => sum + (basis.source === "estimated" ? basis.count : 0),
    0,
  );
  const benacoMissingPanoDeals = benacoPanoBases.filter(
    (basis) => basis.source === "missing",
  ).length;
  const estimatedCost = actualRows.reduce((sum, row) => sum + row.benacoEstimatedPanoCosts, 0);
  const billedCost = actualRows.reduce((sum, row) => sum + row.benacoBilledCost, 0);
  const selectedBenacoTourCosts = data.benacoTourCosts
    .filter(
      (cost) => !cost.start || (cost.start >= displayedRangeFrom && cost.start <= displayedRangeTo),
    )
    .sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  const incompleteBenacoCosts = selectedBenacoTourCosts.filter((cost) => cost.missingInputs).length;
  const earlierBenacoPanoCharges = data.benacoTourCosts
    .filter((cost) => cost.start && cost.start < HOSTING_REPORT_START)
    .reduce((sum, cost) => sum + cost.recordedPanoCost, 0);
  const ivionEstimatedCost = displayedRows.reduce(
    (sum, row) => sum + (row.ivionEstimatedCost ?? 0),
    0,
  );
  const viewLabel = views.find((option) => option.value === view)?.label ?? "Combined";
  const rangeLabel =
    ranges.find((option) => option.value === range)?.label ?? "All available history";
  const syncTone = latestSync?.status === "FAILED" ? "hosting-status--failed" : "";
  const paymentRetention = selectedPeriodTotals.revenue
    ? selectedPeriodTotals.netProfit / selectedPeriodTotals.revenue
    : null;
  const costShare = selectedPeriodTotals.revenue
    ? Math.min(Math.max(selectedPeriodTotals.costs / selectedPeriodTotals.revenue, 0), 1)
    : 0;
  const overallThrough = overallActualRows.at(-1)?.periodEnd ?? displayedRangeTo;

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide hosting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Hosting revenue &amp; platform economics</p>
            <h1>Hosting Reporting</h1>
            <p>
              Contracted revenue and hosting costs, with a separate snapshot of the current hosting
              footprint.
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
            {session.user.role === "ADMIN" ? (
              <Link
                className="button button--secondary button--small"
                href="/teamwork-issues?view=HOSTING"
              >
                Review hosting data issues
              </Link>
            ) : null}
            <span className={`report-date-chip ${syncTone}`}>
              {lastSuccessfulSync
                ? `Last successful sync ${dateTimeLabel(lastSuccessfulSync.completed_at ?? lastSuccessfulSync.started_at)}`
                : "No successful hosting sync recorded"}
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
            <strong>{rangeLabel}</strong> · {dateLabel(displayedRangeFrom)} through{" "}
            {dateLabel(displayedRangeTo)}
            {showForecast
              ? " · Forecast visible"
              : " · Through today; modeled costs identified below"}
          </p>
        </section>

        {hostingStale && lastSuccessfulSync ? (
          <section className="notice hosting-status-banner" role="status">
            <strong>Hosting data is overdue for refresh.</strong>
            <span>
              The last successful refresh was more than eight hours ago. The financial charts still
              use the last imported records.
            </span>
          </section>
        ) : null}

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

        {view !== "benaco" && displayedRangeTo > "2026-09-30" ? (
          <section className="notice hosting-status-banner">
            <strong>
              IVION recorded costs use invoices from January 2024 through September 2026.
            </strong>
            <span>
              Later invoices have not been loaded. Historical reporting does not add instance-rate
              estimates to the supplied bills. Missing later invoices are not confirmation of zero
              spending.
            </span>
          </section>
        ) : null}

        {view !== "benaco" && ivionEstimatedCost > 0 ? (
          <section className="notice hosting-status-banner">
            <strong>IVION includes {currency(ivionEstimatedCost, 2)} in estimated costs.</strong>
            <span>
              Future months use configured annual instance costs divided by 12. These forecast
              estimates do not establish when a vendor payment was made.
            </span>
          </section>
        ) : null}

        {view !== "ivion" && (estimatedCost > 0 || incompleteBenacoCosts > 0) ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>
              Benaco includes {currency(estimatedCost, 2)} in estimated remaining tour costs.
            </strong>
            <span>
              Recorded pano charges plus estimated uncovered hosting days appear once at tour start.
              The {currency(BENACO_MONTHLY_OVERHEAD, 2)} company subscription continues monthly.
              {incompleteBenacoCosts > 0
                ? ` ${incompleteBenacoCosts} tour(s) need grid counts or complete dates; their costs are incomplete.`
                : ""}
            </span>
          </section>
        ) : null}

        {view !== "ivion" && billedCost > 0 ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>
              {currency(billedCost, 2)} of Benaco pano charges are supported by billing detail.
            </strong>
            <span>
              These charges are assigned to tour starts. Prior and catch-up payments settle those
              same charges and are not added again.
            </span>
          </section>
        ) : null}

        <section className="hosting-overview" aria-label="Hosting financial summary">
          <article
            className={`hosting-contribution${hasSourceData && selectedPeriodTotals.netProfit < 0 ? " hosting-contribution--loss" : ""}`}
          >
            <div className="hosting-contribution__heading">
              <div>
                <p className="eyebrow">{viewLabel} selected-period economics</p>
                <h2>Hosting contribution in selected range</h2>
              </div>
              <span>
                {paymentRetention === null
                  ? "No contracted revenue"
                  : selectedPeriodTotals.netProfit < 0
                    ? `${currency(Math.abs(selectedPeriodTotals.netProfit))} hosting loss`
                    : `${wholePercent(paymentRetention)} contribution margin`}
              </span>
            </div>
            <strong className="hosting-contribution__value">
              {hasSourceData ? currency(selectedPeriodTotals.netProfit) : "No data"}
            </strong>
            <p>
              Contracted revenue and recorded or estimated costs from{" "}
              {dateLabel(displayedRangeFrom)} through {dateLabel(displayedRangeTo)}. The report
              options above change this result.
            </p>
            <div className="hosting-contribution__split" aria-label="Revenue and cost totals">
              <div>
                <span>Contracted revenue</span>
                <strong>
                  {hasSourceData ? currency(selectedPeriodTotals.revenue) : "No data"}
                </strong>
              </div>
              <div>
                <span>Direct costs</span>
                <strong>{hasSourceData ? currency(selectedPeriodTotals.costs) : "No data"}</strong>
              </div>
            </div>
            <div className="hosting-contribution__bar" aria-hidden="true">
              <span style={{ width: `${costShare * 100}%` }} />
            </div>
          </article>

          <div className="hosting-scale" aria-label="Current hosting operating scale">
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
                  <small>Current active site inventory</small>
                </article>
                <article className="hosting-scale__card">
                  <span>Benaco counted panos</span>
                  <strong>{hasSourceData ? number(benacoCountedPanos) : "No data"}</strong>
                  <small>
                    {number(benacoActualCountedPanos)} actual ·{" "}
                    {number(benacoEstimatedCountedPanos)}
                    {" estimated"}
                    {benacoMissingPanoDeals ? ` · ${benacoMissingPanoDeals} missing` : ""}
                  </small>
                </article>
              </>
            ) : (
              <>
                <article className="hosting-scale__card">
                  <span>IVION active panos</span>
                  <strong>{hasSourceData ? number(ivionActivePanos) : "No data"}</strong>
                  <small>{number(ivionTotalPanos)} total across current active deals</small>
                </article>
                <article className="hosting-scale__card">
                  <span>Benaco counted panos</span>
                  <strong>{hasSourceData ? number(benacoCountedPanos) : "No data"}</strong>
                  <small>
                    {number(benacoActualCountedPanos)} actual ·{" "}
                    {number(benacoEstimatedCountedPanos)}
                    {" estimated"}
                    {benacoMissingPanoDeals ? ` · ${benacoMissingPanoDeals} missing` : ""}
                  </small>
                </article>
              </>
            )}
          </div>
        </section>

        <section className="report-section hosting-report-section hosting-chart-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">All-history hosting totals</p>
              <h2>{viewLabel} financial position since 2024</h2>
            </div>
            <p>
              Running contracted revenue, hosting costs, and contribution from Jan 1, 2024 through{" "}
              {dateLabel(overallThrough)}. Report date filters do not change this chart.
            </p>
          </div>
          <div className="hosting-period-summary" aria-label="All-history hosting totals">
            <div>
              <span>Total contracted revenue</span>
              <strong>{hasSourceData ? currency(overallTotals.revenue) : "No data"}</strong>
            </div>
            <div>
              <span>Total direct costs</span>
              <strong>{hasSourceData ? currency(overallTotals.costs) : "No data"}</strong>
            </div>
            <div
              className={overallTotals.netProfit < 0 ? "hosting-period-summary__loss" : undefined}
            >
              <span>Hosting contribution</span>
              <strong>{hasSourceData ? currency(overallTotals.netProfit) : "No data"}</strong>
            </div>
          </div>
          <HostingCumulativeChart rows={overallActualRows} view={view} />
        </section>

        <section className="report-section hosting-report-section hosting-chart-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Company hosting timeline</p>
              <h2>{viewLabel} profitability in selected period</h2>
            </div>
            <p>
              Contracted fees at paid hosting start, full-term Benaco costs at tour start, and the
              monthly company subscription.
            </p>
          </div>
          <div className="hosting-period-summary" aria-label="Selected period contribution totals">
            <div>
              <span>Contracted revenue</span>
              <strong>{hasSourceData ? currency(selectedPeriodTotals.revenue) : "No data"}</strong>
            </div>
            <div>
              <span>Direct costs</span>
              <strong>{hasSourceData ? currency(selectedPeriodTotals.costs) : "No data"}</strong>
            </div>
            <div
              className={
                selectedPeriodTotals.netProfit < 0 ? "hosting-period-summary__loss" : undefined
              }
            >
              <span>Hosting contribution</span>
              <strong>
                {hasSourceData ? currency(selectedPeriodTotals.netProfit) : "No data"}
              </strong>
            </div>
          </div>
          <HostingFinancialChart rows={displayedRows} view={view} />
          <details className="hosting-methodology">
            <summary>How hosting contribution is calculated</summary>
            <p>
              <strong>
                Contracted revenue – IVION costs – Benaco pano and subscription costs = hosting
                contribution.
              </strong>{" "}
              The complete contracted fee appears once in the paid hosting-start period. Benaco tour
              costs combine recorded pano charges with estimates for hosting days after their billed
              coverage ends, assigned once at tour start. The subscription is monthly. Complimentary
              and unsold hosting generate costs without client revenue. This is a contribution
              estimate; payment dates are not inferred from hosting dates. The historical totals
              chart always uses tour starts and recorded IVION bills from January 1, 2024 through
              the current period. The summary card, activity chart, and table use the selected
              report range.
            </p>
            <p>
              IVION history uses the supplied NavVis bills in their invoice months from January 2024
              through September 2026. After that coverage, historical IVION costs await additional
              invoices. Configured instance rates are used only for future forecast months.
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
                  <th>Contracted Revenue</th>
                  <th>Direct Costs</th>
                  <th>Hosting Contribution</th>
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
                      <td>{hostingPeriodStatus(row, view)}</td>
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

        {view !== "ivion" ? (
          <details className="report-section hosting-report-section hosting-table-disclosure">
            <summary>
              <span>
                <strong>Benaco tour cost breakdown</strong>
                <small>
                  Recorded charges and estimated remaining hosting, assigned once per tour
                </small>
              </span>
              <i aria-hidden="true" />
            </summary>
            <div className="table-wrap report-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tour</th>
                    <th>Cost assigned at start</th>
                    <th>Recorded pano charges</th>
                    <th>Estimated remaining</th>
                    <th>Total tour cost</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBenacoTourCosts.map((cost) => (
                    <tr key={cost.tourId}>
                      <td>
                        <strong>{cost.name}</strong>
                      </td>
                      <td>{dateLabel(cost.start)}</td>
                      <td>{currency(cost.recordedPanoCost, 2)}</td>
                      <td>
                        {cost.missingInputs ? "Incomplete" : currency(cost.estimatedPanoCost, 2)}
                      </td>
                      <td>{cost.missingInputs ? "Incomplete" : currency(cost.totalPanoCost, 2)}</td>
                    </tr>
                  ))}
                  {!selectedBenacoTourCosts.length ? (
                    <tr>
                      <td colSpan={5}>No tour costs start in this date range.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}

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
                Monthly invoice totals are retained for reconciliation against tour-level charges.
              </DetailItem>
              <DetailItem label="Tour allocation">
                Recorded tour pano charges + grid panos × {currency(BENACO_ANNUAL_PANO_COST, 2)} ×
                uncovered hosting days ÷ 365
              </DetailItem>
              <DetailItem label="Subscription overhead">
                Company cost of {currency(BENACO_ANNUAL_OVERHEAD)}
                per year ({currency(BENACO_MONTHLY_OVERHEAD, 2)} per month) since{" "}
                {dateLabel(HOSTING_REPORT_START)} in this report.
              </DetailItem>
              <DetailItem label="Counted grid panos">
                Use HubSpot Counted Grid-Pano when entered, otherwise the matched billing detail.
                Missing counts remain incomplete.
              </DetailItem>
              <DetailItem label="Tour pano cost at start">
                The full recorded-plus-estimated tour cost appears once in the tour-start period.
                Covered historical days are not estimated again.
              </DetailItem>
              <DetailItem label="Reconciled historical pano charges">
                {currency(BENACO_PREVIOUSLY_PAID, 2)} previously paid +{" "}
                {currency(BENACO_CATCH_UP_PAYMENT, 2)} catch-up ={" "}
                {currency(BENACO_VERIFIED_PANO_TOTAL, 2)}. The same tour charges are counted once.
                {currency(earlierBenacoPanoCharges, 2)} relates to tour starts before 2024 and is
                outside this report. The $100 monthly subscription is separate.
              </DetailItem>
              <DetailItem label="History start">January 2024</DetailItem>
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
              Enter each new monthly invoice once using its full vendor total, including the $100
              subscription and pano charges. Saving a month that already exists updates that month
              instead of creating a duplicate. These totals are kept for invoice reconciliation;
              tour-level billing detail supplies recorded pano costs in the profitability report.
            </p>
          </div>

          {session.user.role === "ADMIN" ? (
            <form className="hosting-benaco-bill-form" action={saveBenacoMonthlyBill}>
              <label>
                <span>Billing month</span>
                <input type="month" name="billingMonth" min="2024-01" required />
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
                  <th>Bill per pano, including subscription</th>
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
                (deal.ivion_hosting_start ? Number(deal.ivion_contracted_fee ?? 0) : 0) +
                (deal.benaco_hosting_start ? Number(deal.benaco_contracted_fee ?? 0) : 0);
              const annualBenacoRunRate = basis.count * BENACO_ANNUAL_PANO_COST;
              const fullBenacoTourCost = benacoTourPanoCost(deal);
              const tourCost = data.benacoTourCosts.find(
                (cost) =>
                  cost.tourId === (benacoTourId(deal.benaco_url) ?? `deal:${deal.hubspot_deal_id}`),
              );
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
                          <DetailItem label="Full-term tour cost">
                            {tourCost?.missingInputs
                              ? "Incomplete — grid count or term dates needed"
                              : currency(fullBenacoTourCost, 2)}
                          </DetailItem>
                          <DetailItem label="Annual pano rate">
                            {currency(annualBenacoRunRate, 2)}
                          </DetailItem>
                          <DetailItem label="HubSpot calculated cost">
                            {optionalCurrency(deal.benaco_calculated_cost, 2)}
                          </DetailItem>
                          <DetailItem label="HubSpot annual fee">
                            {optionalCurrency(deal.benaco_annual_fee, 2)}
                          </DetailItem>
                          <DetailItem label="Recognized contracted revenue">
                            {currency(
                              deal.benaco_hosting_start
                                ? Number(deal.benaco_contracted_fee ?? 0)
                                : 0,
                            )}
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
