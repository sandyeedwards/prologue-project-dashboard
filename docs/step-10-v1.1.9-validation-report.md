# Prologue Project Dashboard — Step 10 v1.1.9 Validation Report

## Scope

Version 1.1.9 updates the Historical Revenue & Net Profit chart and the Teamwork date-ingestion safeguards. The database schema and migrations are unchanged.

## Functional changes reviewed

- Rejects historical/project dates earlier than `2000-01-01`, preventing Unix-epoch fallback dates from extending Project life to 1970.
- Reassigns already-stored invalid or missing source-cost dates to the best available project date for chart continuity and exposes the fallback count in the tooltip.
- Improves Teamwork time-entry date parsing for ISO dates, compact `YYYYMMDD` dates, Unix seconds, and Unix milliseconds.
- Removes the former `1970-01-01` sync fallback. Missing source dates now use a valid created/updated date, project start date, or current import date and create a `TIME_DATE_FALLBACK` data-quality warning.
- Adds cumulative anticipated cost to date in orange.
- Adds cumulative forecasted net profit in bright lime green.
- Changes cumulative actual cost to date to red.
- Preserves cumulative gross revenue in blue and cumulative actual net profit to date in dark green.

## Financial definitions

- **Cumulative gross revenue:** full known client fee added on the valid project start date.
- **Cumulative actual cost to date:** source-dated labor and expense costs accumulated through each point.
- **Cumulative actual net profit to date:** cumulative gross revenue minus cumulative actual cost to date.
- **Cumulative anticipated cost to date:** the latest forecast cost for projects that had started by each point.
- **Cumulative forecasted net profit:** client fee minus latest forecast cost, or the stored forecast-profit value when both source values are not available.

The forecast lines are current projections arranged by project start date. They are not archived historical forecast snapshots.

## Automated validation completed

- TypeScript/TSX syntax transpilation: **PASS — 133 files**.
- Local relative and `@/` import resolution: **PASS — 248 imports**.
- JSON parsing: **PASS — 10 files**.
- CSS brace/structure check: **PASS — 2 files**.
- Targeted historical/date assertions: **PASS**.
- Historical calculation execution test: **PASS**.
  - No date before 2000 reached the output series.
  - A legacy-dated labor record was retained and assigned to the valid project start date.
  - Actual net profit equaled gross revenue minus actual cost.
  - Forecasted net profit equaled gross revenue minus anticipated cost.
  - Source-cost reconciliation difference was zero in the test fixture.
- Merge-marker scan: **PASS**.
- Secret/build-artifact scan: **PASS**.
- Symlink scan: **PASS — 0 symlinks**.
- Case-insensitive path-collision scan: **PASS — 0 collisions**.
- Database source comparison against v1.1.8: **UNCHANGED**.
- Drizzle migrations comparison against v1.1.8: **UNCHANGED**.
- API route comparison against v1.1.8: **UNCHANGED**.

## Dependency-backed build limitation

`npm ci --no-audit --no-fund` could not complete in the execution environment because its internal npm mirror returned HTTP 404 for the existing dependency archive `zod-validation-error@4.0.2`. Consequently, the complete Next.js build, ESLint run, and Vitest suite could not be executed here. This is an environment/package-mirror limitation rather than a source-code diagnostic.

## Required local data repair and approval gate

Run from the extracted v1.1.9 folder with the working `.env`:

```powershell
npm ci --no-audit --no-fund
npm run step9:refresh-calculations
npm run step10:ui-setup
npm run dev
```

`step9:refresh-calculations` runs the Teamwork sync, financial sync, calculation engine, and snapshot creation. It should replace legacy epoch dates through normal upserts where Teamwork provides a usable source date or valid fallback source.

Then confirm that `npm run step7:verify` reports:

```text
actualCostReconcilesToDatedSourceRecords: true
noLegacyEpochDates: true
```

Finally, compare the latest Historical chart values with the Dashboard under identical filters:

- Cumulative actual cost to date = Dashboard Actual Cost to Date.
- Cumulative actual net profit = gross revenue − actual cost.
- Cumulative forecasted net profit = gross revenue − anticipated cost.

## Database impact

No database migration is required. No Teamwork reauthorization is required.
