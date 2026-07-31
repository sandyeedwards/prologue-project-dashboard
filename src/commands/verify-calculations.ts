import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { verifyCalculations } from "@/lib/calculations/verify";

async function main() {
  const result = await verifyCalculations();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "PASS") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
