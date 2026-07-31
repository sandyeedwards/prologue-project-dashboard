import { describe, expect, it } from "vitest";
import { hashSessionToken } from "./tokens";

describe("hashSessionToken", () => {
  it("is deterministic without storing the raw token", () => {
    expect(hashSessionToken("secret-token")).toHaveLength(64);
    expect(hashSessionToken("secret-token")).toBe(hashSessionToken("secret-token"));
    expect(hashSessionToken("secret-token")).not.toContain("secret-token");
  });
});
