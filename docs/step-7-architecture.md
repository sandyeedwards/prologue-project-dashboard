# Step 7 Calculation Architecture

## Purpose

Step 7 creates deterministic current reporting metrics from the verified Teamwork import while retaining source coverage and provisional-state information. It does not write data back to Teamwork.

## Processing sequence

1. Verify Step 6 import coverage.
2. Enrich optional project budgets, task-list budgets, and expenses from Teamwork.
3. Rebuild normalized task assignments from stored Teamwork task payloads.
4. Resolve canonical estimate branches.
5. Calculate task metrics.
6. Aggregate operational-group metrics.
7. Calculate project financial, effort, progress, forecast, completeness, and health metrics.
8. Replace current derived data-quality issues.
9. Verify coverage and the 26-101 Resort at Kapalua Bay outsourced-modeling pilot.

## Current metric tables

- `calculation_runs`: immutable execution history and summary.
- `project_metrics`: one current row per reporting-eligible project.
- `task_metrics`: one current row per non-deleted task in a reporting-eligible project.
- `operational_group_metrics`: one current row per project and operational group.

Historical reporting continues to use `project_snapshots`.

## Source precedence

### Actual labor

1. Teamwork historical time-entry total cost.
2. Teamwork historical time-entry cost rate × entry hours.
3. Missing actual labor cost warning.

Current employee rates are not substituted for missing historical actual cost.

### Outsourced actual cost

1. Matching Teamwork Finance expense total cost.
2. Notebook fallback after notebook content is added to the connector.
3. Missing outsourced actual cost warning.

The sources are mutually exclusive and never summed together.

## Partial-known values

When only part of a cost can be calculated, the known subtotal is retained and its coverage is `PARTIAL`. The dashboard must show the coverage and provisional warning beside the subtotal. Missing values are `null`, never zero.

## Project-only time

Project-only time contributes to project actual hours and labor cost. It is excluded from task-list and operational-group totals and creates an `UNALLOCATED_PROJECT_TIME` warning.

## Health behavior

Health uses fixed component weights. A missing core financial score produces gray rather than an invented numerical health result. Negative forecast margin and material incompletion past due force red.
