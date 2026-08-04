"use client";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function ProjectPageSizeSelect({ formId, value }: { formId: string; value: number }) {
  const handleChange = () => {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  };

  return (
    <label className="project-list-pagination__size">
      <span>Projects visible</span>
      <select
        aria-label="Projects visible per page"
        name="pageSize"
        defaultValue={String(value)}
        onChange={handleChange}
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
