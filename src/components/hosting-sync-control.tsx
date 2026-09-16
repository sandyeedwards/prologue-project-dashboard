"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type HostingSyncResult = {
  recordsRead?: number;
  recordsUpserted?: number;
  warnings?: number;
  error?: string;
};

export function HostingSyncControl({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);

  async function runSync() {
    setRunning(true);
    setFailed(false);
    setMessage("Refreshing hosting records from HubSpot...");

    try {
      const response = await fetch("/api/hosting/sync", { method: "POST" });
      const result = (await response.json()) as HostingSyncResult;

      if (!response.ok) {
        throw new Error(result.error ?? `Hosting refresh failed with status ${response.status}.`);
      }

      setMessage(
        `Refresh completed. ${(result.recordsRead ?? 0).toLocaleString()} records read, ${(result.recordsUpserted ?? 0).toLocaleString()} saved${result.warnings ? `, with ${result.warnings} warning(s)` : ""}.`,
      );
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="hosting-sync-control">
      <button
        className="button button--primary"
        type="button"
        disabled={!configured || running}
        onClick={runSync}
      >
        {running ? "Refreshing hosting data..." : "Refresh from HubSpot"}
      </button>
      {!configured ? <span>HubSpot access must be configured for this environment.</span> : null}
      {message ? (
        <span role={failed ? "alert" : "status"} aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  );
}
