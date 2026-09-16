import "dotenv/config";

import { getSqlClient } from "@/db/client";
import { runHostingSync } from "@/lib/hosting/sync";

async function main() {
  const result = await runHostingSync("SCHEDULED");
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
