"use client";

import { useEffect, useState } from "react";

type SelectedProject = { id: string; label: string };

export function ProjectSelectionTray({ initial }: { initial: SelectedProject[] }) {
  const [selected, setSelected] = useState(initial);

  useEffect(() => {
    const form = document.getElementById("project-selection");
    if (!form) return;
    const known = new Map(initial.map((project) => [project.id, project.label]));
    const update = () => {
      const ids = [...form.querySelectorAll<HTMLInputElement>('input[name="project"]')]
        .filter((input) => input.type !== "checkbox" || input.checked)
        .map((input) => {
          const label =
            input.dataset.projectLabel || known.get(input.value) || `Project ${input.value}`;
          return { id: input.value, label };
        });
      setSelected([...new Map(ids.map((project) => [project.id, project])).values()]);
    };
    form.addEventListener("change", update);
    update();
    return () => form.removeEventListener("change", update);
  }, [initial]);

  const clear = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("project");
    params.delete("mode");
    params.delete("action");
    window.location.assign(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="project-selection-tray" aria-live="polite">
      <details>
        <summary>
          {selected.length ? `${selected.length} selected · View selected` : "No projects selected"}
        </summary>
        {selected.length ? (
          <div className="project-selection-tray__panel">
            <ul>
              {selected.map((project) => (
                <li key={project.id}>{project.label}</li>
              ))}
            </ul>
            <button className="button button--secondary" type="button" onClick={clear}>
              Clear selection
            </button>
          </div>
        ) : null}
      </details>
    </div>
  );
}
