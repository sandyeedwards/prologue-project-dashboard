import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { verifyTeamworkImport } from "@/lib/teamwork/verify";
import { syncFinancialSources } from "@/lib/calculations/financial-sync";
import { calculateAllProjects } from "@/lib/calculations/engine";
import { verifyCalculations } from "@/lib/calculations/verify";

async function main() {
  console.log("[1/4] Confirming the Step 6 Teamwork import...");
  const importVerification = await verifyTeamworkImport();
  if (importVerification.status !== "PASS") {
    console.log(JSON.stringify(importVerification, null, 2));
    throw new Error("Step 6 verification did not pass. Step 7 did not modify calculated data.");
  }
  console.log("Step 6 import is ready.\n");

  console.log("[2/4] Reading optional Teamwork financial sources...");
  let financialResult: unknown;
  try {
    financialResult = await syncFinancialSources();
  } catch (error) {
    financialResult = {
      status: "CONTINUED_WITHOUT_FINANCIAL_REFRESH",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
  console.log(JSON.stringify(financialResult, null, 2));
  console.log();

  console.log("[3/4] Calculating project, task, group, forecast, and health metrics...");
  const calculation = await calculateAllProjects();
  console.log(JSON.stringify(calculation, null, 2));
  console.log();

  console.log("[4/4] Verifying Step 7...");
  const verification = await verifyCalculations();
  console.log("\nStep 7 verification:");
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
