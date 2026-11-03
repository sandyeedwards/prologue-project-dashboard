import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/teamwork/sync", () => ({ runTeamworkSync: vi.fn() }));
vi.mock("@/lib/calculations/financial-sync", () => ({ syncFinancialSources: vi.fn() }));
vi.mock("@/lib/calculations/engine", () => ({ calculateAllProjects: vi.fn() }));
vi.mock("@/lib/calculations/snapshots", () => ({ createProjectSnapshots: vi.fn() }));
import { runTeamworkSync } from "@/lib/teamwork/sync";
import { syncFinancialSources } from "@/lib/calculations/financial-sync";
import { calculateAllProjects } from "@/lib/calculations/engine";
import { createProjectSnapshots } from "@/lib/calculations/snapshots";
import { refreshTeamworkReporting } from "./refresh";

beforeEach(() => vi.resetAllMocks());
describe("complete reporting refresh", () => {
  it("does not publish new calculations or snapshots after failed financial import", async () => {
    vi.mocked(syncFinancialSources).mockRejectedValue(new Error("financial endpoint unavailable"));
    await expect(refreshTeamworkReporting("NIGHTLY")).rejects.toThrow(
      "financial endpoint unavailable",
    );
    expect(runTeamworkSync).toHaveBeenCalledWith("NIGHTLY");
    expect(calculateAllProjects).not.toHaveBeenCalled();
    expect(createProjectSnapshots).not.toHaveBeenCalled();
  });
  it("runs source, financials, calculations, and snapshot in order for manual refresh", async () => {
    await refreshTeamworkReporting("MANUAL");
    expect(runTeamworkSync).toHaveBeenCalledWith("MANUAL");
    const calls = [
      runTeamworkSync,
      syncFinancialSources,
      calculateAllProjects,
      createProjectSnapshots,
    ].map((fn) => vi.mocked(fn).mock.invocationCallOrder[0]);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
  });
  it("does not snapshot a failed calculation", async () => {
    vi.mocked(calculateAllProjects).mockRejectedValue(new Error("calculation failed"));
    await expect(refreshTeamworkReporting("MANUAL")).rejects.toThrow("calculation failed");
    expect(createProjectSnapshots).not.toHaveBeenCalled();
  });

  it("keeps optional financial-source warnings visible in the overall refresh result", async () => {
    vi.mocked(syncFinancialSources).mockResolvedValue({
      projectBudgetsRead: 1,
      projectBudgetsImported: 1,
      taskListBudgetsRead: 0,
      taskListBudgetsImported: 0,
      expensesRead: 0,
      expensesImported: 0,
      warnings: ["An optional expense endpoint was unavailable."],
    });
    const result = await refreshTeamworkReporting("MANUAL");
    expect(result.status).toBe("SUCCEEDED_WITH_WARNINGS");
    expect(result.financials.warnings).toHaveLength(1);
    expect(createProjectSnapshots).toHaveBeenCalledOnce();
  });
});
