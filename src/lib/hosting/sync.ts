import { getSqlClient } from "@/db/client";

import {
  batchReadDeals,
  findDealListIdByName,
  getDealListMembershipIds,
  type HubSpotDeal,
} from "./hubspot";
import { buildHostingPropertyMap, hostingPropertiesToFetch } from "./property-map";

const HOSTING_LIST_NAME = "All Hosting Records";
const HOSTING_RUNNING_INDEX = "hosting_sync_runs_running_unique";
const STALE_SYNC_AFTER_HOURS = 2;

export type HostingSyncKind = "SCHEDULED" | "MANUAL";

export class HostingSyncAlreadyRunningError extends Error {
  constructor() {
    super("A Hosting synchronization is already running.");
    this.name = "HostingSyncAlreadyRunningError";
  }
}

export function isHostingSyncRunningConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const databaseError = error as {
    code?: unknown;
    constraint_name?: unknown;
    constraint?: unknown;
  };

  return (
    databaseError.code === "23505" &&
    (databaseError.constraint_name === HOSTING_RUNNING_INDEX ||
      databaseError.constraint === HOSTING_RUNNING_INDEX)
  );
}

function propertyValue(properties: Record<string, unknown>, propertyName: string | null): unknown {
  if (!propertyName) {
    return null;
  }

  return properties[propertyName] ?? null;
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const valueText = String(value).trim();

  return valueText.length > 0 ? valueText : null;
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/[$,]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeHostingIvionUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function hubspotDealUrl(dealId: string): string | null {
  const portalId = process.env.HUBSPOT_PORTAL_ID?.trim();

  if (!portalId) {
    return null;
  }

  return `https://app.hubspot.com/contacts/${portalId}/record/0-3/${dealId}`;
}

async function expireStaleHostingSyncs(): Promise<void> {
  const sql = getSqlClient();

  await sql`
    update hosting_sync_runs
    set
      status = 'FAILED',
      completed_at = now(),
      errors = errors + 1,
      message = 'Hosting synchronization was automatically closed after becoming stale.'
    where
      status = 'RUNNING'
      and started_at < now() - (${STALE_SYNC_AFTER_HOURS} * interval '1 hour')
  `;
}

async function createHostingSyncRun(
  kind: HostingSyncKind,
  triggeredByUserId: string | null,
): Promise<string> {
  const sql = getSqlClient();

  await expireStaleHostingSyncs();

  try {
    const rows = await sql`
      insert into hosting_sync_runs (
        kind,
        status,
        segment_name,
        message,
        triggered_by_user_id
      ) values (
        ${kind},
        'RUNNING',
        ${HOSTING_LIST_NAME},
        'Hosting synchronization started.',
        ${triggeredByUserId}
      )
      returning id
    `;

    return String(rows[0].id);
  } catch (error) {
    if (isHostingSyncRunningConstraintError(error)) {
      throw new HostingSyncAlreadyRunningError();
    }

    throw error;
  }
}

async function ivionSiteLookup(): Promise<Map<string, string>> {
  const sql = getSqlClient();

  const rows = await sql`
    select id, url
    from hosting_ivion_sites
  `;

  const lookup = new Map<string, string>();

  for (const row of rows) {
    const normalized = normalizeHostingIvionUrl(String(row.url));

    if (normalized) {
      lookup.set(normalized, String(row.id));
    }
  }

  return lookup;
}

async function upsertHostingDeal(
  deal: HubSpotDeal,
  siteLookup: Map<string, string>,
  propertyMap: Awaited<ReturnType<typeof buildHostingPropertyMap>>,
): Promise<void> {
  const sql = getSqlClient();

  const properties = deal.properties || {};
  const hubspotDealId = String(deal.id);

  const dealName =
    textValue(properties.dealname) ?? textValue(propertyValue(properties, propertyMap.dealName));

  const ivionInstance = textValue(propertyValue(properties, propertyMap.ivionInstance));

  const normalizedIvionInstance = normalizeHostingIvionUrl(ivionInstance);

  const ivionSiteId = normalizedIvionInstance
    ? (siteLookup.get(normalizedIvionInstance) ?? null)
    : null;

  await sql`
    insert into hosting_deals (
      hubspot_deal_id,
      deal_name,
      site_name,
      hubspot_url,

      is_in_all_hosting_records,
      last_seen_in_all_hosting_records_at,
      removed_from_all_hosting_records_at,
      synced_at,

      ivion_site_id,
      ivion_instance,
      ivion_hosting_start,
      ivion_hosting_end,
      ivion_contracted_fee,
      ivion_total_panos,
      ivion_active_panos,
      ivion_comp_start,
      ivion_comp_end,
      ivion_comp_contracted_fee,
      ivion_calculated_quarterly_fee,
      ivion_contracted_quarterly_fee,
      ivion_date_added,
      ivion_date_sent_to_client,
      ivion_bundle_archive_date,

      benaco_hosting_start,
      benaco_hosting_end,
      benaco_contracted_fee,
      benaco_total_panos,
      benaco_comp_start,
      benaco_comp_end,
      benaco_comp_contracted_fee,
      benaco_url,
      benaco_calculated_cost,
      benaco_annual_fee,

      hosting_notes,
      hosting_communications_contact,

      raw
    ) values (
      ${hubspotDealId},
      ${dealName},
      ${textValue(propertyValue(properties, propertyMap.siteName))},
      ${hubspotDealUrl(hubspotDealId)},

      true,
      now(),
      null,
      now(),

      ${ivionSiteId},
      ${ivionInstance},
      ${dateOnly(propertyValue(properties, propertyMap.ivionHostingStart))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionHostingEnd))},
      ${numericValue(propertyValue(properties, propertyMap.ivionContractedFee))},
      ${numericValue(propertyValue(properties, propertyMap.ivionTotalPanos))},
      ${numericValue(propertyValue(properties, propertyMap.ivionActivePanos))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionCompStart))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionCompEnd))},
      ${null},
      ${numericValue(propertyValue(properties, propertyMap.ivionCalculatedQuarterlyFee))},
      ${numericValue(propertyValue(properties, propertyMap.ivionContractedQuarterlyFee))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionDateAdded))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionDateSentToClient))},
      ${dateOnly(propertyValue(properties, propertyMap.ivionBundleArchiveDate))},

      ${dateOnly(propertyValue(properties, propertyMap.benacoHostingStart))},
      ${dateOnly(propertyValue(properties, propertyMap.benacoHostingEnd))},
      ${numericValue(propertyValue(properties, propertyMap.benacoContractedFee))},
      ${numericValue(propertyValue(properties, propertyMap.benacoTotalPanos))},
      ${dateOnly(propertyValue(properties, propertyMap.benacoCompStart))},
      ${dateOnly(propertyValue(properties, propertyMap.benacoCompEnd))},
      ${numericValue(propertyValue(properties, propertyMap.benacoCompContractedFee))},
      ${textValue(propertyValue(properties, propertyMap.benacoUrl))},
      ${numericValue(propertyValue(properties, propertyMap.benacoCalculatedCost))},
      ${numericValue(propertyValue(properties, propertyMap.benacoAnnualFee))},

      ${textValue(propertyValue(properties, propertyMap.hostingNotes))},
      ${textValue(propertyValue(properties, propertyMap.hostingCommunicationsContact))},

      ${JSON.stringify(deal)}::jsonb
    )
    on conflict (hubspot_deal_id) do update set
      deal_name = excluded.deal_name,
      site_name = excluded.site_name,
      hubspot_url = excluded.hubspot_url,

      is_in_all_hosting_records = true,
      last_seen_in_all_hosting_records_at = now(),
      removed_from_all_hosting_records_at = null,
      synced_at = now(),

      ivion_site_id = excluded.ivion_site_id,
      ivion_instance = excluded.ivion_instance,
      ivion_hosting_start = excluded.ivion_hosting_start,
      ivion_hosting_end = excluded.ivion_hosting_end,
      ivion_contracted_fee = excluded.ivion_contracted_fee,
      ivion_total_panos = excluded.ivion_total_panos,
      ivion_active_panos = excluded.ivion_active_panos,
      ivion_comp_start = excluded.ivion_comp_start,
      ivion_comp_end = excluded.ivion_comp_end,
      ivion_comp_contracted_fee = excluded.ivion_comp_contracted_fee,
      ivion_calculated_quarterly_fee = excluded.ivion_calculated_quarterly_fee,
      ivion_contracted_quarterly_fee = excluded.ivion_contracted_quarterly_fee,
      ivion_date_added = excluded.ivion_date_added,
      ivion_date_sent_to_client = excluded.ivion_date_sent_to_client,
      ivion_bundle_archive_date = excluded.ivion_bundle_archive_date,

      benaco_hosting_start = excluded.benaco_hosting_start,
      benaco_hosting_end = excluded.benaco_hosting_end,
      benaco_contracted_fee = excluded.benaco_contracted_fee,
      benaco_total_panos = excluded.benaco_total_panos,
      benaco_comp_start = excluded.benaco_comp_start,
      benaco_comp_end = excluded.benaco_comp_end,
      benaco_comp_contracted_fee = excluded.benaco_comp_contracted_fee,
      benaco_url = excluded.benaco_url,
      benaco_calculated_cost = excluded.benaco_calculated_cost,
      benaco_annual_fee = excluded.benaco_annual_fee,

      hosting_notes = excluded.hosting_notes,
      hosting_communications_contact = excluded.hosting_communications_contact,

      raw = excluded.raw,
      updated_at = now()
  `;
}

async function removeDealsNoLongerInSegment(membershipIds: Set<string>): Promise<string[]> {
  const sql = getSqlClient();

  const rows = await sql`
    select hubspot_deal_id
    from hosting_deals
    where is_in_all_hosting_records = true
  `;

  const removedIds = rows
    .map((row) => String(row.hubspot_deal_id))
    .filter((id) => !membershipIds.has(id));

  for (const hubspotDealId of removedIds) {
    await sql`
      update hosting_deals
      set
        is_in_all_hosting_records = false,
        removed_from_all_hosting_records_at = now(),
        updated_at = now()
      where
        hubspot_deal_id = ${hubspotDealId}
        and is_in_all_hosting_records = true
    `;
  }

  return removedIds;
}

export async function runHostingSync(
  kind: HostingSyncKind,
  triggeredByUserId: string | null = null,
) {
  const sql = getSqlClient();
  const runId = await createHostingSyncRun(kind, triggeredByUserId);

  try {
    const listId = await findDealListIdByName(HOSTING_LIST_NAME);
    const membershipIds = await getDealListMembershipIds(listId);

    const propertyMap = await buildHostingPropertyMap();
    const properties = hostingPropertiesToFetch(propertyMap);

    const deals = await batchReadDeals(membershipIds, properties);

    const siteLookup = await ivionSiteLookup();

    for (const deal of deals) {
      await upsertHostingDeal(deal, siteLookup, propertyMap);
    }

    const membershipSet = new Set(membershipIds);

    const removedIds = await removeDealsNoLongerInSegment(membershipSet);

    const returnedDealIds = new Set(deals.map((deal) => String(deal.id)));

    const missingDealIds = membershipIds.filter((id) => !returnedDealIds.has(id));

    const warningCount = missingDealIds.length;
    const status = warningCount > 0 ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED";

    const summary = {
      listId,
      segmentName: HOSTING_LIST_NAME,
      membershipCount: membershipIds.length,
      dealsReturned: deals.length,
      removedDealIds: removedIds,
      missingDealIds,
    };

    await sql`
      update hosting_sync_runs
      set
        status = ${status},
        completed_at = now(),
        records_read = ${membershipIds.length},
        records_upserted = ${deals.length},
        records_removed_from_segment = ${removedIds.length},
        warnings = ${warningCount},
        errors = 0,
        message = ${
          warningCount > 0
            ? `Hosting synchronization completed with ${warningCount} warning(s).`
            : "Hosting synchronization completed."
        },
        property_map = ${JSON.stringify(propertyMap)}::jsonb,
        summary = ${JSON.stringify(summary)}::jsonb
      where id = ${runId}
    `;

    return {
      ok: true,
      runId,
      status,
      listId,
      segmentName: HOSTING_LIST_NAME,
      recordsRead: membershipIds.length,
      recordsUpserted: deals.length,
      recordsRemovedFromSegment: removedIds.length,
      warnings: warningCount,
      propertyMap,
      missingDealIds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await sql`
      update hosting_sync_runs
      set
        status = 'FAILED',
        completed_at = now(),
        errors = errors + 1,
        message = ${message}
      where id = ${runId}
    `;

    throw error;
  }
}
