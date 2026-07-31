# Step 7 v1.0.2 recovery

Step 7 v1.0.1 successfully passed formatting, linting, TypeScript, tests, build, database health, and the optional Teamwork financial refresh. The calculation then encountered a real project whose estimate consumption was `128652.0833%`.

The original derived-metric column used PostgreSQL `numeric(9,4)`, whose maximum absolute value is below `100000`. Version 1.0.2 widens current project metrics and project snapshots to `numeric(18,4)` so the dashboard preserves the real value rather than clipping it.

Run:

```powershell
npm ci --no-audit --no-fund
docker start prologue-project-dashboard-step5-v100-database-1
npm run step7:setup
```

The setup command applies the new migration before rerunning the calculation. Run `npm run dev` only after the final Step 7 verification returns `"status": "PASS"`.
