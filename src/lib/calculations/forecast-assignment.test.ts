import { describe, expect, it } from "vitest";
import { resolveForecastAssignment } from "./forecast-assignment";

const empty = { teamIds: [], companyIds: [] };

describe("remaining-work assignment resolution", () => {
  it("uses individual assignments before job roles", () => {
    const result = resolveForecastAssignment(
      { ...empty, userIds: [1], jobRoleIds: [10] },
      new Map([[1, 90]]),
      new Map([[10, 60]]),
    );
    expect(result.source).toBe("USER");
    expect(result.averageRate).toBe(90);
  });

  it("uses a job-role cost when no individual is assigned", () => {
    const result = resolveForecastAssignment(
      { ...empty, userIds: [], jobRoleIds: [10] },
      new Map(),
      new Map([[10, 75]]),
    );
    expect(result.source).toBe("JOB_ROLE");
    expect(result.averageRate).toBe(75);
    expect(result.knownRateCount).toBe(1);
  });

  it("splits remaining hours equally by using the average selected cost rate", () => {
    const result = resolveForecastAssignment(
      { ...empty, userIds: [1, 2], jobRoleIds: [] },
      new Map([
        [1, 80],
        [2, 100],
      ]),
      new Map(),
    );
    expect(result.averageRate).toBe(90);
  });
});
