/**
 * Extracts a leading project number while preserving internal hyphens.
 * Example: "26-120 - Four Seasons Jackson Hole - BDT" -> "26-120".
 */
export function parseProjectNumber(projectName: string): string | null {
  const match = projectName.trim().match(/^([0-9]+(?:-[0-9]+)*)\b/);
  return match?.[1] ?? null;
}
