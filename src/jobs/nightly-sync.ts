import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { runTeamworkSync } from "@/lib/teamwork/sync";
import { syncFinancialSources } from "@/lib/calculations/financial-sync";
import { calculateAllProjects } from "@/lib/calculations/engine";
import { createProjectSnapshots } from "@/lib/calculations/snapshots";

async function main() {
  const sync = await runTeamworkSync("NIGHTLY");
  let financials: unknown;
  try {
    financials = await syncFinancialSources();
  } catch (error) {
    financials = {
      status: "CONTINUED_WITHOUT_FINANCIAL_REFRESH",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
  const calculations = await calculateAllProjects();
  const snapshot = await createProjectSnapshots();
  console.log(JSON.stringify({ sync, financials, calculations, snapshot }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
