export type MarginTone = "red" | "yellow" | "green" | "neutral";

/**
 * A provisional margin is a ceiling (missing inputs can only add cost), so it is never shown as
 * a confirmed green result: what would be green is shown as yellow instead.
 */
export function marginTone(
  value: string | number | null | undefined,
  options: { provisional?: boolean } = {},
): MarginTone {
  const tone = baseMarginTone(value);
  return tone === "green" && options.provisional ? "yellow" : tone;
}

function baseMarginTone(value: string | number | null | undefined): MarginTone {
  if (value === null || value === undefined || value === "") {
    return "neutral";
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "neutral";
  }

  if (parsed <= 35) {
    return "red";
  }

  if (parsed < 50) {
    return "yellow";
  }

  return "green";
}
