"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function selectedProjectIds() {
  const form = document.getElementById("project-selection");
  if (!form) return [];
  return [...form.querySelectorAll<HTMLInputElement>('input[name="project"]')]
    .filter((input) => input.type !== "checkbox" || input.checked)
    .map((input) => input.value);
}

export function ProjectLiveSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("page");
      params.delete("project");
      [...new Set(selectedProjectIds())].forEach((id) => params.append("project", id));
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, router]);

  return (
    <label className="project-live-search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </svg>
      <input
        aria-label="Search projects"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects, clients, numbers, or tags"
        autoComplete="off"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear project search">
          ×
        </button>
      ) : null}
    </label>
  );
}
