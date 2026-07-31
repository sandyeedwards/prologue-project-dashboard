import { describe, expect, it } from "vitest";
import { collectionRows } from "./collections";

describe("collectionRows", () => {
  it("returns array collections unchanged", () => {
    expect(collectionRows([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("converts ID-keyed sideload collections to arrays", () => {
    expect(collectionRows({ "1": { id: 1 }, "2": { id: 2 } })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns an empty array for missing or invalid collections", () => {
    expect(collectionRows(undefined)).toEqual([]);
    expect(collectionRows(null)).toEqual([]);
    expect(collectionRows("invalid")).toEqual([]);
  });
});
