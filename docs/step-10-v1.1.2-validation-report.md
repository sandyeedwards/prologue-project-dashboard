# Step 10 v1.1.2 Validation Report

## Scope

This release was built directly from Step 10 v1.1.1. The changes are limited to the Dashboard financial-composition graphic, the historical revenue/profit chart, supporting styles, Help copy, version metadata, and release documentation.

## Implemented changes

- Added a visible Prologue-blue allocated-revenue foundation and threshold to the primary profitability composition bar.
- Added cumulative cost to date as a third historical line using the existing `actualCostToDate` historical series.
- Added matching cost-line legend, endpoint markers, hover markers, tooltip values, accessibility copy, and Help documentation.
- Changed the historical tooltip from a fixed chart position to pointer-following placement in both the horizontal and vertical directions.
- Preserved keyboard inspection with Arrow Left, Arrow Right, Home, End, and Escape.

## Static validation completed

- TypeScript/TSX syntax transpilation passed for 137 application and configuration files.
- Local import resolution passed for 249 relative and `@/` imports.
- JSON parsing passed for all packaged JSON files.
- CSS brace/structure checks passed for both application stylesheets.
- Targeted assertions confirmed the allocated-revenue foundation, historical cost path, cost legend, and pointer-following tooltip implementation.
- Package and lockfile versions both report `1.1.2`.
- No `.env`, `.next`, `node_modules`, private-key, certificate, symlink, or TypeScript build-information files are included.

## Business-logic integrity

Byte-level directory comparisons against v1.1.1 confirmed no changes in:

- `src/lib`
- `src/db`
- `src/app/api`
- `drizzle`

Therefore this release does not change financial formulas, Teamwork synchronization, database schema, API behavior, reporting aggregation, health logic, or migration history.

The new cost line visualizes the existing cumulative completed-project cost field already shown in the historical tooltip. It does not introduce a new calculation.

## Dependency-backed build limitation

A complete `npm ci` / Next.js production build could not be run in this environment because the configured internal npm mirror returned HTTP 404 for the existing transitive package `zod-validation-error@4.0.2`. This is the same external registry limitation encountered with the prior baseline and is not caused by the v1.1.2 source changes.

Run the final local gate with the working project environment:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

## Focused local test checklist

1. Open Forecasted Profitability and confirm the allocated-revenue region has a clear blue foundation/outline.
2. Hover the primary profitability bar and confirm exact financial values remain unchanged.
3. Open Historical Revenue & Net Profit and confirm three visible lines: gross revenue, cost to date, and net profit.
4. Move the pointer around the historical plot and confirm the tooltip follows the pointer without leaving the chart bounds.
5. Confirm the historical tooltip values match v1.1.1 for the same date and filters.
6. Test Arrow Left, Arrow Right, Home, End, and Escape while the historical plot is focused.
7. Check the historical chart at standard desktop, laptop, and narrow widths.
