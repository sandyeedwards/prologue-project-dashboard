import { teamworkNumericId } from "./id";

export type TeamworkRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is TeamworkRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function valueAtPath(record: TeamworkRecord, path: string): unknown {
  let current: unknown = record;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function firstValue(record: TeamworkRecord, paths: readonly string[]): unknown {
  for (const path of paths) {
    const value = valueAtPath(record, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function idAtPaths(record: TeamworkRecord, paths: readonly string[]): number | null {
  return teamworkNumericId(...paths.map((path) => valueAtPath(record, path)));
}

export function textAtPaths(record: TeamworkRecord, paths: readonly string[]): string | null {
  const value = firstValue(record, paths);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

export function numberAtPaths(record: TeamworkRecord, paths: readonly string[]): number | null {
  const value = firstValue(record, paths);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const converted = Number(value.replace(/[$,%\s,]/g, ""));
    return Number.isFinite(converted) ? converted : null;
  }
  return null;
}

export function booleanAtPaths(record: TeamworkRecord, paths: readonly string[]): boolean | null {
  const value = firstValue(record, paths);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
}
