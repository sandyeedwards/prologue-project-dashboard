import { AppShell } from "@/components/app-shell";
import { FinancialReportFilters } from "@/components/financial-report-filters";
import { HistoricalRevenueProfitChart } from "@/components/historical-revenue-profit-chart";
import { requireUser } from "@/lib/auth/session";
import { getFinancialPageData } from "@/lib/reporting/financial-page-data";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RevenueTrendsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/revenue-trends");
  const data = await getFinancialPageData(await searchParams, { includeHistory: true });
  const latestHistoryDate = data.historicalProfitSeries
    ?.flatMap((series) => series.points.map((point) => point.date))
    .sort()
    .at(-1);
  const initialFrom = data.filter.dateFrom ?? "2026-04-01";
  const initialTo = data.filter.dateTo ?? latestHistoryDate;
  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide focused-report">
        <section className="report-titlebar">
          <div>
            <p className="eyebrow">Company history</p>
            <h1>Revenue Trends</h1>
            <p>Track recognized revenue, actual cost, expected cost, and net profit over time.</p>
          </div>
          <div className="report-titlebar__actions">
            <FinancialReportFilters action="/revenue-trends" {...data} />
          </div>
        </section>
        <section className="report-section focused-report__primary">
          <HistoricalRevenueProfitChart
            series={data.historicalProfitSeries ?? []}
            initialDateRange={{ from: initialFrom, to: initialTo }}
          />
        </section>
      </main>
    </AppShell>
  );
}
