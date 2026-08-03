import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getSqlClient } from "@/db/client";
import { resetTeamworkImportData } from "@/lib/teamwork/reset";
import { runTeamworkSync } from "@/lib/teamwork/sync";
import { verifyTeamworkImport } from "@/lib/teamwork/verify";

async function main() {
  const reader = createInterface({ input, output });
  console.log(
    "This clean restart preserves your Teamwork OAuth connection and Step 5 configuration.",
  );
  const answer = await reader.question(
    'Type "RESTART STEP 6" to clear the partial import and begin again: ',
  );
  reader.close();
  if (answer.trim() !== "RESTART STEP 6") {
    console.log("Restart cancelled. No data was changed.");
    return;
  }

  console.log("\nClearing the partial import...");
  await resetTeamworkImportData();
  console.log("Partial import cleared.\n");

  const syncResult = await runTeamworkSync("INITIAL_IMPORT");
  console.log("\nImport result:");
  console.log(JSON.stringify(syncResult, null, 2));

  const verification = await verifyTeamworkImport();
  console.log("\nStep 6 verification:");
  console.log(JSON.stringify(verification, null, 2));
  if (verification.status !== "PASS") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
