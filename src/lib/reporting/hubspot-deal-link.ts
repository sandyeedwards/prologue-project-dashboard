// Teamwork's HubSpot integration does not document where a project's linked deal is exposed.
// We therefore look through the imported Teamwork project record for a HubSpot deal reference:
// a HubSpot deal URL, or a field whose name identifies a HubSpot deal ID.
// Run `npm run teamwork:hubspot-links` against real data to confirm which field carries it.

const DEAL_URL =
  /app(?:-[a-z0-9]+)?\.hubspot\.com\/(?:contacts\/\d+\/(?:deal|record\/0-3)|sales\/\d+\/deal)\/(\d+)/i;
const DEAL_ID_KEY = /hubspot.*deal.*id|deal.*hubspot.*id|^hubspot_?deal$|^hs_?deal_?id$/i;

export type HubSpotDealReference = { dealId: string; path: string };

export function findHubSpotDealReference(raw: unknown): HubSpotDealReference | null {
  const seen = new Set<unknown>();
  const walk = (value: unknown, path: string, depth: number): HubSpotDealReference | null => {
    if (value === null || value === undefined || depth > 8) return null;
    if (typeof value === "string") {
      const match = DEAL_URL.exec(value);
      return match ? { dealId: match[1], path } : null;
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value as Record<string, unknown>);
    for (const [key, child] of entries) {
      const childPath = path ? `${path}.${key}` : key;
      if (
        DEAL_ID_KEY.test(key) &&
        (typeof child === "number" || typeof child === "string") &&
        /^\d{3,}$/.test(String(child).trim())
      )
        return { dealId: String(child).trim(), path: childPath };
      const found = walk(child, childPath, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(raw, "", 0);
}

export function hubSpotDealUrl(dealId: string, portalId = "4953519"): string | null {
  return /^\d+$/.test(dealId) && /^\d+$/.test(portalId)
    ? `https://app.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`
    : null;
}
