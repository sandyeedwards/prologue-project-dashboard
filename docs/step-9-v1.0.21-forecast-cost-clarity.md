# Step 9 v1.0.21 — Forecast-Cost Clarity

## Purpose

Make the forecast-cost calculation understandable from the Dashboard and remove the visual ambiguity between allocated revenue and forecast cost.

## Calculation presented to users

Forecast cost at completion is:

1. actual labor cost from Teamwork time entries;
2. plus active Teamwork expenses;
3. plus remaining estimated labor hours multiplied by assigned employee or job-role cost rates;
4. plus remaining outsourced-modeling cost.

Actual time-entry labor cost uses the historical cost total returned by Teamwork when available. When only a historical cost rate is available, the application calculates logged hours multiplied by that historical rate.

Remaining labor uses the canonical task estimate roll-up. Completed task branches have zero remaining minutes. Open branches use the greater of estimated minutes less logged minutes or zero, multiplied by the resolved average internal cost rate of assigned employees or job roles.

Projected outsourced cost uses the effective outsourced hourly rate and canonical estimated hours. Remaining outsourced cost is projected outsourced cost less matching actual outsourced expenses, clamped at zero.

Projects with incomplete rates, assignments, or expenses remain provisional. Their forecast cost is a known subtotal and may increase when missing inputs are resolved.

## Chart changes

- Allocated revenue is now a navy outline around the positive bar.
- Amber fill represents forecast cost at completion.
- Green fill represents forecast profit.
- A red cap identifies forecast loss when cost exceeds allocated revenue.
- The pale amber bar below zero mirrors forecast cost for cross-group comparison only.
- The tooltip now separates actual cost to date from costed remaining work.

## Operational-group aggregation

Operational-group actual cost is the sum of known actual labor and actual non-labor cost. Any project-level actual-cost amount not mapped to a task-list operational group is assigned to the existing fallback group, matching the forecast-gap treatment. Remaining group cost is forecast cost less actual cost, clamped at zero.

## Unchanged behavior

- Project fixed fees and operational-group revenue allocation rules are unchanged.
- Forecast profit remains allocated revenue less forecast cost.
- The below-zero cost mirror is not added to any total.
- No database migration is required.
- `NoReport` remains the sole reporting-exclusion tag.
