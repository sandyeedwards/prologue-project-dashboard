"use client";

import Link from "next/link";
import { useState } from "react";
import { FlexibleDateRangeFields } from "@/components/flexible-date-range-fields";
import type { ProjectFilter } from "@/lib/reporting/dashboard-data";

type CheckboxFilterOption = {
  value: string;
  label?: string;
};

function DashboardCheckboxFilter({
  label,
  name,
  selected,
  options,
  allLabel,
  help,
  className,
}: {
  label: string;
  name: string;
  selected: string[];
  options: CheckboxFilterOption[];
  allLabel: string;
  help?: string;
  className?: string;
}) {
  const allowed = new Set(options.map((option) => option.value));
  const [values, setValues] = useState(() =>
    selected.filter((value) => value !== "ALL" && allowed.has(value)),
  );

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((option) => option.value === values[0])?.label ?? values[0])
        : `${values.length} selected`;

  const toggleValue = (value: string) => {
    setValues((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  return (
    <div className={`filter-field dashboard-multi-filter${className ? ` ${className}` : ""}`}>
      <span className="dashboard-multi-filter__label">{label}</span>

      <details className="dashboard-multi-filter__details">
        <summary className="dashboard-multi-filter__summary">
          <span className="dashboard-multi-filter__summary-text">{summary}</span>
          <span className="dashboard-multi-filter__chevron" aria-hidden="true" />
        </summary>

        <div className="dashboard-multi-filter__menu">
          <label
            className={`dashboard-multi-filter__option dashboard-multi-filter__option--all${
              values.length === 0 ? " dashboard-multi-filter__option--selected" : ""
            }`}
          >
            <input type="checkbox" checked={values.length === 0} onChange={() => setValues([])} />
            <span>{allLabel}</span>
          </label>

          <div className="dashboard-multi-filter__options" role="group" aria-label={label}>
            {options.map((option) => {
              const checked = values.includes(option.value);

              return (
                <label
                  key={option.value}
                  className={`dashboard-multi-filter__option${
                    checked ? " dashboard-multi-filter__option--selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={option.value}
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>{option.label ?? option.value}</span>
                </label>
              );
            })}
          </div>
        </div>
      </details>

      {help ? <small>{help}</small> : null}
    </div>
  );
}

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

        <DashboardCheckboxFilter
          label="Project type"
          name="type"
          selected={filter.types ?? []}
          options={types.map((value) => ({ value }))}
          allLabel="All project types"
          help="Ready Set and DataHall also count as Scanning."
          className="dashboard-inline-filters__type"
        />
      </div>

      <div className="dashboard-inline-filters__secondary">
        <DashboardCheckboxFilter
          label="Client"
          name="client"
          selected={filter.clients ?? []}
          options={clients.map((value) => ({ value }))}
          allLabel="All clients"
        />

        <DashboardCheckboxFilter
          label="Health"
          name="health"
          selected={filter.healths ?? []}
          options={[
            { value: "GREEN", label: "Healthy" },
            { value: "AMBER", label: "At risk" },
            { value: "RED", label: "Unhealthy" },
            { value: "GRAY", label: "N/A" },
          ]}
          allLabel="All health"
        />

        <DashboardCheckboxFilter
          label="Status"
          name="status"
          selected={filter.statuses ?? []}
          options={statuses.map((value) => ({ value }))}
          allLabel="All statuses"
        />

        <div className="dashboard-inline-filters__actions">
          <button className="button button--primary" type="submit">
            Update dashboard
          </button>
          <Link className="button button--secondary" href={resetHref}>
            Reset
          </Link>
        </div>
      </div>
    </form>
  );
}
