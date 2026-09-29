import { describe, expect, it } from "vitest";

import { hostingPropertiesToFetch, resolveHostingPropertyMap } from "./property-map";

describe("resolveHostingPropertyMap", () => {
  it("matches the current complimentary Benaco end-date label", () => {
    const map = resolveHostingPropertyMap([
      { name: "dealname", label: "Deal Name" },
      {
        name: "complimentary_benaco_hosting_end",
        label: "Complimentary Benaco Hosting End",
      },
    ]);

    expect(map.benacoCompEnd).toBe("complimentary_benaco_hosting_end");
    expect(hostingPropertiesToFetch(map)).toContain("complimentary_benaco_hosting_end");
  });

  it("keeps quarterly IVION detail separate from paid term revenue", () => {
    const map = resolveHostingPropertyMap([
      { name: "ivion_quarterly_fee", label: "Ivion Contracted Fee/quarterly" },
      { name: "ivion_term_fee", label: "Ivion Contracted Term Fee" },
    ]);

    expect(map.ivionContractedFee).toBe("ivion_term_fee");
    expect(map.ivionContractedQuarterlyFee).toBe("ivion_quarterly_fee");
    expect(hostingPropertiesToFetch(map)).toContain("ivion_quarterly_fee");
  });

  it("fetches safe hosting detail fields without requesting credentials", () => {
    const map = resolveHostingPropertyMap([
      { name: "site_name", label: "Site Name" },
      { name: "benaco_url", label: "Benaco URL" },
      { name: "hosting_notes", label: "Hosting Notes" },
      { name: "hosting_contact", label: "Hosting Communications Contact" },
      { name: "benaco_password", label: "Benaco Password" },
    ]);
    const properties = hostingPropertiesToFetch(map);

    expect(properties).toEqual(
      expect.arrayContaining(["site_name", "benaco_url", "hosting_notes", "hosting_contact"]),
    );
    expect(properties).not.toContain("benaco_password");
  });
});
