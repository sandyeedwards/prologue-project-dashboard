import { describe, expect, it, vi } from "vitest";
import { runScheduledHostingSync } from "./scheduled-sync";
import { HostingSyncAlreadyRunningError } from "./sync";

describe("scheduled hosting sync", () => {
  it("retries a short overlap and refreshes after the active run finishes", async () => {
    const sync = vi
      .fn()
      .mockRejectedValueOnce(new HostingSyncAlreadyRunningError())
      .mockResolvedValueOnce({ ok: true, status: "SUCCEEDED" });
    const pause = vi.fn().mockResolvedValue(undefined);
    expect(await runScheduledHostingSync(sync, pause)).toMatchObject({ status: "SUCCEEDED" });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(15000);
  });

  it("reports a persistent overlap as skipped without bypassing the lock", async () => {
    const sync = vi.fn().mockRejectedValue(new HostingSyncAlreadyRunningError());
    const result = await runScheduledHostingSync(sync, vi.fn().mockResolvedValue(undefined));
    expect(result).toMatchObject({ skipped: true, status: "SKIPPED_ALREADY_RUNNING" });
    expect(sync).toHaveBeenCalledTimes(3);
  });

  it("does not hide genuine import failures", async () => {
    const sync = vi.fn().mockRejectedValue(new Error("HubSpot access denied"));
    await expect(runScheduledHostingSync(sync, vi.fn())).rejects.toThrow("HubSpot access denied");
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
