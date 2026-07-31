"use client";

import Link from "next/link";
import { FlexibleDateRangeFields } from "@/components/flexible-date-range-fields";
import type { ProjectFilter } from "@/lib/reporting/dashboard-data";

export function ProjectFilterBar({
  action,
  filter,
  clients,
  statuses,
  types,
  submitLabel = "Apply filters",
  resetHref,
  preservedMode,
  preservedProjectIds = [],
  preservedPageSize = 25,
}: {
  action: string;
  filter: ProjectFilter;
  clients: string[];
  statuses: string[];
  types: string[];
  submitLabel?: string;
  resetHref: string;
  preservedMode?: "compare" | "combine" | null;
  preservedProjectIds?: string[];
  preservedPageSize?: number;
}) {
  return (
    <form className="filter-panel filter-panel--projects filter-panel--visible" method="get" action={action}>
      <div className="filter-panel__heading">
        <div>
          <p className="eyebrow">Project workspace filters</p>
          <h2>Find the projects you want to compare or combine</h2>
          <p>Search directly, then narrow the reporting portfolio by type, planned dates, client, health, or status.</p>
        </div>
        <Link className="filter-panel__reset" href={resetHref}>Reset all</Link>
      </div>

      <div className="projects-filter-grid">
        <label className="filter-field filter-field--search projects-filter-grid__search">
          <span>Search projects</span>
          <input
            name="q"
            defaultValue={filter.query}
            placeholder="Project name, number, client, or tag"
            autoComplete="off"
          />
          <small>Search is available here for project selection and comparison workflows.</small>
        </label>

        <label className="filter-field projects-filter-grid__type">
          <span>Project type</span>
          <select name="type" defaultValue={filter.type ?? "ALL"}>
            <option value="ALL">All project types</option>
            {types.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <small>Ready Set and DataHall are included in Scanning.</small>
        </label>

        <FlexibleDateRangeFields
          initialFrom={filter.dateFrom}
          initialTo={filter.dateTo}
          className="projects-filter-grid__dates"
        />

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

        <div className="projects-filter-grid__actions">
          <button className="button button--primary" type="submit">{submitLabel}</button>
          <Link className="button button--secondary" href={resetHref}>Clear</Link>
        </div>
      </div>

      {preservedMode ? <input type="hidden" name="mode" value={preservedMode} /> : null}
      <input type="hidden" name="pageSize" value={preservedPageSize} />
      {preservedProjectIds.map((projectId) => <input key={projectId} type="hidden" name="project" value={projectId} />)}

      <p className="filter-policy-note"><strong>Reporting policy:</strong> projects tagged NoReport are excluded. Date filters use overlapping project dates. Search and filters do not change the selected projects in an open comparison or combined report.</p>
    </form>
  );
}
