import "dotenv/config";
import { getSqlClient } from "@/db/client";
import { createProjectSnapshots } from "@/lib/calculations/snapshots";

async function main() {
  const result = await createProjectSnapshots();
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
