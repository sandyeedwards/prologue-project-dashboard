import { describe, expect, it } from "vitest";
import { findHubSpotDealReference, hubSpotDealUrl } from "./hubspot-deal-link";

describe("HubSpot deal reference on a Teamwork project", () => {
  it("finds a deal URL anywhere in the project record", () => {
    expect(
      findHubSpotDealReference({
        name: "26-153",
        integrations: [{ url: "https://app.hubspot.com/contacts/4953519/record/0-3/123456789" }],
      }),
    ).toEqual({ dealId: "123456789", path: "integrations.0.url" });
    expect(
      findHubSpotDealReference({ link: "https://app.hubspot.com/contacts/4953519/deal/98765/" }),
    ).toMatchObject({ dealId: "98765" });
  });

  it("finds an explicitly named deal ID field", () => {
    expect(findHubSpotDealReference({ customFields: { hubspotDealId: "445566" } })).toEqual({
      dealId: "445566",
      path: "customFields.hubspotDealId",
    });
  });

  it("ignores unrelated IDs and non-deal HubSpot links", () => {
    expect(
      findHubSpotDealReference({
        id: 1939470,
        companyId: 55,
        website: "https://app.hubspot.com/contacts/4953519/record/0-1/777",
      }),
    ).toBeNull();
    expect(findHubSpotDealReference(null)).toBeNull();
  });

  it("builds a HubSpot record link only for numeric IDs", () => {
    expect(hubSpotDealUrl("123")).toBe("https://app.hubspot.com/contacts/4953519/record/0-3/123");
    expect(hubSpotDealUrl("abc")).toBeNull();
  });
});
