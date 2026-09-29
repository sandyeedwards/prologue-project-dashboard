"use client";

import Link from "next/link";
import { useState } from "react";

type Option = [string | null, string];

export function PayrollFilters({
  date,
  ptoOnly,
  employee,
  project,
  employees,
  projects,
}: {
  date: string;
  ptoOnly: boolean;
  employee: string;
  project: string;
  employees: Option[];
  projects: Array<[string, string]>;
}) {
  const [onlyPto, setOnlyPto] = useState(ptoOnly);

  return (
    <form method="get" className="payroll-filters">
      <label>
        Date within pay period
        <input type="date" name="date" defaultValue={date} required />
      </label>
      <label>
        Time type
        <select
          name="type"
          defaultValue={ptoOnly ? "pto" : "all"}
          onChange={(event) => setOnlyPto(event.currentTarget.value === "pto")}
        >
          <option value="all">All time</option>
          <option value="pto">PTO only</option>
        </select>
      </label>
      <label>
        Employee
        <select name="employee" defaultValue={employee}>
          <option value="">All employees</option>
          {employees
            .filter(([id]) => id)
            .map(([id, name]) => (
              <option key={id} value={id!}>
                {name}
              </option>
            ))}
        </select>
      </label>
      {!onlyPto ? (
        <label>
          Project
          <select name="project" defaultValue={project}>
            <option value="">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="payroll-filters__pto-note">
          PTO is automatically limited to Internal Operations.
        </span>
      )}
      <button className="button" type="submit">
        Apply filters
      </button>
      <Link href="/time-reporting/payroll">Reset to current period</Link>
    </form>
  );
}
