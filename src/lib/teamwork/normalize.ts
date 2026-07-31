/**
 * Converts Teamwork labels and tag references into text safely.
 * Teamwork can return a label as a string, number, object, or nested reference.
 */
export function teamworkLabelText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const candidate =
    record.name ?? record.label ?? record.title ?? record.value ?? record.displayName ?? record.tag;

  if (candidate === value) return "";
  return teamworkLabelText(candidate);
}

/**
 * Creates a stable comparison key for Teamwork names and tags.
 * It intentionally ignores spaces, punctuation, underscores, hyphens, and case.
 */
export function normalizeTeamworkLabel(value: unknown): string {
  return teamworkLabelText(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
