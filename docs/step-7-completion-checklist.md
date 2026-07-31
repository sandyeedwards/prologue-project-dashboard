# Step 7 Completion Checklist

Step 7 is complete when:

- `npm ci --no-audit --no-fund` succeeds;
- `npm run db:check` returns `status: ok`;
- `npm run db:migrate` applies migration `0002_step7_calculation_engine`;
- `npm run step7:run` finishes;
- the final Step 7 verification has `status: PASS`;
- current project metrics equal the number of non-excluded projects;
- task metric coverage is at least 90 percent of non-deleted tasks in non-excluded projects;
- operational-group metrics exist;
- the calculation run has zero errors;
- the 26-101 Resort at Kapalua Bay pilot has a positive outsourced estimate and projected outsourced cost that reconciles to the configured outsourced hourly rate;
- `npm run check` succeeds;
- `npm run build` succeeds.

Warnings do not block completion when they represent transparent missing Teamwork inputs. Review the warning counts and coverage fields before using forecasts for management decisions.

## Step 7 v1.0.1 execution order

The package must pass `npm run check` and `npm run build`. `npm run step7:run` applies pending migrations before calculating, then verifies the generated metrics.

## Step 7 v1.0.2 gate

The Step 7 calculation is not complete until `npm run step7:setup` applies migration `0003_expand_estimate_consumption` and the final verification returns `"status": "PASS"`.
