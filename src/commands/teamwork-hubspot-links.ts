import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { findHubSpotDealReference } from "@/lib/reporting/hubspot-deal-link";

// Read-only diagnostic: shows which active projects expose a HubSpot deal link in the imported
// Teamwork record, and where any "hubspot" text appears, so the MMM deal lookup can be confirmed.
function hubspotPaths(value: unknown, path = "", out: string[] = [], depth = 0): string[] {
  if (value === null || value === undefined || depth > 8 || out.length > 20) return out;
  if (typeof value === "string") {
    if (/hubspot/i.test(value)) out.push(`${path} = ${value.slice(0, 160)}`);
    return out;
  }
  if (typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (/hubspot|deal|crm/i.test(key))
      out.push(`${childPath} (key) = ${JSON.stringify(child)?.slice(0, 160)}`);
    hubspotPaths(child, childPath, out, depth + 1);
  }
  return out;
}

async function main() {
  const sql = getSqlClient();
  const rows = await sql<Array<{ name: string; teamworkId: number; raw: unknown }>>`
    select name, teamwork_id as "teamworkId", raw from projects
    where excluded_from_reporting=false and lower(trim(status))='active'
      and archived_at is null and completed_at is null
    order by name
  `;
  let linked = 0;
  for (const row of rows) {
    const reference = findHubSpotDealReference(row.raw);
    if (reference) linked += 1;
    const paths = hubspotPaths(row.raw);
    console.log(
      `${row.name} (Teamwork ${row.teamworkId}): ${
        reference ? `deal ${reference.dealId} via ${reference.path}` : "no deal reference found"
      }`,
    );
    for (const path of paths) console.log(`    ${path}`);
  }
  console.log(`\n${linked} of ${rows.length} active projects expose a HubSpot deal reference.`);
  if (!linked)
    console.log(
      "If Teamwork shows HubSpot links on these projects, the link is not in the imported project payload; it must be read from another Teamwork endpoint or a HubSpot deal property.",
    );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
