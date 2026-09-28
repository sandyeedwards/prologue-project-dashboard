import { AppShell } from "@/components/app-shell";
import { FinancialReportFilters } from "@/components/financial-report-filters";
import { HoursCompletionSummary } from "@/components/hours-completion-summary";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";
import { ChartPanel, PortfolioAnalysisDisclosure } from "@/components/reporting-charts";
import { requireUser } from "@/lib/auth/session";
import { getFinancialPageData } from "@/lib/reporting/financial-page-data";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationalPerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/operational-performance");
  const data = await getFinancialPageData(await searchParams);
  return (
    <AppShell user={session.user} contentTone="portfolio">
      <main className="shell shell--wide focused-report">
        <section className="report-titlebar"><div><p className="eyebrow">Company delivery view</p><h1>Operational Performance</h1><p>Compare revenue, cost, remaining work, and forecasted profit across operational groups.</p></div><div className="report-titlebar__actions"><FinancialReportFilters action="/operational-performance" {...data} /></div></section>
        <section className="report-section focused-report__primary">
          <PortfolioFinancialComposition rows={data.profitabilityRows} variant="groups" emptyMessage="No operational-group data matches these filters." />
        </section>
        <ChartPanel
          eyebrow="Effort exposure"
          title="Logged vs Estimated Hours by Group"
          description="Compare workload and overrun exposure across operational groups. Blue shows logged work within estimate; red shows work beyond estimate."
          help="Estimated hours come from the reporting estimate baseline for each operational group. Logged hours come from synchronized Teamwork time entries."
        >
          <HoursCompletionSummary rows={data.effortRows} />
        </ChartPanel>
        <PortfolioAnalysisDisclosure rows={data.profitabilityRows} showProjectAttention={false} />
      </main>
    </AppShell>
  );
}
