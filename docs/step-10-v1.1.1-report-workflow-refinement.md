# Step 10 v1.1.1 — Report Workflow Refinement

## Scope

This release builds directly from Step 10 v1.1.0. It changes report layout and filtering interactions without changing the financial model, Teamwork integration, database schema, or reporting definitions.

## Dashboard

- One shared filter row appears beneath the profitability tabs and applies to all Dashboard KPIs and graphs.
- Visible controls are project dates, project type, client, health, and status.
- The primary profitability panel spans the full report width.
- Health Summary and Logged vs Estimated Hours are displayed below in a responsive support row.

## Projects workspace

- Search, project type, dates, client, health, and status are always visible.
- Applying filters preserves an open compare/combine mode and its selected project IDs.
- Compare Projects operational groups can be collapsed individually and are expanded by default.
- The Combined Report uses the same full-width graph and lower support-row layout as the Dashboard.

## Date entry

- A single click anywhere in a date field opens the browser calendar.
- A double-click enables manual entry.
- Accepted examples include `4/4/24`, `04/04/24`, `4-4-24`, and `04-04-2024`.
- Valid dates display as `MM/DD/YYYY`.
- Invalid dates and reversed ranges show inline errors and do not submit.

## Data and calculation impact

No formulas, stored values, project classifications, health calculations, Teamwork APIs, synchronization jobs, database migrations, or export definitions were changed.
