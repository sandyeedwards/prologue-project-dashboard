"use client";

import Link from "next/link";
import { FlexibleDateRangeFields } from "@/components/flexible-date-range-fields";
import type { ProjectFilter } from "@/lib/reporting/dashboard-data";

export function DashboardPortfolioFilters({
  action,
  filter,
  clients,
  statuses,
  types,
  resetHref,
}: {
  action: string;
  filter: ProjectFilter;
  clients: string[];
  statuses: string[];
  types: string[];
  resetHref: string;
}) {
  return (
    <form className="dashboard-inline-filters" method="get" action={action}>
      <div className="dashboard-inline-filters__priority">
        <FlexibleDateRangeFields
          initialFrom={filter.dateFrom}
          initialTo={filter.dateTo}
          className="dashboard-inline-filters__dates"
        />
        <label className="filter-field dashboard-inline-filters__type">
          <span>Project type</span>
          <select name="type" defaultValue={filter.type ?? "ALL"}>
            <option value="ALL">All project types</option>
            {types.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <small>Ready Set and DataHall also count as Scanning.</small>
        </label>
      </div>

      <div className="dashboard-inline-filters__secondary">
        <label className="filter-field">
          <span>Client</span>
          <select name="client" defaultValue={filter.client ?? "ALL"}>
            <option value="ALL">All clients</option>
            {clients.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Health</span>
          <select name="health" defaultValue={filter.health ?? "ALL"}>
            <option value="ALL">All health</option>
            <option value="GREEN">Healthy</option>
            <option value="AMBER">At risk</option>
            <option value="RED">Unhealthy</option>
            <option value="GRAY">N/A</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Status</span>
          <select name="status" defaultValue={filter.status ?? "ALL"}>
            <option value="ALL">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div className="dashboard-inline-filters__actions">
          <button className="button button--primary" type="submit">Update dashboard</button>
          <Link className="button button--secondary" href={resetHref}>Reset</Link>
        </div>
      </div>
    </form>
  );
}
