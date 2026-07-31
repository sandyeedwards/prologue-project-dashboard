# Step 9 v1.0.18 — Chart Clarity and Coverage

## Scope

This release is an interface and verification update. It does not change Teamwork synchronization, database migrations, authentication, calculation rules, or project inclusion. `NoReport` remains the sole exclusion tag.

## Implemented changes

1. Chart legends now use solid, square color swatches.
2. Profitability cost deductions use the same inset width as the upper included-cost and profit segments.
3. Loss labels appear above revenue columns instead of over the blue fill.
4. The profitability panel uses its available vertical space more effectively.
5. Financial KPI cards show `Known for X of Y projects` coverage.
6. Step 9 verification checks branding in `AppShell` and verifies the filled-swatch and coverage behavior.
7. Help text now describes the current Dashboard filters and the `NoReport` policy.

## Validation commands

```powershell
npm ci --no-audit --no-fund
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run step9:verify
```

The final `step9:verify` command requires the existing populated PostgreSQL database and `.env`.

## Recommended next implementation

Create the portfolio Data Quality page as the next Step 9 increment. The initial view should aggregate unresolved issues by project and issue code, include severity and age filters, provide direct Teamwork correction links, and show whether each issue blocks cost, forecast, margin, or health completeness.
