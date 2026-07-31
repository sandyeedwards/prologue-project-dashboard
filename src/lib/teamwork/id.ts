const COMMON_ID_KEYS = [
  "id",
  "projectId",
  "companyId",
  "tagId",
  "tasklistId",
  "taskListId",
  "taskId",
  "userId",
  "personId",
  "value",
] as const;

/**
 * Extracts a positive Teamwork numeric ID from scalar or nested API references.
 * Teamwork may return relationships as numbers, numeric strings, `{ id }`, or
 * nested reference objects depending on endpoint and sideloading options.
 */
export function teamworkNumericId(...values: unknown[]): number | null {
  const visited = new Set<object>();

  const parse = (value: unknown, depth: number): number | null => {
    if (depth > 5 || value === null || value === undefined || typeof value === "boolean") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    if (typeof value === "bigint") {
      const converted = Number(value);
      return Number.isSafeInteger(converted) && converted > 0 ? converted : null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!/^\d+$/.test(trimmed)) return null;
      const converted = Number(trimmed);
      return Number.isSafeInteger(converted) && converted > 0 ? converted : null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = parse(item, depth + 1);
        if (parsed !== null) return parsed;
      }
      return null;
    }

    if (typeof value === "object") {
      if (visited.has(value)) return null;
      visited.add(value);
      const record = value as Record<string, unknown>;
      for (const key of COMMON_ID_KEYS) {
        if (!(key in record)) continue;
        const parsed = parse(record[key], depth + 1);
        if (parsed !== null) return parsed;
      }
    }

    return null;
  };

  for (const value of values) {
    const parsed = parse(value, 0);
    if (parsed !== null) return parsed;
  }
  return null;
}
