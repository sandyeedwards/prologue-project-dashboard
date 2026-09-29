"use client";

import { useMemo, useState } from "react";

type ProjectOption = {
  projectId: string;
  name: string;
};

export function TimeReportingProjectFilter({
  projects,
  selected,
}: {
  projects: readonly ProjectOption[];
  selected: readonly string[];
}) {
  const allowed = useMemo(() => new Set(projects.map((project) => project.projectId)), [projects]);

  const [values, setValues] = useState(() => selected.filter((value) => allowed.has(value)));

  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleProjects = useMemo(() => {
    if (!normalizedQuery) return projects;

    return projects.filter((project) => project.name.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, projects]);

  const summary =
    values.length === 0
      ? "All projects"
      : values.length === 1
        ? (projects.find((project) => project.projectId === values[0])?.name ?? "1 selected")
        : `${values.length} selected`;

  function toggle(projectId: string) {
    setValues((current) =>
      current.includes(projectId)
        ? current.filter((value) => value !== projectId)
        : [...current, projectId],
    );
  }

  return (
    <div className="time-reporting-filter-field time-reporting-filter-field--project">
      <span>Projects</span>

      {values.map((value) => (
        <input key={value} type="hidden" name="project" value={value} />
      ))}

      <details className="time-reporting-filter-menu">
        <summary>{summary}</summary>

        <div className="time-reporting-project-filter__menu">
          <div className="time-reporting-project-filter__search">
            <input
              type="search"
              value={query}
              placeholder="Search projects..."
              aria-label="Search projects"
              onChange={(event) => setQuery(event.target.value)}
            />

            {query ? (
              <button type="button" aria-label="Clear project search" onClick={() => setQuery("")}>
                ?
              </button>
            ) : null}
          </div>

          <label className="time-reporting-project-filter__all">
            <input type="checkbox" checked={values.length === 0} onChange={() => setValues([])} />
            <span>All projects</span>
          </label>

          <div className="time-reporting-filter-menu__options" role="group" aria-label="Projects">
            {visibleProjects.map((project) => (
              <label key={project.projectId}>
                <input
                  type="checkbox"
                  checked={values.includes(project.projectId)}
                  onChange={() => toggle(project.projectId)}
                />
                <span>{project.name}</span>
              </label>
            ))}

            {visibleProjects.length === 0 ? (
              <div className="time-reporting-project-filter__empty">
                No projects match ?{query}?.
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
