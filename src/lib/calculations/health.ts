import type { HealthInput, HealthResult } from "./types";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function dateValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`).valueOf();
  return Number.isNaN(parsed) ? null : parsed;
}

export function calculateHealth(input: HealthInput): HealthResult {
  let financialScore: number | null = null;
  if (input.clientFee !== null && input.forecastMarginPercent !== null) {
    if (input.forecastMarginPercent < 0) financialScore = 0;
    else if (input.targetMarginPercent !== null && input.targetMarginPercent > 0) {
      financialScore = clamp((input.forecastMarginPercent / input.targetMarginPercent) * 100);
    } else {
      financialScore = clamp(50 + input.forecastMarginPercent * (50 / 30));
    }
  }

  const start = dateValue(input.startDate);
  const end = dateValue(input.endDate);
  const now = input.asOfDate.valueOf();
  let scheduleScore: number | null = null;
  if (start !== null && end !== null && end > start) {
    const expected = clamp(((now - start) / (end - start)) * 100);
    scheduleScore = expected <= 0 ? 100 : clamp((input.progressPercent / expected) * 100);
  } else if (input.progressPercent >= 0) {
    scheduleScore = clamp(input.progressPercent);
  }

  const effortScore =
    input.estimateConsumptionPercent === null
      ? null
      : input.estimateConsumptionPercent <= input.progressPercent + 10
        ? 100
        : input.estimateConsumptionPercent <= 0
          ? 100
          : clamp((input.progressPercent / input.estimateConsumptionPercent) * 100);

  const overdueScore =
    input.incompleteTaskCount === 0
      ? 100
      : clamp(100 * (1 - input.overdueIncompleteTaskCount / input.incompleteTaskCount));

  const components = [
    { value: financialScore, weight: 0.4 },
    { value: scheduleScore, weight: 0.25 },
    { value: effortScore, weight: 0.2 },
    { value: overdueScore, weight: 0.1 },
    { value: input.completenessScore, weight: 0.05 },
  ];
  const availableWeight = components.reduce(
    (sum, component) => sum + (component.value === null ? 0 : component.weight),
    0,
  );
  const healthScore =
    financialScore === null || availableWeight < 0.75
      ? null
      : components.reduce((sum, component) => sum + (component.value ?? 0) * component.weight, 0) /
        availableWeight;

  const overrides: string[] = [];
  const pastDue = end !== null && now > end;
  if (input.forecastMarginPercent !== null && input.forecastMarginPercent < 0) {
    overrides.push("NEGATIVE_FORECAST_MARGIN");
  }
  if (pastDue && input.progressPercent < 80) overrides.push("MATERIAL_INCOMPLETION_PAST_DUE");
  if (input.completenessScore < 25 && financialScore !== null)
    overrides.push("SEVERE_MISSING_DATA");

  let healthBand: HealthResult["healthBand"];
  if (healthScore === null) healthBand = "GRAY";
  else if (overrides.length > 0) healthBand = "RED";
  else if (healthScore >= 80) healthBand = "GREEN";
  else if (healthScore >= 60) healthBand = "AMBER";
  else healthBand = "RED";

  return {
    financialScore,
    scheduleScore,
    effortScore,
    overdueScore,
    completenessScore: clamp(input.completenessScore),
    healthScore,
    healthBand,
    overrides,
  };
}
