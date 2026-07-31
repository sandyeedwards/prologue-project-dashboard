# Step 10 v1.1.10 Validation Report

## Scope

This release changes the Historical Revenue & Net Profit chart interaction and visible labels only. It adds two-click date-range zoom, a reusable Custom date range, and simplified metric labels.

## Source and package checks

- TypeScript/TSX syntax transpilation: **PASS** across 133 source files.
- Local import resolution: **PASS** across 248 local imports.
- JSON parsing: **PASS**.
- YAML parsing: **PASS**.
- CSS structural brace validation: **PASS**.
- Merge-marker scan: **PASS**.
- Package and lockfile version consistency: **PASS** at 1.1.10.
- Forbidden-content scan: **PASS**; no `.env`, `.next`, `node_modules`, private-key files, certificates, or TypeScript build cache included.

## Historical chart assertions

- Custom range option present: **PASS**.
- Both custom dates are required: **PASS**.
- End-before-start validation present: **PASS**.
- First chart click stores the first boundary: **PASS**.
- Pointer movement updates the visible selection band: **PASS**.
- Second chart click applies the range and activates Custom: **PASS**.
- Escape and pointer cancellation abandon an unfinished selection: **PASS**.
- Opening and ending balances are carried into custom ranges: **PASS** using a synthetic range test.
- Historical legend and tooltip labels are simplified without changing cumulative values: **PASS**.
- Duplicate gross-revenue SVG line removed: **PASS**.

## Financial and integration scope

Byte-level directory comparisons against v1.1.9 confirmed these areas are unchanged:

- `src/lib`
- `src/db`
- `src/app/api`
- `drizzle`

Therefore this release does not change financial formulas, source-dated costs, forecast calculations, Teamwork synchronization, database schema, migrations, or API behavior.

## Dependency-backed build limitation

A complete `npm ci` and Next.js build could not run in the packaging environment because its internal npm mirror returned a 404 for the existing transitive archive `zod-validation-error@4.0.2`. This is the same registry limitation encountered with the prior baseline and is not a source-code diagnostic.

Run the final local gate with:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

## Manual interaction checklist

1. Open Historical Revenue & Net Profit.
2. Click once in the plot, move left or right, and confirm a shaded range follows the pointer.
3. Click again and confirm the chart zooms and Custom becomes active.
4. Select another preset, then select Custom and confirm the prior custom range returns.
5. Click the active Custom tab and edit the dates.
6. Confirm missing dates and reversed dates show an inline validation message.
7. Press Escape after the first chart click and confirm the selection is canceled.
8. Confirm all five financial values and tooltips are unchanged from v1.1.9 for the same date and filters.
