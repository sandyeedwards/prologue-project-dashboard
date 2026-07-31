# Step 10 v1.1.4 Validation Report

Date: July 30, 2026

## Scope

This release was built directly from Step 10 v1.1.3. It adds historical revenue/cost/net-profit reporting to the Combined Project Report and moves the light Prologue-blue treatment from the KPI wrapper to the page canvas on the Dashboard and Combined Report.

## Functional assertions

- Dashboard continues to pass the filtered portfolio into the existing historical calculation function.
- Combined Project Report now requests historical series from the same `getPortfolioHistoricalProfitSeries` function using only the selected projects.
- Combined Project Report tabs are Forecasted Profitability, Historical Revenue & Net Profit, and Profitability by Operational Group.
- Dashboard and Combined Report use the portfolio-blue application canvas.
- The KPI wrapper is transparent; each KPI remains an independent white metric tile.
- The Combined Project Report no longer renders as one enclosing white report tile.
- The historical graph continues to show cumulative gross revenue, cumulative cost to date, and cumulative net profit with existing range controls and pointer-following tooltips.

## Static validation completed

- TypeScript/TSX syntax transpilation passed for 133 source files.
- 250 local source imports resolved successfully.
- CSS brace validation passed for `globals.css` and `prologue-refinement.css`.
- `package.json`, `package-lock.json`, and `tsconfig.json` parsed successfully.
- Package and lockfile versions match at 1.1.4.
- Financial calculation, database, API, Teamwork/reporting-library, and Drizzle migration directories are byte-for-byte unchanged from v1.1.3.
- Compare Projects profitability source is unchanged.
- No `.env`, `.next`, `node_modules`, private-key, certificate, symlink, or TypeScript build-information files are included.

## Dependency-backed build limitation

`npm ci --no-audit --no-fund` could not complete in this environment because the configured internal npm mirror returned HTTP 404 for the existing transitive dependency `zod-validation-error@4.0.2`. Because dependencies could not be installed, a complete Next.js production build, ESLint run, and browser runtime test could not be performed here.

Run the final local gate on the development computer:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

No database migration or Teamwork reauthorization is required for v1.1.4.
