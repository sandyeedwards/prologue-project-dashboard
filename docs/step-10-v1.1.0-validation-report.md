# Step 10 v1.1.0 Validation Report

## Baseline and scope

- Baseline: user-supplied `prologue-project-dashboard-step10-v1.0.1(1).zip`
- Release: Step 10 v1.1.0
- Scope: complete visual and usability refinement with no intended business-logic or data-model changes

## Static validation completed

- TypeScript/TSX syntax transpilation: 135 files checked, 0 syntax failures
- Local import resolution: 245 local imports checked, 0 missing paths
- CSS parsing: 2 stylesheets parsed with PostCSS, 0 failures
- JSON parsing: 10 files, 0 failures
- YAML parsing: 2 files, 0 failures
- Package hygiene: no `.env`, `.next`, `node_modules`, build-information files, private keys, certificates, symlinks, merge markers, or unexpected empty files
- Package and lockfile version: 1.1.0 in both files
- Dependencies, devDependencies, and npm scripts: unchanged from v1.0.1

## Financial and integration integrity

Byte-level directory comparisons against the uploaded baseline confirmed these sources are unchanged:

- `src/lib/calculations` — 21 files
- `src/lib/teamwork` — 19 files
- `src/lib/reporting/dashboard-data.ts`
- `src/db` — 4 files
- `drizzle` — 13 files
- `src/app/api` — 10 files
- `src/config`

Therefore, this release does not intentionally change financial formulas, Teamwork synchronization, database schema, reporting aggregation, API behavior, project-health rules, or configuration rules.

## Targeted interface assertions

- Shared primary and secondary KPI financial bands are present on Dashboard, Combined Report, and project detail.
- The new financial-composition component displays Actual Cost to Date, Costed Remaining Work, Unspent Revenue / Forecasted Profit, and Cost Above Revenue.
- Dashboard profitability tabs use the new component.
- Compare Projects includes attention-first sorting, performance labels, overrun handling, exact-value tooltips, and the compact financial register.
- Dashboard and Projects filters retain their existing query parameters while separating everyday and advanced controls.
- Responsive design breakpoints are present for 1320 px, 1050 px, 820 px, and 560 px.

## Representative browser rendering

Representative static pages using the production styles were rendered and checked at:

- 1600 px
- 1280 px
- 1024 px
- 820 px
- 390 px

Dashboard, Compare Projects, and individual project previews produced no page-level horizontal overflow at those widths. These previews use representative data and are not connected to the live database.

## Dependency-backed build limitation

A complete `npm ci` / Next.js build could not be completed in the packaging environment because its internal npm registry mirror returned HTTP 404 for `zod-validation-error@4.0.2`. This is an environment dependency-resolution failure, not a TypeScript or application-source error.

Final local release gate:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

Then complete the role, filter, comparison, project-detail, and export checks in `docs/step-10-completion-checklist.md` against the real database.
