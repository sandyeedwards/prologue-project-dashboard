export type MarginTone = "red" | "yellow" | "green" | "neutral";

export function marginTone(value: string | number | null | undefined): MarginTone {
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
