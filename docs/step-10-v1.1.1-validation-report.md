# Prologue Project Dashboard — Step 10 v1.1.1 Validation Report

## Baseline

- Source baseline: Step 10 v1.1.0
- New version: Step 10 v1.1.1
- Scope: Dashboard and Projects-workspace filtering, full-width reporting layout, Combined Report layout, Compare operational-group collapsing, and flexible date entry.

## Implemented checks

- Dashboard has one shared, visible filter row inside the profitability-tab region.
- Dashboard filters include project dates, project type, client, health, and status.
- Dashboard project search and custom project selection were removed.
- Projects workspace search and all filters are visible without opening a filter drawer.
- Applying Projects filters preserves the active compare/combine mode and selected project IDs.
- Dashboard and Combined Report profitability panels use the full available width.
- Health Summary and Logged vs Estimated Hours appear below the financial chart in a responsive support row.
- Compare Projects operational-group sections are independently collapsible and expanded by default.
- Date controls support a calendar popover on single click and manual entry on double-click.
- Accepted manual examples include `4/4/24`, `04/04/24`, `4-4-24`, and `4/4/2024`.
- Valid manual dates normalize to `MM/DD/YYYY`.
- Invalid dates and reversed ranges prevent submission and display an inline error.

## Static validation completed

- 133 TypeScript/TSX files passed syntax transpilation.
- 248 local imports resolved with no missing source files.
- All project CSS parsed successfully.
- All project JSON parsed successfully.
- Flexible-date parser passed 11 targeted normalization and validation checks.
- Package and lockfile versions match at `1.1.1`.
- Targeted source assertions passed for the new filters, layout, calendar, and collapsible groups.
- No merge-conflict markers or symbolic links were found.
- No `.env`, `.next`, `node_modules`, private-key, certificate, or TypeScript build-information files are packaged.

## Calculation and integration integrity

Byte-level directory comparisons confirmed no changes in:

- `src/lib`
- `src/db`
- `src/app/api`
- `drizzle`

Therefore, this release does not intentionally change financial formulas, reporting aggregation, Teamwork synchronization, API behavior, database schema, or migrations.

## Dependency-backed build limitation

A full `npm ci`, lint, strict TypeScript check, unit-test run, and Next.js production build could not be completed in this environment. The configured npm proxy returned HTTP 404 for `zod-validation-error@4.0.2`, a transitive development dependency already present in the baseline lockfile.

Run the final local gate with:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

## Recommended local smoke tests

1. Click anywhere in both date fields and confirm the calendar opens.
2. Double-click each date field and test `4/4/24`, `4-4-24`, and `04/04/2024`.
3. Confirm valid dates display as `04/04/2024` and invalid dates do not submit.
4. Apply each Dashboard filter and verify all KPIs and all three profitability tabs update together.
5. Apply Projects filters while a compare or combined report is open and verify the selected report remains open.
6. Collapse and reopen each operational group in Compare Projects.
7. Review Dashboard and Combined Report at desktop, laptop, and narrow-browser widths.
8. Compare financial totals against Step 10 v1.1.0 using identical filters.
