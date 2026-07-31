import { REPORTING_RULES } from "@/config/reporting-rules";
import { normalizeTeamworkLabel } from "@/lib/teamwork/normalize";

const aliasKeys = new Set(REPORTING_RULES.outsourcedTaskAliases.map(normalizeTeamworkLabel));

export function isOutsourcedModelingTask(taskName: string): boolean {
  return aliasKeys.has(normalizeTeamworkLabel(taskName));
}

export function calculateProjectedOutsourcedCost(
  estimatedMinutes: number,
  hourlyRateUsd = REPORTING_RULES.outsourcedModelingHourlyRateUsd,
): number {
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0) {
    throw new RangeError("estimatedMinutes must be a non-negative finite number.");
  }

  if (!Number.isFinite(hourlyRateUsd) || hourlyRateUsd < 0) {
    throw new RangeError("hourlyRateUsd must be a non-negative finite number.");
  }

  return (estimatedMinutes / 60) * hourlyRateUsd;
}
