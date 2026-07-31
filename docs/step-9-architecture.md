# Step 9 — Reporting Pages

Step 9 is a read-only presentation layer over the versioned Step 7 calculation outputs. It does not duplicate financial formulas in React pages and does not mutate Teamwork or calculated records.

## Routes

- `/dashboard` — portfolio KPIs, health attention list, recent calculated projects
- `/projects` — searchable and filterable portfolio table
- `/projects/[projectId]` — whole-project financials, coverage, operational groups, tasks, and data-quality issues
- `/compare` — side-by-side comparison of up to six projects
- `/manager` — employee hours and aggregate historical labor cost for Manager/Admin roles

## Financial display rules

- Missing values render as `Missing`, never `$0`.
- Provisional values are labeled wherever shown.
- Coverage states explain why a result is provisional.
- Project detail filters apply only to the detail table and never recalculate whole-project P&L.
- Operational groups show target-cost variance only. They do not claim group revenue, profit, or margin.
- Hourly rates are never selected by reporting queries or sent to the browser.

## Formula changes

Calculation changes remain in the calculation engine. After a later engine revision recalculates `project_metrics`, `task_metrics`, and `operational_group_metrics`, these pages display the new version automatically.
