import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { syncFinancialSources } from "@/lib/calculations/financial-sync";

async function main() {
  console.log(JSON.stringify(await syncFinancialSources(), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
