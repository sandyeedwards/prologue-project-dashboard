# Prologue Project Dashboard — Step 10 v1.1.8 Validation Report

## Scope

Step 10 v1.1.8 is a targeted financial-integrity correction built directly from v1.1.7. It corrects the Historical Revenue & Net Profit series so costs are recognized when labor and expenses are recorded, rather than posting a project's full current cost only when the project is considered complete.

The release preserves the existing project-level financial engine and Teamwork data model. It changes historical reporting aggregation, coverage wording, chart labels/tooltips, verification checks, tests, and supporting documentation.

## Corrected historical definitions

### Cumulative gross revenue

The full known client fee is added on the project's start date. When a project has no configured start date, the earliest dated source activity is used; the calculation timestamp is the final fallback.

### Cumulative actual cost to date

Labor is recognized on each Teamwork time entry's `logged_date` using:

```text
historical_cost_total
or
(minutes / 60) × historical_cost_rate
```

Active project expenses are recognized on `expense_date`. When an expense has no expense date, its creation date is used and the fallback is disclosed in the tooltip coverage information.

### Cumulative net profit to date

```text
Cumulative gross revenue − cumulative actual cost to date
```

Net profit no longer depends on project completion and does not use completed-project revenue as its financial basis.

### Completed-project count

A project is counted as completed only from an actual `completed_at` or `archived_at` timestamp. A planned end date passing no longer causes the project to be treated as completed.

## Additional integrity controls

- Historical source costs are reconciled against the latest `project_metrics.actual_total_cost` values.
- The chart displays an integrity warning when source transactions and project metrics differ by more than $0.05.
- Step 7 verification now includes `actualCostReconcilesToDatedSourceRecords`.
- Missing labor cost rates, missing historical cost totals, missing expense costs, and fallback-dated expenses are counted and disclosed.
- Dashboard and Combined Report cost-coverage wording distinguishes fully covered projects from projects with numeric but partial source coverage.
- Known subtotals remain included; missing source costs are not silently treated as zero coverage.

## Changed application files

- `src/lib/reporting/dashboard-data.ts`
- `src/lib/reporting/dashboard-data.test.ts`
- `src/lib/calculations/verify.ts`
- `src/components/historical-profit-chart-types.ts`
- `src/components/historical-revenue-profit-chart.tsx`
- `src/components/dashboard-profitability-tabs.tsx`
- `src/components/project-selection-reports.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/help/page.tsx`
- `src/app/globals.css`
- `src/commands/verify-reporting-pages.ts`
- `docs/step-10-completion-checklist.md`
- release metadata and documentation

## Preserved components

Byte-level comparisons confirmed these remain unchanged from v1.1.7:

- `src/lib/calculations/engine.ts`
- `src/db/schema.ts`
- `drizzle/`

No database schema migration is required.

## Static and targeted validation

- TypeScript/TSX syntax transpilation passed for **137 files**.
- Targeted semantic type validation passed for:
  - historical data aggregation
  - historical chart rendering
  - calculation verification
- Local import resolution passed with **249 imports** and no missing paths.
- Both application CSS files parsed successfully.
- JSON parsing passed for all package JSON files.
- Targeted source assertions passed for the source-dated query, net-profit formula, actual-completion logic, reconciliation metadata, and corrected tooltip content.
- Pure historical-series tests confirmed:
  - active-project labor and expenses are recognized before completion
  - planned end dates do not imply completion
  - actual completion changes the completed count without posting a new financial amount
  - losses produce negative cumulative net profit when appropriate
  - missing source cost records and fallback expense dates are disclosed
  - every point satisfies net profit = gross revenue − actual cost
- Package and lockfile root versions both report **1.1.8**.

## Dependency-backed build limitation

A dependency installation was attempted, but the configured package mirror returned HTTP 404 for `zod@4.4.3`. Therefore, the full Next.js build, ESLint run, Vitest suite, and live-database verification could not be completed in this environment.

This release adds a live-database reconciliation check specifically so the local environment can verify the real Teamwork-derived values before Step 10 is closed.

## Required local financial gate

Run from the extracted v1.1.8 directory with the working `.env`:

```powershell
npm ci --no-audit --no-fund
npm run step9:refresh-calculations
npm run step10:ui-setup
npm run dev
```

Confirm that Step 7 verification reports:

```text
actualCostReconcilesToDatedSourceRecords: true
```

Then verify with the same filters:

1. The current historical actual-cost endpoint matches the Dashboard Actual Cost to Date subtotal.
2. Every historical tooltip satisfies gross revenue minus actual cost equals net profit to date.
3. Active projects contribute labor and expenses before their end dates.
4. Planned end dates do not cause projects to be counted as completed.
5. Projects with missing employee rates or expense costs are disclosed as partial coverage.
6. Dashboard, Combined Report, Compare, project detail, and exports remain consistent.

## Completion assessment

The source-level correction and integrity controls are complete. Step 10 should be formally closed only after the local dependency-backed commands pass and the real-database reconciliation check returns true.

No database migration or Teamwork reauthorization is required. A fresh Teamwork financial sync and calculation refresh is required to validate current data against the corrected reporting series.
