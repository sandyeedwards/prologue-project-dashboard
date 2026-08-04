import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { runTeamworkSync } from "@/lib/teamwork/sync";

async function main() {
  const result = await runTeamworkSync(
    process.argv.includes("--initial") ? "INITIAL_IMPORT" : "MANUAL",
  );
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
