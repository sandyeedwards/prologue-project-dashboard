import { cache } from "react";
import { getSqlClient } from "@/db/client";
import { buildHostingDataIssues, type HostingIssueDeal } from "./data-issues";

// Request-local caching shares the same source checks between the admin badge
// and issue center. No vendor requests, writes, or report recalculation required.
export const getHostingDataIssues = cache(async () => {
  const sql = getSqlClient();
  const [deals, sites] = await Promise.all([
    sql<HostingIssueDeal[]>`
      select id,hubspot_deal_id,deal_name,site_name,
        ivion_instance,ivion_hosting_start,ivion_hosting_end,ivion_contracted_fee,
        ivion_total_panos,ivion_active_panos,ivion_comp_start,ivion_comp_end,
        benaco_hosting_start,benaco_hosting_end,benaco_contracted_fee,
        benaco_total_panos,benaco_counted_grid_panos,benaco_comp_start,benaco_comp_end,benaco_url
      from hosting_deals
      order by coalesce(site_name,deal_name,hubspot_deal_id)
    `,
    sql<Array<{ url: string }>>`select url from hosting_ivion_sites`,
  ]);
  return buildHostingDataIssues(deals, sites);
});
