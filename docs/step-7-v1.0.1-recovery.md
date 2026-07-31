# Step 7 v1.0.1 recovery

This release corrects the five strict TypeScript errors reported in v1.0.0 and makes the Step 7 runner apply the calculation migration automatically.

## Required sequence

1. Copy the successful Step 6 `.env` file into the Step 7 folder.
2. Start the existing PostgreSQL container.
3. Run `npm ci --no-audit --no-fund`.
4. Run `npm run step7:setup`.
5. Start `npm run dev` only after the final verification reports `PASS`.

The optional Teamwork financial refresh is allowed to report `CONTINUED_WITHOUT_FINANCIAL_REFRESH`; missing financial inputs remain provisional and are surfaced as data-quality warnings.
