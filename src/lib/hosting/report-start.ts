// Hosting reporting begins with 2025 (owner decision 2026-11-25): 2024 NavVis bills lack the
// line-item detail to separate hosting from Processing, so 2024 revenue and costs are both
// left out rather than reported provisionally. Invoice data before this date is kept.
// Kept free of server imports so client components can read it.
export const HOSTING_REPORT_START = "2025-01-01";
export const HOSTING_REPORT_START_YEAR = HOSTING_REPORT_START.slice(0, 4);
