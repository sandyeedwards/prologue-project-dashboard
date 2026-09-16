export type HubSpotProperty = {
  name: string;
  label?: string;
};

export type HubSpotDeal = {
  id: string;
  properties?: Record<string, unknown>;
};

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const DEFAULT_LIST_API_VERSION = "2026-03";
const DEAL_OBJECT_TYPE_ID = "0-3";

function accessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!token) {
    throw new Error("HUBSPOT_ACCESS_TOKEN is not set.");
  }

  return token;
}

function listApiVersion(): string {
  return process.env.HUBSPOT_LIST_API_VERSION?.trim() || DEFAULT_LIST_API_VERSION;
}

async function hubspotFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const detail = body.length > 2000 ? `${body.slice(0, 2000)}...` : body;

    throw new Error(`HubSpot request failed ${response.status} ${response.statusText}: ${detail}`);
  }

  return (await response.json()) as T;
}

export async function getDealProperties(): Promise<HubSpotProperty[]> {
  const data = await hubspotFetch<{ results?: HubSpotProperty[] }>("/crm/v3/properties/deals");

  return data.results || [];
}

export async function findDealListIdByName(listName: string): Promise<string> {
  const apiVersion = listApiVersion();
  const encodedName = encodeURIComponent(listName);

  try {
    const data = await hubspotFetch<{
      list?: { listId?: string | number };
      listId?: string | number;
      id?: string | number;
    }>(`/crm/lists/${apiVersion}/object-type-id/${DEAL_OBJECT_TYPE_ID}/name/${encodedName}`);

    const listId = data.list?.listId ?? data.listId ?? data.id;

    if (listId !== undefined && listId !== null) {
      return String(listId);
    }
  } catch {
    // Fall through to the search endpoint. We still require an exact
    // list-name match before accepting a result.
  }

  const searchData = await hubspotFetch<{
    results?: Array<{
      listId?: string | number;
      id?: string | number;
      name?: string;
    }>;
    lists?: Array<{
      listId?: string | number;
      id?: string | number;
      name?: string;
    }>;
  }>(`/crm/lists/${apiVersion}/search`, {
    method: "POST",
    body: JSON.stringify({
      query: listName,
      objectTypeId: DEAL_OBJECT_TYPE_ID,
    }),
  });

  const candidates = searchData.results || searchData.lists || [];

  const exact = candidates.find(
    (item) =>
      String(item.name || "")
        .trim()
        .toLowerCase() === listName.trim().toLowerCase(),
  );

  const listId = exact?.listId ?? exact?.id;

  if (listId === undefined || listId === null) {
    throw new Error(`Could not find HubSpot deal list named "${listName}".`);
  }

  return String(listId);
}

export async function getDealListMembershipIds(listId: string): Promise<string[]> {
  const apiVersion = listApiVersion();
  const ids: string[] = [];
  let after: string | undefined;

  do {
    const params = new URLSearchParams({ limit: "500" });

    if (after) {
      params.set("after", after);
    }

    const data = await hubspotFetch<{
      results?: Array<{
        recordId?: string | number;
        id?: string | number;
        objectId?: string | number;
      }>;
      paging?: {
        next?: {
          after?: string;
        };
      };
    }>(`/crm/lists/${apiVersion}/${encodeURIComponent(listId)}/memberships?${params.toString()}`);

    for (const item of data.results || []) {
      const id = item.recordId ?? item.id ?? item.objectId;

      if (id !== undefined && id !== null) {
        ids.push(String(id));
      }
    }

    after = data.paging?.next?.after;
  } while (after);

  return Array.from(new Set(ids));
}

export async function batchReadDeals(ids: string[], properties: string[]): Promise<HubSpotDeal[]> {
  const uniqueProperties = Array.from(
    new Set(properties.filter((property) => property.trim().length > 0)),
  );

  const deals: HubSpotDeal[] = [];

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);

    const data = await hubspotFetch<{ results?: HubSpotDeal[] }>(
      "/crm/v3/objects/deals/batch/read",
      {
        method: "POST",
        body: JSON.stringify({
          properties: uniqueProperties,
          inputs: chunk.map((id) => ({ id })),
        }),
      },
    );

    deals.push(...(data.results || []));
  }

  return deals;
}
