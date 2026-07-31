import { describe, expect, it } from "vitest";
import { isEligibleEmployee } from "./eligibility";

describe("isEligibleEmployee", () => {
  it("allows an active internal employee with an email", () => {
    expect(
      isEligibleEmployee({
        isActive: true,
        isClientUser: false,
        isServiceAccount: false,
        email: "employee@prologue.example",
      }),
    ).toBe(true);
  });

  it("rejects client users, service accounts, inactive people, and missing emails", () => {
    expect(
      isEligibleEmployee({
        isActive: true,
        isClientUser: true,
        isServiceAccount: false,
        email: "client@example.com",
      }),
    ).toBe(false);
    expect(
      isEligibleEmployee({
        isActive: true,
        isClientUser: false,
        isServiceAccount: true,
        email: "service@example.com",
      }),
    ).toBe(false);
    expect(
      isEligibleEmployee({
        isActive: false,
        isClientUser: false,
        isServiceAccount: false,
        email: "inactive@example.com",
      }),
    ).toBe(false);
    expect(
      isEligibleEmployee({
        isActive: true,
        isClientUser: false,
        isServiceAccount: false,
        email: " ",
      }),
    ).toBe(false);
  });
});
