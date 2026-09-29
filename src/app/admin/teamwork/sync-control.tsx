"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncResult = {
  status?: string;
  totals?: {
    read: number;
    created: number;
    updated: number;
    skipped: number;
  };
  datasets?: {
    timeEntries?: {
      read: number;
      created: number;
      updated: number;
      skipped: number;
    };
  };
  error?: string;
};

export function TeamworkSyncControl({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);

  async function runSync() {
    setRunning(true);
    setFailed(false);
    setMessage("Synchronizing Teamwork data. This can take a few minutes...");

    try {
      const response = await fetch("/api/teamwork/sync", { method: "POST" });
      const result = (await response.json()) as SyncResult;

      if (!response.ok) {
        throw new Error(result.error ?? `Sync failed with status ${response.status}.`);
      }

      const totals = result.totals;
      const timeEntries = result.datasets?.timeEntries;
      const summary = [
        `Sync ${result.status?.toLowerCase() ?? "completed"}.`,
        totals ? `${totals.read.toLocaleString()} total records read.` : undefined,
        timeEntries
          ? `${timeEntries.created.toLocaleString()} time entries created, ${timeEntries.updated.toLocaleString()} updated, and ${timeEntries.skipped.toLocaleString()} skipped.`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ");

      setMessage(summary);
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "grid", justifyItems: "start", gap: 12, marginTop: 18 }}>
      <button
        className="button button--primary"
        type="button"
        disabled={disabled || running}
        onClick={runSync}
      >
        {running ? "Running Teamwork sync..." : "Run Teamwork sync"}
      </button>
      {disabled && <p>Connect Teamwork before running a synchronization.</p>}
      {message && (
        <p role={failed ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
