// Teamwork v3 sideloaded collections may be returned as arrays or as objects keyed by ID.
// Normalize both shapes so sync code never relies on `.length` or iteration on an object.
export function collectionRows<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as T[];
  }

  if (isRecord(value)) {
    return Object.values(value).filter(isRecord) as T[];
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
