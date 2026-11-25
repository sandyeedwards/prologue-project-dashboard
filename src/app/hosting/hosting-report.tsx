import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import {
  HostingCumulativeChart,
  HostingFinancialChart,
} from "@/components/hosting-financial-chart";
import { HostingSyncControl } from "@/components/hosting-sync-control";
import { HostingCostAudit, hostingCostComponents } from "@/components/hosting-cost-audit";
import styles from "./hosting-overview.module.css";
import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_ANNUAL_OVERHEAD,
  BENACO_MONTHLY_OVERHEAD,
  HOSTING_REPORT_START,
  HOSTING_REPORT_START_YEAR,
  benacoBillCostPerActivePano,
  benacoPanoBasis,
  buildHostingReport,
  filterHostingDeals,
  getHostingDashboardData,
  hasBenacoHosting,
  hasIvionHosting,
  hostingDealTermSummary,
  hostingRevenueGaps,
  hostingRowForView,
  isHostingDealActiveOn,
  isHostingTermExpired,
  upcomingHostingRenewals,
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
import { hostingPeriodIsConfirmed, hostingPeriodStatus } from "@/lib/hosting/period-status";
import {
  BENACO_PREVIOUSLY_PAID,
  BENACO_CATCH_UP_PAYMENT,
  BENACO_VERIFIED_PANO_TOTAL,
  benacoTourId,
} from "@/lib/hosting/benaco-billing-history";
import { recordedCostBetween } from "@/lib/hosting/benaco-profitability";
import {
  hostingClientEconomics,
  type HostingClientEconomics,
} from "@/lib/hosting/client-economics";

export type HostingSearchParams = Record<string, string | string[] | undefined>;
export type HostingDashboardData = Awaited<ReturnType<typeof getHostingDashboardData>>;
type HostingReportUser = { role: string } & Parameters<typeof AppShell>[0]["user"];

const groupings: Array<{ value: HostingGrouping; label: string }> = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "half", label: "Half-year" },
  { value: "year", label: "Annual" },
];

const ranges: Array<{ value: HostingRange; label: string }> = [
  { value: "all", label: `Since January ${HOSTING_REPORT_START_YEAR}` },
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
  // Quarters by default: one-time fees and lumpy vendor bills read better than in single months.
  return groupings.some((option) => option.value === value)
    ? (value as HostingGrouping)
    : "quarter";
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

export function hostingDataQuery(params: HostingSearchParams) {
  return {
    grouping: selectedGrouping(one(params.grouping)),
    range: selectedRange(one(params.range)),
    dateFrom: one(params.dateFrom),
    dateTo: one(params.dateTo),
    includeForecast: selectedForecast(one(params.forecast)),
  };
}

export function HostingReport({
  session,
  params,
  data,
}: {
  session: { user: HostingReportUser };
  params: HostingSearchParams;
  data: HostingDashboardData;
}) {
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
  const latestSync = data.syncRuns[0] ?? null;
  const lastSuccessfulSync = data.latestSuccessfulSync;
  const lastSuccessfulDate = lastSuccessfulSync
    ? new Date(lastSuccessfulSync.completed_at ?? lastSuccessfulSync.started_at)
    : null;
  const hostingStale =
    !lastSuccessfulDate || new Date().getTime() - lastSuccessfulDate.getTime() > 8 * 60 * 60 * 1000;
  // The header dot reflects the actual data state, not a fixed "all good" green.
  const dataStatusTone: "green" | "amber" | "red" =
    latestSync?.status === "FAILED" ? "red" : hostingStale ? "amber" : "green";
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
  const ivionActivePanos = activeIvionDeals.reduce(
    (sum, deal) => sum + Number(deal.ivion_active_panos ?? 0),
    0,
  );
  // Several deals can share one Benaco tour (for example a paid and a complimentary term), so
  // pano counts are taken once per tour, not once per deal.
  const activeBenacoTours = new Map<string, HostingDealRow>();
  for (const deal of activeBenacoDeals) {
    const tourKey = benacoTourId(deal.benaco_url) ?? `deal:${deal.hubspot_deal_id}`;
    if (!activeBenacoTours.has(tourKey)) activeBenacoTours.set(tourKey, deal);
  }
  const benacoPanoBases = [...activeBenacoTours.values()].map(benacoPanoBasis);
  const benacoCountedPanos = benacoPanoBases.reduce((sum, basis) => sum + basis.count, 0);
  const benacoMissingPanoDeals = benacoPanoBases.filter(
    (basis) => basis.source === "missing",
  ).length;
  // Same rows as the totals and charts, so the notes describe exactly what is shown.
  const estimatedCost = displayedRows.reduce((sum, row) => sum + row.benacoEstimatedPanoCosts, 0);
  const selectedBenacoTourCosts = data.benacoTourCosts
    .filter(
      (cost) => !cost.start || (cost.start >= displayedRangeFrom && cost.start <= displayedRangeTo),
    )
    .sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  const incompleteBenacoCosts = selectedBenacoTourCosts.filter((cost) => cost.missingInputs).length;
  // Deals and tours the totals cannot fully include; named so they are fixed in HubSpot rather
  // than read as $0.
  const revenueGaps = hostingRevenueGaps(data.deals, view);
  const incompleteTourNames =
    view === "ivion"
      ? []
      : data.benacoTourCosts.filter((cost) => cost.missingInputs).map((cost) => cost.name);
  // Recorded Benaco charges are spread over the days they cover; this is the part covering days
  // before the report start, which is the only part left out of the report.
  const reportStartTime = Date.parse(`${HOSTING_REPORT_START}T00:00:00Z`);
  const earlierBenacoPanoCharges = data.benacoTourCosts.reduce(
    (sum, cost) => sum + recordedCostBetween(cost, -Infinity, reportStartTime),
    0,
  );
  const ivionEstimatedCost = displayedRows.reduce(
    (sum, row) => sum + (row.ivionEstimatedCost ?? 0),
    0,
  );
  const unclassifiedNavvisCost =
    view === "benaco"
      ? 0
      : displayedRows.reduce((sum, row) => sum + row.ivionCost - (row.ivionEstimatedCost ?? 0), 0);
  const rangeLabel = ranges.find((option) => option.value === range)?.label ?? ranges[0].label;
  const syncTone = latestSync?.status === "FAILED" ? "hosting-status--failed" : "";
  const paymentRetention = selectedPeriodTotals.revenue
    ? selectedPeriodTotals.netProfit / selectedPeriodTotals.revenue
    : null;
  const renewalsDue = upcomingHostingRenewals(data.deals, view, activeOn, 90);
  const clientEconomics = hostingClientEconomics(data.deals, view, activeOn);
  const clientTotals = clientEconomics.totals;
  const complimentaryHostingCost =
    clientTotals.complimentaryPanos * clientEconomics.ivionCostPerPanoMonth * 12;
  const ivionSiteCount = clientTotals.paidSites + clientTotals.complimentarySites;
  const CLIENT_ROWS_SHOWN = 12;
  const clientRow = (row: HostingClientEconomics) => (
    <tr key={row.client}>
      <td>
        <strong>{row.client}</strong>
      </td>
      <td>
        {[
          row.paidSites ? `${row.paidSites} paid` : null,
          row.complimentarySites ? `${row.complimentarySites} complimentary` : null,
          row.benacoTours ? `${row.benacoTours} Benaco` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </td>
      <td>{currency(row.annualRevenue)}</td>
      <td>{currency(row.annualCost)}</td>
      {row.includedInScanning ? (
        // Complimentary hosting is paid for by the scanning fees, not a loss on a hosting sale.
        <td
          className={styles.included}
          title={`Complimentary hosting, included in scanning fees: about ${currency(row.annualCost)} a year to host`}
        >
          Included in scanning
        </td>
      ) : (
        <td className={row.annualMargin < 0 ? styles.loss : undefined}>
          {currency(row.annualMargin)}
        </td>
      )}
    </tr>
  );
  const costComponents = hostingCostComponents(displayedRows, view).filter(
    (component) => component.amount > 0,
  );
  const largestCost = Math.max(1, ...costComponents.map((component) => component.amount));
  const costTone: Record<string, string> = {
    navvis: styles.toneNavvis,
    "ivion-estimate": styles.toneIvionEstimate,
    "benaco-recorded": styles.toneBenacoRecorded,
    "benaco-estimate": styles.toneBenacoEstimate,
    "benaco-subscription": styles.toneSubscription,
  };
  const missingInvoiceMonths =
    view === "benaco"
      ? 0
      : displayedRows.reduce((sum, row) => sum + (row.ivionMissingInvoiceMonths ?? 0), 0);
  const groupingLabel =
    grouping === "month"
      ? "month"
      : grouping === "quarter"
        ? "quarter"
        : grouping === "half"
          ? "half-year"
          : "year";

  // One list of everything that makes the totals provisional or incomplete, instead of a stack
  // of banners above the numbers.
  const dataNotes: Array<{ title: string; detail: ReactNode }> = [];
  if (!latestSync) {
    dataNotes.push({
      title: "Hosting records have not been imported yet.",
      detail: "Deal totals stay limited until the first HubSpot refresh completes.",
    });
  } else if (latestSync.status === "FAILED") {
    dataNotes.push({
      title: "The latest hosting refresh failed.",
      detail: latestSync.message ?? "Review the Render job log for details.",
    });
  } else if (hostingStale) {
    dataNotes.push({
      title: "Hosting data is overdue for refresh.",
      detail: "The last successful refresh was more than eight hours ago.",
    });
  }
  if (unclassifiedNavvisCost > 0) {
    dataNotes.push({
      title: `${currency(unclassifiedNavvisCost)} of NavVis bills are included provisionally.`,
      detail:
        "The expense export has no line items, so these bills are not confirmed as hosting-only. Contribution is provisional until they are classified.",
    });
  }
  if (missingInvoiceMonths > 0) {
    dataNotes.push({
      title: `IVION costs are missing for ${missingInvoiceMonths} month${missingInvoiceMonths === 1 ? "" : "s"}.`,
      detail:
        "NavVis invoices after September 2026 have not been loaded, so those months show $0 IVION cost rather than a confirmed amount.",
    });
  }
  if (view !== "benaco" && ivionEstimatedCost > 0) {
    dataNotes.push({
      title: `IVION includes ${currency(ivionEstimatedCost)} of forecast costs.`,
      detail: "Future months use configured annual instance costs divided by 12.",
    });
  }
  if (view !== "ivion" && estimatedCost > 0) {
    dataNotes.push({
      title: `Benaco includes ${currency(estimatedCost)} of estimated tour costs.`,
      detail:
        "Hosting days after billed coverage are estimated at $0.38 per grid pano per year and booked at each term's start.",
    });
  }
  if (view !== "ivion" && earlierBenacoPanoCharges > 0) {
    dataNotes.push({
      title: `${currency(earlierBenacoPanoCharges)} of recorded Benaco charges cover days before ${HOSTING_REPORT_START_YEAR}.`,
      detail: `Recorded charges are spread over the days each one covers, so only the part for days before ${HOSTING_REPORT_START_YEAR} is left out of this report.`,
    });
  }
  if (revenueGaps.length || incompleteTourNames.length) {
    dataNotes.push({
      title: "Some deals cannot be fully counted.",
      detail: (
        <>
          {[
            revenueGaps.some((gap) => gap.kind === "start-without-fee")
              ? `Paid start but no fee: ${revenueGaps
                  .filter((gap) => gap.kind === "start-without-fee")
                  .map((gap) => `${gap.name} (${gap.platform})`)
                  .join(", ")}.`
              : null,
            revenueGaps.some((gap) => gap.kind === "fee-without-start")
              ? `Fee but no paid start, so not booked: ${revenueGaps
                  .filter((gap) => gap.kind === "fee-without-start")
                  .map((gap) => `${gap.name} (${gap.platform}, ${currency(gap.fee ?? 0)})`)
                  .join(", ")}.`
              : null,
            incompleteTourNames.length
              ? `Benaco tours missing a grid count or dates: ${incompleteTourNames.join(", ")}.`
              : null,
          ]
            .filter(Boolean)
            .join(" ")}{" "}
          <Link href="/teamwork-issues?view=HOSTING">Open the hosting data checklist</Link>
        </>
      ),
    });
  }

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide hosting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Hosting revenue and costs</p>
            <h1>Hosting</h1>
            <p>What IVION and Benaco hosting earns, what it costs, and what renews next.</p>
            <div className="report-titlebar__status" aria-label="Hosting data status">
              <span className={`portfolio-status-dot portfolio-status-dot--${dataStatusTone}`} />
              {dataStatusTone === "red"
                ? "Latest refresh failed · "
                : dataStatusTone === "amber"
                  ? "Refresh overdue · "
                  : null}
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

        <section className={styles.kpis} aria-label="Hosting totals">
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Revenue</span>
            <strong className={styles.kpiValue}>
              {hasSourceData ? currency(selectedPeriodTotals.revenue) : "No data"}
            </strong>
            <span className={styles.kpiSub}>Contracted fees, counted at paid start</span>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Direct costs</span>
            <strong className={styles.kpiValue}>
              {hasSourceData ? currency(selectedPeriodTotals.costs) : "No data"}
            </strong>
            <span className={styles.kpiSub}>
              {view === "ivion"
                ? "NavVis vendor bills"
                : view === "benaco"
                  ? "Benaco tours and subscription"
                  : "IVION and Benaco vendor costs"}
            </span>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>
              Contribution
              {unclassifiedNavvisCost > 0 ? <span className={styles.tag}>Provisional</span> : null}
            </span>
            <strong
              className={`${styles.kpiValue}${hasSourceData && selectedPeriodTotals.netProfit < 0 ? ` ${styles.kpiValueLoss}` : ""}`}
            >
              {hasSourceData ? currency(selectedPeriodTotals.netProfit) : "No data"}
            </strong>
            <span className={styles.kpiSub}>
              {paymentRetention === null
                ? "No revenue in this range"
                : `Margin ${wholePercent(paymentRetention)} of revenue`}
            </span>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Active hosting deals</span>
            <strong className={styles.kpiValue}>
              {hasSourceData ? number(activeDeals.length) : "No data"}
            </strong>
            <span className={styles.kpiSub}>
              {view === "ivion"
                ? `${number(ivionActivePanos)} IVION active panos`
                : view === "benaco"
                  ? `${number(benacoCountedPanos)} Benaco grid panos${benacoMissingPanoDeals ? ` · ${benacoMissingPanoDeals} missing` : ""}`
                  : `${number(ivionActivePanos)} IVION active · ${number(benacoCountedPanos)} Benaco grid panos`}
            </span>
          </article>
        </section>

        {dataNotes.length ? (
          <details className={styles.notes}>
            <summary>
              {dataNotes.length} data note{dataNotes.length === 1 ? "" : "s"} affect these totals
            </summary>
            <ul className={styles.notesList}>
              {dataNotes.map((note) => (
                <li key={note.title}>
                  <strong>{note.title}</strong> {note.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <section className={styles.card} aria-label="Revenue and costs by period">
          <div className={styles.cardHeader}>
            <h2>Revenue and costs by {groupingLabel}</h2>
            <p>
              {dateLabel(displayedRangeFrom)} – {dateLabel(displayedRangeTo)}
            </p>
          </div>
          <HostingFinancialChart rows={displayedRows} view={view} />
        </section>

        <div className={styles.twoUp}>
          <section className={styles.card} aria-label="Running contribution">
            <div className={styles.cardHeader}>
              <h2>Running contribution</h2>
              <p>
                {hasSourceData ? currency(overallTotals.netProfit) : "No data"} since{" "}
                {dateLabel(HOSTING_REPORT_START)}
              </p>
            </div>
            <HostingCumulativeChart rows={overallActualRows} view={view} compact />
          </section>

          <section className={styles.card} aria-label="Where costs come from">
            <div className={styles.cardHeader}>
              <h2>Where costs come from</h2>
              <p>Selected range</p>
            </div>
            {costComponents.length ? (
              <ul className={styles.costBars}>
                {costComponents.map((component) => (
                  <li key={component.key} className={styles.costRow} title={component.basis}>
                    <span>{component.label}</span>
                    <span className={styles.costAmount}>{currency(component.amount)}</span>
                    <span className={styles.costTrack} aria-hidden="true">
                      <span
                        className={`${styles.costFill} ${costTone[component.key] ?? ""}`}
                        style={{ width: `${(component.amount / largestCost) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No hosting costs in this range.</p>
            )}
            <div className={styles.costTotal}>
              <span>Total direct costs</span>
              <span>{currency(selectedPeriodTotals.costs)}</span>
            </div>
          </section>
        </div>

        <section className={styles.card} aria-label="Renewals due soon">
          <div className={styles.cardHeader}>
            <h2>Renewals due in the next 90 days</h2>
            <p>
              {renewalsDue.length
                ? `${renewalsDue.length} term${renewalsDue.length === 1 ? "" : "s"} ending`
                : "None due"}
            </p>
          </div>
          {renewalsDue.length ? (
            <div className="table-wrap">
              <table className={styles.renewals}>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Platform</th>
                    <th>Last covered day</th>
                    <th>Current fee</th>
                  </tr>
                </thead>
                <tbody>
                  {renewalsDue.map((item) => (
                    <tr key={`${item.deal.id}-${item.platform}`}>
                      <td>
                        <a href={hubspotDealUrl(item.deal)} target="_blank" rel="noreferrer">
                          {item.deal.site_name ?? item.deal.deal_name ?? item.deal.hubspot_deal_id}
                        </a>
                      </td>
                      <td>
                        {item.platform}
                        {item.kind === "complimentary" ? " · complimentary" : ""}
                      </td>
                      <td className={item.daysLeft <= 30 ? styles.soon : undefined}>
                        {dateLabel(item.end)} ·{" "}
                        {item.daysLeft === 0
                          ? "today"
                          : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}`}
                      </td>
                      <td>{item.fee === null ? "—" : currency(item.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>No IVION or Benaco terms end in the next 90 days.</p>
          )}
        </section>

        <section className={styles.card} aria-label="Clients at today's rates">
          <div className={styles.cardHeader}>
            <h2>Clients at today&apos;s rates</h2>
            <p>
              {currency(clientTotals.annualRevenue)} a year from clients ·{" "}
              {currency(clientTotals.annualCost)} to host ·{" "}
              <span className={clientTotals.annualMargin < 0 ? styles.loss : undefined}>
                {currency(clientTotals.annualMargin)} margin
              </span>
            </p>
          </div>
          {view !== "benaco" && clientTotals.complimentarySites > 0 ? (
            <p className={styles.callout}>
              <strong>
                {clientTotals.complimentarySites} of {ivionSiteCount} active IVION sites have
                complimentary hosting
              </strong>
              {", included in their scanning fees. They hold "}
              {wholePercent(
                clientTotals.ivionPanos
                  ? clientTotals.complimentaryPanos / clientTotals.ivionPanos
                  : 0,
              )}
              {" of active panos, and their hosting costs about "}
              {currency(complimentaryHostingCost)}
              {" a year, covered by the scanning work rather than a hosting fee."}
            </p>
          ) : null}
          {clientEconomics.clients.length ? (
            <div className="table-wrap">
              <table className={`${styles.renewals} ${styles.clientTable}`}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Active hosting</th>
                    <th>Revenue / year</th>
                    <th>Cost / year</th>
                    <th>Margin / year</th>
                  </tr>
                </thead>
                <tbody>{clientEconomics.clients.slice(0, CLIENT_ROWS_SHOWN).map(clientRow)}</tbody>
              </table>
              {clientEconomics.clients.length > CLIENT_ROWS_SHOWN ? (
                <details className={styles.moreRows}>
                  <summary>
                    Show {clientEconomics.clients.length - CLIENT_ROWS_SHOWN} more clients
                  </summary>
                  <table className={`${styles.renewals} ${styles.clientTable}`}>
                    <tbody>{clientEconomics.clients.slice(CLIENT_ROWS_SHOWN).map(clientRow)}</tbody>
                  </table>
                </details>
              ) : null}
            </div>
          ) : (
            <p className={styles.empty}>No active hosting today.</p>
          )}
          {/* One string, so JSX line joining can never drop a space between sentences. */}
          <p className={styles.footnote}>
            {[
              "Revenue is each active paid term's fee as a yearly rate.",
              `IVION cost shares the average monthly NavVis hosting bill (${clientEconomics.ivionBilledMonths} months since ${dateLabel(HOSTING_REPORT_START)}) across today's active panos, about ${currency(clientEconomics.ivionCostPerPanoMonth, 3)} per pano per month; NavVis bills per instance, so this is an allocation.`,
              `Benaco cost is each tour's grid panos × ${currency(BENACO_ANNUAL_PANO_COST, 2)} a year plus a share of the subscription.`,
              "Clients are the deal's company in HubSpot; deals without one use the end of the deal name.",
            ].join(" ")}
          </p>
        </section>

        <details className={styles.fold}>
          <summary>
            <strong>Period table and cost detail</strong>
            <small>Exact values, invoices, Benaco tours and how contribution is calculated</small>
          </summary>
          <div className={styles.foldBody}>
            <section>
              <h3>How contribution is calculated</h3>
              <p>
                Revenue minus IVION costs minus Benaco costs. Each contracted fee counts once, in
                full, in the period its paid hosting starts. NavVis bills count in their invoice
                month. Benaco recorded tour charges count at the tour start; estimated days after
                billed coverage count at the start of the term they belong to. The $100 Benaco
                subscription counts every month. Reporting starts {dateLabel(HOSTING_REPORT_START)};
                configured instance rates are used only for future forecast months.
              </p>
            </section>

            <section>
              <h3>Period table</h3>
              <div className="table-wrap report-table-wrap">
                <table className="data-table hosting-financial-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Status</th>
                      <th>Revenue</th>
                      <th>Direct costs</th>
                      <th>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row) => {
                      const values = hostingRowForView(row, view);
                      const status = hostingPeriodStatus(row, view);
                      return (
                        <tr key={row.period}>
                          <td>
                            <strong>{row.period}</strong>
                          </td>
                          <td>{status}</td>
                          <td>{currency(values.revenue)}</td>
                          <td>{currency(values.costs)}</td>
                          <td
                            className={
                              // Green only for a fully recorded period; estimated, provisional or
                              // incomplete periods stay neutral even when positive.
                              values.netProfit < 0
                                ? "hosting-value--loss"
                                : hostingPeriodIsConfirmed(status)
                                  ? "hosting-value--profit"
                                  : "hosting-value--provisional"
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
            </section>

            <HostingCostAudit
              rows={displayedRows}
              view={view}
              from={displayedRangeFrom}
              to={displayedRangeTo}
            />

            {view !== "ivion" ? (
              <section>
                <h3>Benaco tour costs</h3>
                <p>
                  Recorded charges and estimated remaining hosting for tours that start in this
                  range.
                  {incompleteBenacoCosts > 0
                    ? ` ${incompleteBenacoCosts} tour${incompleteBenacoCosts === 1 ? " needs" : "s need"} a grid count or complete dates.`
                    : ""}
                </p>
                <div className="table-wrap report-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tour</th>
                        <th>Tour start</th>
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
                            {cost.missingInputs
                              ? "Incomplete"
                              : currency(cost.estimatedPanoCost, 2)}
                          </td>
                          <td>
                            {cost.missingInputs ? "Incomplete" : currency(cost.totalPanoCost, 2)}
                          </td>
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
              </section>
            ) : null}
          </div>
        </details>

        <details className={styles.fold}>
          <summary>
            <strong>Cost settings and data refreshes</strong>
            <small>
              IVION instance costs, Benaco bills and billing basis, recent HubSpot refreshes
            </small>
          </summary>
          <div className={styles.foldBody}>
            <section>
              <h3>IVION instance costs</h3>
              <div className="table-wrap report-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Instance</th>
                      <th>Started</th>
                      <th>Annual cost</th>
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
            </section>

            <section>
              <h3>Benaco billing basis</h3>
              <dl className="hosting-cost-model">
                <DetailItem label="Tour allocation">
                  Recorded tour pano charges, spread evenly over the days each charge covers, plus
                  grid panos × {currency(BENACO_ANNUAL_PANO_COST, 2)} × uncovered hosting days ÷ 365
                  for each term, booked at that term&apos;s start.
                </DetailItem>
                <DetailItem label="Subscription">
                  {currency(BENACO_ANNUAL_OVERHEAD)} per year (
                  {currency(BENACO_MONTHLY_OVERHEAD, 2)} per month), once for the company.
                </DetailItem>
                <DetailItem label="Grid panos">
                  HubSpot Counted Grid-Pano when entered, otherwise the matched billing detail.
                </DetailItem>
                <DetailItem label="Historical charges">
                  {currency(BENACO_PREVIOUSLY_PAID, 2)} previously paid +{" "}
                  {currency(BENACO_CATCH_UP_PAYMENT, 2)} catch-up ={" "}
                  {currency(BENACO_VERIFIED_PANO_TOTAL, 2)}, counted once.{" "}
                  {currency(earlierBenacoPanoCharges, 2)} covers days before{" "}
                  {HOSTING_REPORT_START_YEAR}.
                </DetailItem>
              </dl>
            </section>

            <section>
              <h3>Benaco monthly bills</h3>
              <p>
                Enter each monthly invoice once with its full total. These are kept to reconcile
                against tour-level charges and are not added to costs again.
              </p>
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
                          <td>
                            {currency(benacoBillCostPerActivePano(billedAmount, activePanos), 4)}
                          </td>
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

            <section>
              <h3>Recent hosting refreshes</h3>
              {data.syncRuns.length ? (
                <ul className="hosting-sync-list">
                  {data.syncRuns.map((run) => (
                    <li key={run.id}>
                      <strong>{run.status.replaceAll("_", " ")}</strong>
                      <span>
                        {dateTimeLabel(run.completed_at ?? run.started_at)} · {run.records_read}{" "}
                        read · {run.records_upserted} saved
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>No hosting refresh has run.</p>
              )}
            </section>
          </div>
        </details>

        <details className={styles.fold}>
          <summary>
            <strong>All hosting deals</strong>
            <small>
              {visibleDeals.length
                ? dealFiltersActive
                  ? `${visibleDeals.length} of ${filteredDeals.length} deals shown`
                  : `${visibleDeals.length} deals in this range · search and filter`
                : "No matching deals"}
            </small>
          </summary>
          <div className={styles.foldBody}>
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
                const tourCost = data.benacoTourCosts.find(
                  (cost) =>
                    cost.tourId ===
                    (benacoTourId(deal.benaco_url) ?? `deal:${deal.hubspot_deal_id}`),
                );
                // The whole tour's cost (all deals sharing the tour), the same figure as the tour
                // table, rather than one deal's term recalculated on its own.
                const fullBenacoTourCost = tourCost?.totalPanoCost ?? 0;
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
                              {termDateRangeLabel(
                                deal.benaco_hosting_start,
                                deal.benaco_hosting_end,
                              )}
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
          </div>
        </details>
      </main>
    </AppShell>
  );
}
