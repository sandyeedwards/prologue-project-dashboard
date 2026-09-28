import { AppShell } from "@/components/app-shell";
import { FinancialReportFilters } from "@/components/financial-report-filters";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";
import { requireUser } from "@/lib/auth/session";
import { getFinancialPageData } from "@/lib/reporting/financial-page-data";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProfitForecastPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/profit-forecast");
  const data = await getFinancialPageData(await searchParams);
  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide focused-report">
        <section className="report-titlebar">
          <div><p className="eyebrow">Company financial outlook</p><h1>Profit Forecast</h1><p>See the exact expected profit, current cost, remaining work, and margin for the filtered company view.</p></div>
          <div className="report-titlebar__actions"><FinancialReportFilters action="/profit-forecast" {...data} /></div>
        </section>
        <section className="report-section focused-report__primary">
          <div className="section-heading"><div><p className="eyebrow">Current forecast</p><h2>Where company revenue is expected to go</h2></div><p>Every figure below reflects the active filters.</p></div>
          {data.totalProfitabilityRow ? <PortfolioFinancialComposition rows={[data.totalProfitabilityRow]} variant="total" /> : <div className="chart-empty">No financial data matches these filters.</div>}
        </section>
      </main>
    </AppShell>
  );
}
