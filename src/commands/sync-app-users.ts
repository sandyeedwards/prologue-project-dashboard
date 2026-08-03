import "dotenv/config";
import { syncAppUsersFromPeople } from "@/lib/auth/identity";

async function main() {
  const result = await syncAppUsersFromPeople();
  console.log(
    JSON.stringify({ status: result.activeAdmins > 0 ? "PASS" : "FAIL", ...result }, null, 2),
  );
  if (result.activeAdmins === 0) {
    throw new Error(
      "No active dashboard administrator exists. Set DASHBOARD_BOOTSTRAP_ADMIN_EMAILS to an internal Teamwork email and rerun Step 8 setup.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
