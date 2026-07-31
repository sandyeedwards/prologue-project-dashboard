# Step 9 v1.0.22 — Tabbed profitability views

## Purpose

Give Dashboard users two ways to read the same filtered financial scope without adding another large chart card:

1. compare each operational group;
2. inspect all operational groups as one combined financial position.

## Dashboard behavior

The profitability card is a client-side tab interface with two views:

- **Profitability by Operational Group** renders one side-by-side revenue/cost pair per group.
- **Total Profitability** renders one centered revenue/cost pair that sums the operational-group results.

The Dashboard performs filtering before the chart rows are created. Both tabs receive those same filtered rows, so no separate filter state or query is introduced.

## Side-by-side visual model

For each group or total:

- allocated revenue is a blue bar;
- forecast cost at completion is an adjacent stacked bar;
- actual cost to date is dark amber;
- costed remaining work is light amber;
- forecast profit is a green marker positioned on the shared currency axis;
- forecast loss is a red marker positioned below zero.

Values remain hidden until hover or keyboard focus. The tooltip includes revenue, actual cost, remaining cost, forecast cost, profit or loss, margin, and project count.

## Total calculation

The total tab is derived from the operational-group rows already returned for the filtered Dashboard:

```text
revenue = sum(group allocated revenue)
forecast cost = sum(group forecast cost)
profit or loss = revenue - forecast cost
margin = profit or loss / revenue
```

Project count comes from the filtered project summary rather than summing group project counts, because one project can appear in more than one operational group.

## Accessibility

- Tabs use `role="tablist"`, `role="tab"`, and `role="tabpanel"`.
- Left Arrow and Right Arrow move between tabs.
- Home and End move to the first and last tab.
- Each chart group can receive keyboard focus.
- Escape closes an open tooltip.
- Each focusable group has an accessible text summary of its values.

## Scope intentionally unchanged

- Teamwork synchronization
- calculation formulas
- database schema
- authentication and roles
- `NoReport` as the sole exclusion tag
- Combined Project Report chart
