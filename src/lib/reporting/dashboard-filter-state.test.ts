import { describe, expect, it } from "vitest";
import { dashboardFilterStateKey } from "./dashboard-filter-state";

const options = {
  clients: ["Client A", "Client B"],
  statuses: ["active", "complete"],
  types: ["Scanning", "Modeling"],
};

describe("dashboard filter state identity", () => {
  it("changes when URL-backed multi-select values change or reset", () => {
    const selected = dashboardFilterStateKey(
      { clients: ["Client A"], healths: ["GREEN"], statuses: [], types: [] },
      options,
    );
    const navigated = dashboardFilterStateKey(
      { clients: ["Client B"], healths: ["RED"], statuses: [], types: [] },
      options,
    );
    const reset = dashboardFilterStateKey(
      { clients: [], healths: [], statuses: [], types: [] },
      options,
    );

    expect(navigated).not.toBe(selected);
    expect(reset).not.toBe(selected);
  });

  it("changes when available options change so removed selections cannot remain visible", () => {
    const filter = { clients: ["Client A"], healths: [], statuses: [], types: [] };

    expect(dashboardFilterStateKey(filter, options)).not.toBe(
      dashboardFilterStateKey(filter, { ...options, clients: ["Client B"] }),
    );
  });
});
