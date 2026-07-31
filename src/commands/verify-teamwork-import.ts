import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { verifyTeamworkImport } from "@/lib/teamwork/verify";

async function main() {
  const result = await verifyTeamworkImport();
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
