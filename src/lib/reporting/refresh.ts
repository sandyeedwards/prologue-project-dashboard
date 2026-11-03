import { runTeamworkSync } from "@/lib/teamwork/sync";
import { syncFinancialSources } from "@/lib/calculations/financial-sync";
import { calculateAllProjects } from "@/lib/calculations/engine";
import { createProjectSnapshots } from "@/lib/calculations/snapshots";

export async function refreshTeamworkReporting(kind: "NIGHTLY" | "MANUAL") {
  const sync = await runTeamworkSync(kind);
  // Stop on a failed financial refresh. Keep the previous complete report and
  // snapshot rather than marking stale financial data as newly calculated.
  const financials = await syncFinancialSources();
  const calculations = await calculateAllProjects();
  const snapshot = await createProjectSnapshots();
  const hasWarnings =
    sync?.status === "SUCCEEDED_WITH_WARNINGS" ||
    (financials?.warnings.length ?? 0) > 0 ||
    calculations?.status === "SUCCEEDED_WITH_WARNINGS";
  return {
    ...sync,
    status: hasWarnings ? "SUCCEEDED_WITH_WARNINGS" : "SUCCEEDED",
    financials,
    calculations,
    snapshot,
  };
}
