import { HostingSyncAlreadyRunningError, runHostingSync } from "./sync";

export async function runScheduledHostingSync(
  sync = () => runHostingSync("SCHEDULED"),
  pause = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await sync();
    } catch (error) {
      if (!(error instanceof HostingSyncAlreadyRunningError)) throw error;
      if (attempt < 2) {
        await pause(15000);
        continue;
      }
      return {
        ok: true,
        skipped: true,
        status: "SKIPPED_ALREADY_RUNNING" as const,
        message:
          "Another hosting sync still owns the database lock after two retries. This invocation did not refresh data; inspect the active run if data is stale.",
      };
    }
  }
  throw new Error("Scheduled hosting sync exhausted its attempts.");
}
