import { collectionRows } from "@/lib/teamwork/collections";
import type { TeamworkRecord } from "@/lib/teamwork/fields";

export async function readFinancialPages(
  readPage: (page: number, pageSize: number) => Promise<TeamworkRecord>,
  keys: readonly string[],
  pageSize = 250,
  maxPages = 100,
): Promise<{ rows: TeamworkRecord[]; payloads: TeamworkRecord[] }> {
  const rows: TeamworkRecord[] = [];
  const payloads: TeamworkRecord[] = [];
  const seenPages = new Set<string>();
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await readPage(page, pageSize);
    const key = keys.find((candidate) => candidate in payload);
    if (!key)
      throw new Error(
        `Financial response is missing its expected collection (${keys.join(" / ")}).`,
      );
    const collection = payload[key];
    if (typeof collection !== "object" || collection === null) {
      throw new Error(`Financial response contains an invalid ${key} collection.`);
    }
    const values = Array.isArray(collection) ? collection : Object.values(collection);
    if (
      values.some((value) => typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      throw new Error(`Financial response contains invalid records in ${key}.`);
    }
    const current = collectionRows<TeamworkRecord>(payload[key]);
    const signature = JSON.stringify(current);
    if (current.length && seenPages.has(signature))
      throw new Error(
        "Financial API repeated a page; refresh stopped to avoid publishing incomplete data.",
      );
    seenPages.add(signature);
    rows.push(...current);
    payloads.push(payload);
    if (current.length < pageSize) return { rows, payloads };
  }
  throw new Error(
    `Financial API exceeded ${maxPages} pages; refresh stopped before replacing budgets.`,
  );
}
