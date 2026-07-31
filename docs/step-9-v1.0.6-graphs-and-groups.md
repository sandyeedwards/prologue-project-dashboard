# Step 9 v1.0.6 — Graphs, grouped task branches, and expense expectations

## Operational task layout

Calculated task branches are displayed inside their operational group or DataHall area. Search, operational-group, and assignment-coverage filters remain available and do not alter whole-project financial calculations.

## Graphs

- Portfolio: known financial position, health distribution, and estimated versus logged hours for the largest projects.
- Project: budget/cost/profit, estimated versus logged hours by group, and cost by group.
- Comparison: project financials, estimated versus logged hours, and margin/progress percentages.

All graphs use existing calculated reporting values. Missing values remain missing and are not replaced with zero.

## Provisional expense rule

An empty Teamwork expense list is treated as `NOT_EXPECTED` unless the project contains an outsourced-cost task. A Modeling project without outsourced work is therefore not provisional merely because it has no expense rows.

When an outsourced-cost task exists and no expense is returned, expense coverage remains `MISSING`. Imported expense rows with missing amounts remain partial or missing.
