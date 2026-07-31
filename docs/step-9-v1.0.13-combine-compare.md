# Step 9 v1.0.13 — Combined Projects Workspace

This release merges project selection, comparison, and combination into the Projects page.

## Rules

- Compare mode accepts up to six selected projects and keeps each project separate.
- Combine mode accepts any number of selected projects and aggregates whole-project metrics.
- Neither mode changes stored project calculations.
- Missing amounts remain missing at the project level; aggregate cards sum only known values.
- The combined margin is recalculated from combined fee and combined forecast profit rather than averaging project margins.
- Operational-group revenue and profit are not inferred. The profitability bridge compares selected projects because the reporting model does not allocate client fee to operational groups.

## Profitability bridge

- Client fee is plotted above the zero baseline.
- Forecast profit is shown as an inset portion of client fee.
- Forecast cost is shown below zero as a deduction.
- Profit is calculated once as client fee minus forecast cost.
- When more than ten projects are combined, the nine largest-fee projects are displayed individually and the remainder is aggregated for chart readability. All projects remain included in combined totals.
