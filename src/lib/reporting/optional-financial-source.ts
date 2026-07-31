export type OptionalFinancialSource = {
  amountUsd: number | null;
  source: "teamwork" | "dashboard-override" | "missing";
  warning: string | null;
};

export type FinancialCoverageSummary = {
  amountUsd: number | null;
  knownSubtotalUsd: number;
  coveredItemCount: number;
  totalItemCount: number;
  missingItemCount: number;
  isComplete: boolean;
  warning: string | null;
};

export function resolveOptionalFinancialSource(input: {
  teamworkAmountUsd: number | null | undefined;
  dashboardOverrideUsd?: number | null;
  missingWarning: string;
}): OptionalFinancialSource {
  if (typeof input.teamworkAmountUsd === "number" && Number.isFinite(input.teamworkAmountUsd)) {
    return { amountUsd: input.teamworkAmountUsd, source: "teamwork", warning: null };
  }

  if (
    typeof input.dashboardOverrideUsd === "number" &&
    Number.isFinite(input.dashboardOverrideUsd)
  ) {
    return {
      amountUsd: input.dashboardOverrideUsd,
      source: "dashboard-override",
      warning: "Using an audited dashboard override because Teamwork returned no value.",
    };
  }

  return { amountUsd: null, source: "missing", warning: input.missingWarning };
}

export function summarizeFinancialCoverage(
  items: readonly OptionalFinancialSource[],
  incompleteWarning: string,
): FinancialCoverageSummary {
  const coveredItems = items.filter((item) => item.amountUsd !== null);
  const knownSubtotalUsd = coveredItems.reduce((sum, item) => sum + (item.amountUsd ?? 0), 0);
  const totalItemCount = items.length;
  const coveredItemCount = coveredItems.length;
  const missingItemCount = totalItemCount - coveredItemCount;
  const isComplete = totalItemCount > 0 && missingItemCount === 0;

  return {
    amountUsd: isComplete ? knownSubtotalUsd : null,
    knownSubtotalUsd,
    coveredItemCount,
    totalItemCount,
    missingItemCount,
    isComplete,
    warning: isComplete ? null : incompleteWarning,
  };
}
