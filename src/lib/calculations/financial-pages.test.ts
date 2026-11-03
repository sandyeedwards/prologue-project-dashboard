import { describe, expect, it, vi } from "vitest";
import { readFinancialPages } from "./financial-pages";

describe("financial import pagination", () => {
  it("reads every page and retains sideloaded budgets from each page", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        projects: [{ id: 1 }, { id: 2 }],
        included: { projectBudgets: [{ id: 101 }] },
      })
      .mockResolvedValueOnce({
        projects: { "3": { id: 3 } },
        included: { projectBudgets: [{ id: 103 }] },
      });
    const result = await readFinancialPages(read, ["projects"], 2);
    expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3]);
    expect(result.payloads).toHaveLength(2);
    expect(read.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("rejects missing collections and repeated pages instead of importing a partial result", async () => {
    await expect(
      readFinancialPages(async () => ({ error: "forbidden" }), ["projects"]),
    ).rejects.toThrow("missing its expected collection");
    await expect(
      readFinancialPages(async () => ({ expenses: [{ id: 1 }] }), ["expenses"], 1),
    ).rejects.toThrow("repeated a page");
  });

  it("fails closed on page limits and propagates a later-page API failure", async () => {
    await expect(
      readFinancialPages(async (page) => ({ expenses: [{ id: page }] }), ["expenses"], 1, 2),
    ).rejects.toThrow("exceeded 2 pages");
    const read = vi
      .fn()
      .mockResolvedValueOnce({ expenses: [{ id: 1 }] })
      .mockRejectedValueOnce(new Error("timeout"));
    await expect(readFinancialPages(read, ["expenses"], 1)).rejects.toThrow("timeout");
  });

  it("rejects malformed collections instead of treating them as an empty final page", async () => {
    await expect(
      readFinancialPages(async () => ({ projects: null }), ["projects"]),
    ).rejects.toThrow("invalid projects collection");
    await expect(
      readFinancialPages(async () => ({ expenses: [null] }), ["expenses"]),
    ).rejects.toThrow("invalid records");
  });
});
