# Step 9 v1.0.24 — Compare and Combine cleanup

## Scope

This revision carries the v1.0.23 Dashboard presentation into the Compare selected and Combine selected reports without changing Teamwork synchronization, database structure, calculation rules, authentication, or reporting inclusion policy.

## Compare selected

- The primary financial chart now compares client fee with actual cost to date and costed remaining work.
- Forecast profit or loss is shown as a green or red marker with a visible value pill.
- Hover and keyboard-focus tooltips retain the exact values and margin.
- Logged versus estimated hours now uses percent-to-estimate progress and marks values above 100% as overruns.
- Margin and task completion are displayed in a dedicated compact summary instead of a generic grouped bar chart.
- Project cards show actual cost to date and remaining cost to complete rather than repeating forecast cost at completion.

## Combine selected

- The combined report now uses the same operational-group and total-profitability tabs as the Dashboard.
- The top KPI row uses Remaining cost to complete.
- The effort panel is now Logged vs Estimated Hours by Group with percent-to-estimate progress and overrun indicators.
- Active project-selection filters and selected-project scope continue to control every combined result.

## Financial presentation

The interface presents the cost composition directly:

```text
Actual cost to date + Costed remaining work = total expected cost
Allocated revenue or client fee - total expected cost = Forecast profit or loss
```

The underlying calculation engine and stored forecast-cost values remain unchanged. This is a presentation change only.

## Exclusion policy

`NoReport` remains the sole reporting-exclusion tag. Ready Set and DataHall projects remain eligible unless they also carry `NoReport`.
