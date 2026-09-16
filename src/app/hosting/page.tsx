import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { HostingFinancialChart } from "@/components/hosting-financial-chart";
import { HostingSyncControl } from "@/components/hosting-sync-control";
import { MetricCard } from "@/components/reporting-ui";
import { requireUser } from "@/lib/auth/session";
import {
  BENACO_ANNUAL_PANO_COST,
  BENACO_GRID_ESTIMATE_RATE,
  BENACO_MONTHLY_OVERHEAD,
  BENACO_SUBSCRIPTION_START,
  benacoPanoBasis,
  getHostingDashboardData,
  hasBenacoHosting,
  hasIvionHosting,
  hostingRowForView,
  isHostingDealActiveOn,
  type HostingDealRow,
  type HostingGrouping,
  type HostingRange,
  type HostingView,
} from "@/lib/hosting/reporting";

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

export default async function HostingPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/hosting");
  const params = await searchParams;
  const grouping = selectedGrouping(one(params.grouping));
  const range = selectedRange(one(params.range));
  const view = selectedView(one(params.view));
  const showForecast = selectedForecast(one(params.forecast));
  const dateFrom = one(params.dateFrom);
  const dateTo = one(params.dateTo);
  const data = await getHostingDashboardData({ grouping, range, dateFrom, dateTo });
  const latestSync = data.syncRuns[0] ?? null;
  const hasSourceData = Boolean(latestSync || data.deals.length || data.ivionSites.length);
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
  const estimatedBenacoRecords = benacoPanoBases.filter(
    (basis) => basis.source === "estimated",
  ).length;
  const estimatedCost = actualRows.reduce((sum, row) => sum + row.benacoEstimatedPanoCosts, 0);
  const viewLabel = views.find((option) => option.value === view)?.label ?? "Combined";
  const rangeLabel = ranges.find((option) => option.value === range)?.label ?? "Rolling 12 months";
  const syncTone = latestSync?.status === "FAILED" ? "hosting-status--failed" : "";

  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide hosting-page">
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Hosting revenue &amp; platform economics</p>
            <h1>Hosting Reporting</h1>
            <p>
              Track paid IVION and Benaco hosting revenue, direct platform costs, pano usage, and
              term coverage from the HubSpot hosting portfolio.
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
                ? `Last refresh ${dateTimeLabel(latestSync.completed_at ?? latestSync.started_at)}`
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
          <form className="hosting-grouping" method="get">
            <input type="hidden" name="view" value={view} />
            <label htmlFor="hosting-range">Time range</label>
            <select id="hosting-range" name="range" defaultValue={range}>
              {ranges.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="hosting-grouping">Periods</label>
            <select id="hosting-grouping" name="grouping" defaultValue={grouping}>
              {groupings.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="hosting-date-field">
              From
              <input type="date" name="dateFrom" defaultValue={dateFrom ?? ""} />
            </label>
            <label className="hosting-date-field">
              Through
              <input type="date" name="dateTo" defaultValue={dateTo ?? ""} />
            </label>
            <label className="hosting-forecast-toggle">
              <input type="checkbox" name="forecast" value="show" defaultChecked={showForecast} />
              Show forecast
            </label>
            <input type="hidden" name="forecast" value="hide" />
            <button className="button button--secondary" type="submit">
              Apply
            </button>
          </form>
        </section>

        <p className="hosting-range-summary">
          <strong>{rangeLabel}</strong> · {dateLabel(data.range.from)} through{" "}
          {dateLabel(data.range.to)}
          {showForecast ? " · Forecast is visible" : " · Actual periods only"}
        </p>

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

        {estimatedBenacoRecords ? (
          <section className="notice hosting-status-banner" aria-live="polite">
            <strong>
              {estimatedBenacoRecords} Benaco record{estimatedBenacoRecords === 1 ? "" : "s"} use a
              planning estimate.
            </strong>
            <span>
              Ivion Total Panos is missing, so counted panos are estimated at{" "}
              {BENACO_GRID_ESTIMATE_RATE * 100}% of Benaco Total Panos. Approximately{" "}
              {currency(estimatedCost, 2)} of displayed historical cost is estimated.
            </span>
          </section>
        ) : null}

        {session.user.role === "ADMIN" ? (
          <HostingSyncControl configured={Boolean(process.env.HUBSPOT_ACCESS_TOKEN)} />
        ) : null}

        <section className="metric-grid metric-grid--executive" aria-label="Hosting summary">
          <MetricCard
            label={`${viewLabel} Paid Revenue`}
            value={hasSourceData ? currency(totals.revenue) : "No data"}
            detail="Contracted hosting fees allocated across term periods"
            accent="blue"
            priority="primary"
          />
          <MetricCard
            label={`${viewLabel} Direct Costs`}
            value={hasSourceData ? currency(totals.costs) : "No data"}
            detail="Platform, subscription, and daily pano hosting costs"
            accent={view === "combined" ? "red" : "amber"}
            priority="primary"
          />
          <MetricCard
            label={`${viewLabel} Net Revenue`}
            value={hasSourceData ? currency(totals.netProfit) : "No data"}
            detail="Paid revenue less direct hosting costs"
            accent={hasSourceData && totals.netProfit < 0 ? "red" : "green"}
            priority="primary"
          />
          <MetricCard
            label="Active Hosting Deals"
            value={hasSourceData ? number(activeDeals.length) : "No data"}
            detail={`${filteredDeals.length} records contribute to this view and range`}
            accent="navy"
          />
          {view === "benaco" ? (
            <>
              <MetricCard
                label="Benaco Total Panos"
                value={hasSourceData ? number(benacoTotalPanos) : "No data"}
                detail="Complete site panos from Benaco Total Panos"
                accent="purple"
              />
              <MetricCard
                label="Benaco Counted Panos"
                value={hasSourceData ? number(benacoCountedPanos) : "No data"}
                detail="Ivion Total Panos; estimated at 28% only when missing"
                accent="gray"
              />
            </>
          ) : (
            <>
              <MetricCard
                label="IVION Active Panos"
                value={hasSourceData ? number(ivionActivePanos) : "No data"}
                detail={`${number(ivionTotalPanos)} total IVION panos in this range`}
                accent="purple"
              />
              <MetricCard
                label="Benaco Counted Panos"
                value={hasSourceData ? number(benacoCountedPanos) : "No data"}
                detail={`${number(benacoTotalPanos)} total Benaco panos in this range`}
                accent="gray"
              />
            </>
          )}
        </section>

        <section className="report-section hosting-report-section hosting-chart-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Company hosting timeline</p>
              <h2>{viewLabel} financial performance</h2>
            </div>
            <p>
              Paid revenue, direct cost composition, and net revenue across the selected history.
            </p>
          </div>
          <HostingFinancialChart rows={displayedRows} view={view} />
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
              <DetailItem label="Subscription overhead">
                {currency(BENACO_MONTHLY_OVERHEAD)} per month since{" "}
                {dateLabel(BENACO_SUBSCRIPTION_START)}
              </DetailItem>
              <DetailItem label="Counted pano rate">
                {currency(BENACO_ANNUAL_PANO_COST, 2)} per Ivion Total Pano per year
              </DetailItem>
              <DetailItem label="Daily calculation">
                Counted panos × $0.38 ÷ 365 × active days
              </DetailItem>
              <DetailItem label="Missing counted panos">
                Estimate at {BENACO_GRID_ESTIMATE_RATE * 100}% of Benaco Total Panos and label it
              </DetailItem>
            </dl>
          </article>
        </section>

        <section className="report-section hosting-report-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HubSpot list: All Hosting Records</p>
              <h2>Hosting deal detail</h2>
            </div>
            <p>
              {filteredDeals.length
                ? `${filteredDeals.length} records in this view`
                : "No matching records"}
            </p>
          </div>
          <div className="hosting-deal-list">
            {filteredDeals.map((deal) => {
              const hasIvion = hasIvionHosting(deal);
              const hasBenaco = hasBenacoHosting(deal);
              const basis = benacoPanoBasis(deal);
              const title = deal.site_name ?? deal.deal_name ?? deal.hubspot_deal_id;
              const dealUrl = hubspotDealUrl(deal);
              const fee =
                Number(deal.ivion_contracted_fee ?? 0) + Number(deal.benaco_contracted_fee ?? 0);
              const annualBenacoRunRate = basis.count * BENACO_ANNUAL_PANO_COST;

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
                        {hasBenaco
                          ? dateRangeLabel(deal.benaco_hosting_start, deal.benaco_hosting_end)
                          : dateRangeLabel(deal.ivion_hosting_start, deal.ivion_hosting_end)}
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
                            {dateRangeLabel(deal.ivion_hosting_start, deal.ivion_hosting_end)}
                          </DetailItem>
                          <DetailItem label="Complimentary term">
                            {dateRangeLabel(deal.ivion_comp_start, deal.ivion_comp_end)}
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
                            {dateRangeLabel(deal.benaco_hosting_start, deal.benaco_hosting_end)}
                          </DetailItem>
                          <DetailItem label="Complimentary term">
                            {dateRangeLabel(deal.benaco_comp_start, deal.benaco_comp_end)}
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
            {!filteredDeals.length ? (
              <div className="empty-panel">
                No hosting deals contribute to the selected service and time range.
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
