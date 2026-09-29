"use client";

import { useState } from "react";

function responseFilename(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  return disposition.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function PayrollExportButton({ csvUrl, pdfUrl }: { csvUrl: string; pdfUrl: string }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const exportTime = async () => {
    setState("working");
    try {
      const [csvResponse, pdfResponse] = await Promise.all([
        fetch(csvUrl, { credentials: "same-origin" }),
        fetch(pdfUrl, { credentials: "same-origin" }),
      ]);
      if (!csvResponse.ok || !pdfResponse.ok) throw new Error("Export failed");
      const [csvBlob, pdfBlob] = await Promise.all([csvResponse.blob(), pdfResponse.blob()]);
      saveBlob(csvBlob, responseFilename(csvResponse, "Prologue_Time_ADP.csv"));
      window.setTimeout(
        () => saveBlob(pdfBlob, responseFilename(pdfResponse, "Prologue_Time_Summary.pdf")),
        180,
      );
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="payroll-export-action">
      <button
        className="button button--primary"
        type="button"
        onClick={exportTime}
        disabled={state === "working"}
      >
        {state === "working" ? "Preparing files..." : "Export Time"}
      </button>
      <small>
        {state === "error"
          ? "The export could not be prepared. Please try again."
          : "Downloads the ADP preparation CSV and branded PDF summary."}
      </small>
    </div>
  );
}
