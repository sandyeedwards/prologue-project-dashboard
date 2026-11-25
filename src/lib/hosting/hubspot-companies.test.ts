import { afterEach, describe, expect, it, vi } from "vitest";
import { pickDealCompanyId, readDealCompanies } from "./hubspot";

const target = (id: number, labels: Array<{ typeId?: number; label?: string | null }> = []) => ({
  toObjectId: id,
  associationTypes: labels,
});

describe("pickDealCompanyId", () => {
  it("uses the only associated company", () => {
    expect(pickDealCompanyId([target(11)])).toEqual({ companyId: "11", ambiguous: false });
  });

  it("uses the Primary company when there are several", () => {
    expect(
      pickDealCompanyId([
        target(11, [{ typeId: 341 }]),
        target(12, [{ typeId: 5, label: "Primary" }]),
      ]),
    ).toEqual({ companyId: "12", ambiguous: false });
  });

  it("does not guess between several companies without a Primary", () => {
    expect(pickDealCompanyId([target(11), target(12)])).toEqual({
      companyId: null,
      ambiguous: true,
    });
    expect(pickDealCompanyId([])).toEqual({ companyId: null, ambiguous: false });
  });
});

describe("readDealCompanies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads associations and company names in read-only batches", async () => {
    vi.stubEnv("HUBSPOT_ACCESS_TOKEN", "test-token");
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        calls.push({ url, body });
        const json = url.includes("/associations/")
          ? {
              results: [
                { from: { id: "1" }, to: [target(100)] },
                { from: { id: "2" }, to: [target(100), target(200, [{ typeId: 5 }])] },
                { from: { id: "3" }, to: [target(300), target(400)] },
              ],
            }
          : {
              results: [
                { id: "100", properties: { name: "3North" } },
                { id: "200", properties: { name: " Peregrine Hospitality " } },
              ],
            };
        return new Response(JSON.stringify(json), { status: 200 });
      }),
    );

    const result = await readDealCompanies(["1", "2", "3", "local-9"]);

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/crm/v4/associations/deals/companies/batch/read",
      "/crm/v3/objects/companies/batch/read",
    ]);
    // Only numeric HubSpot deal IDs are sent; each company is read once.
    expect(calls[0].body).toEqual({ inputs: [{ id: "1" }, { id: "2" }, { id: "3" }] });
    expect(calls[1].body).toEqual({ properties: ["name"], inputs: [{ id: "100" }, { id: "200" }] });
    expect(Object.fromEntries(result.companies)).toEqual({
      "1": { companyId: "100", companyName: "3North" },
      "2": { companyId: "200", companyName: "Peregrine Hospitality" },
    });
    expect(result.ambiguous).toBe(1);
  });
});
