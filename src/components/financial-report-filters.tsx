import { DashboardPortfolioFilters } from "@/components/dashboard-portfolio-filters";
import type { ProjectFilter } from "@/lib/reporting/dashboard-data";

export function FinancialReportFilters({
  action,
  filter,
  clients,
  statuses,
  types,
}: {
  action: string;
  filter: ProjectFilter;
  clients: string[];
  statuses: string[];
  types: string[];
}) {
  return (
    <DashboardPortfolioFilters
      action={action}
      filter={filter}
      clients={clients}
      statuses={statuses}
      types={types}
      resetHref={action}
    />
  );
}
