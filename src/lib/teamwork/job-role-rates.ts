import { numberAtPaths, textAtPaths, type TeamworkRecord } from "./fields";

export type ParsedJobRoleRate = {
  costRate: number | null;
  currencyCode: string | null;
};

function record(value: unknown): TeamworkRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as TeamworkRecord)
    : null;
}

function entries(value: unknown): TeamworkRecord[] {
  if (Array.isArray(value)) return value.flatMap((item) => (record(item) ? [record(item)!] : []));
  const source = record(value);
  if (!source) return [];
  return Object.values(source).flatMap((item) => (record(item) ? [record(item)!] : []));
}

function currencyCode(value: TeamworkRecord): string | null {
  return (
    textAtPaths(value, [
      "currency.code",
      "currency.currencyCode",
      "currency.isoCode",
      "rate.currency.code",
      "rate.currency.currencyCode",
      "rate.currency.isoCode",
      "currencyCode",
      "isoCode",
      "code",
    ])?.toUpperCase() ?? null
  );
}

function amount(value: TeamworkRecord): number | null {
  return numberAtPaths(value, [
    "rate.amount",
    "amount",
    "costRate",
    "rate",
    "value",
  ]);
}

/**
 * Teamwork job roles expose cost rates under costRatesByCurrencyId. The exact
 * currency object shape varies by account/API response, so this parser prefers
 * USD when identifiable and otherwise uses the first finite returned cost rate.
 * Rates are hourly monetary values, not expense minor-unit values.
 */
export function parseJobRoleCostRate(
  row: TeamworkRecord,
  preferredCurrency = "USD",
): ParsedJobRoleRate {
  const directRate = numberAtPaths(row, ["costRate", "userCost"]);
  if (directRate !== null) {
    return {
      costRate: directRate,
      currencyCode:
        textAtPaths(row, ["costCurrency", "currencyCode", "currency.code"])?.toUpperCase() ??
        preferredCurrency,
    };
  }

  const candidates = entries(row.costRatesByCurrencyId ?? row.costRates ?? row.costRate);
  const parsed = candidates
    .map((candidate) => ({ rate: amount(candidate), currency: currencyCode(candidate) }))
    .filter((candidate): candidate is { rate: number; currency: string | null } =>
      candidate.rate !== null,
    );
  const preferred = parsed.find((candidate) => candidate.currency === preferredCurrency.toUpperCase());
  const selected = preferred ?? parsed[0] ?? null;
  return {
    costRate: selected?.rate ?? null,
    currencyCode: selected?.currency ?? (selected ? preferredCurrency : null),
  };
}
