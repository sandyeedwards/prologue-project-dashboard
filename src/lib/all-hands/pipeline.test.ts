import { describe, expect, it } from "vitest";
import { closeDateValue, summarizePipelines, summarizeWonDeals } from "./pipeline";

const pipelines = [
  {
    id: "default",
    label: "Sales",
    stages: [
      { id: "qualified", label: "Qualified", displayOrder: 1 },
      { id: "proposal", label: "Proposal sent", displayOrder: 2 },
    ],
  },
];
const deal = (id: string, props: Record<string, unknown>) => ({
  id,
  properties: { pipeline: "default", ...props },
});

describe("pipeline summary", () => {
  it("keeps HubSpot plain close dates on their day and Eastern-dates timestamps", () => {
    expect(closeDateValue("2026-12-01T00:00:00.000Z")).toBe("2026-12-01");
    expect(closeDateValue("2026-12-01T03:30:00.000Z")).toBe("2026-11-30");
    expect(closeDateValue("")).toBeNull();
  });

  it("totals stages in pipeline order and never counts a missing amount as $0", () => {
    const [sales] = summarizePipelines(
      [
        deal("1", {
          dealname: "Jefferson Hotel",
          dealstage: "proposal",
          amount: "12000",
          closedate: "2026-12-10T00:00:00Z",
        }),
        deal("2", {
          dealname: "Virginia Housing HQ",
          dealstage: "qualified",
          amount: "",
          closedate: "2026-11-01T00:00:00Z",
        }),
        deal("3", { dealname: "St. Christophers", dealstage: "qualified", amount: "5000" }),
      ],
      pipelines,
      "2026-11-23",
    );
    expect(sales.label).toBe("Sales");
    expect(sales.openCount).toBe(3);
    expect(sales.amount).toBe(17000);
    expect(sales.unpriced).toBe(1);
    expect(sales.stages.map((stage) => [stage.label, stage.count, stage.unpriced])).toEqual([
      ["Qualified", 2, 1],
      ["Proposal sent", 1, 0],
    ]);
    expect(sales.closingSoon.map((row) => row.name)).toEqual(["Jefferson Hotel"]);
    expect(sales.pastClose.map((row) => row.name)).toEqual(["Virginia Housing HQ"]);
    expect(sales.pastClose[0].amount).toBeNull();
    expect(sales.undated).toBe(1);
  });
});

describe("won deals", () => {
  it("sorts biggest first and keeps a missing amount missing", () => {
    const won = summarizeWonDeals([
      { id: "a", properties: { dealname: "Small", amount: "500" } },
      { id: "b", properties: { dealname: "No amount", amount: "" } },
      { id: "c", properties: { dealname: "Big", amount: "20000" } },
    ]);
    expect(won.deals.map((deal) => deal.name)).toEqual(["Big", "Small", "No amount"]);
    expect(won.amount).toBe(20500);
    expect(won.unpriced).toBe(1);
  });
});
