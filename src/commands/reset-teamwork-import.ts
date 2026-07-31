import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { getSqlClient } from "@/db/client";
import { resetTeamworkImportData } from "@/lib/teamwork/reset";

async function main() {
  const skipPrompt = process.argv.includes("--yes");
  if (!skipPrompt) {
    const reader = createInterface({ input, output });
    const answer = await reader.question(
      'This clears the partial Teamwork import but preserves the OAuth connection. Type "RESET STEP 6" to continue: ',
    );
    reader.close();
    if (answer.trim() !== "RESET STEP 6") {
      console.log("Reset cancelled. No data was changed.");
      return;
    }
  }
  await resetTeamworkImportData();
  console.log("Partial Step 6 import data was cleared. The Teamwork connection was preserved.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
