export type HistoricalProfitPoint = {
  date: string;
  grossRevenue: number;
  actualCostToDate: number;
  anticipatedCostToDate: number;
  netProfitToDate: number;
  forecastNetProfitToDate: number;
  projectCount: number;
  completedProjectCount: number;
  grossRevenueKnownCount: number;
  forecastCostKnownCount: number;
  forecastProfitKnownCount: number;
  costCoverageCompleteCount: number;
  costCoveragePartialCount: number;
  provisionalProjectCount: number;
  costedTimeEntryCount: number;
  costedExpenseCount: number;
  missingCostRecordCount: number;
  fallbackDatedLaborCount: number;
  fallbackDatedExpenseCount: number;
};

export type HistoricalProfitSeries = {
  projectType: string;
  points: HistoricalProfitPoint[];
  sourceActualCostTotal: number;
  metricActualCostTotal: number;
  reconciliationDifference: number;
};
