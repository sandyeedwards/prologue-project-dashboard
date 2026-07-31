# Step 10 v1.1.14 Validation Report

## Scope

This release is a narrow recovery build for the two issues found in the user's v1.1.13 local gate:

1. `teamwork:diagnose-time-dates` did not load `.env` before opening the database.
2. Step 7 treated 67 task-list-only relationship warnings as reportable failures even though all reportable tasks were imported and calculated.

The Kapalua pilot, date parsing, historical calculations, reporting UI, database schema, and financial formulas are unchanged.

## Source changes

- Added `dotenv/config` and deterministic SQL-client shutdown to the time-date diagnostic command.
- Added `projectType=normal` to the Teamwork task-list and task requests.
- Added deferred task-list resolution using consistent project evidence from task records.
- Added non-blocking classification for task lists that have no project relationship and are not referenced by any imported task.
- Preserved blocking warnings for missing task-list IDs, conflicting task-list project evidence, unresolved reportable tasks, and unresolved reportable time entries.
- Expanded Step 7 sync-audit output with recovered, unreferenced, referenced-without-project-evidence, conflict, reportable, and legacy counts.
- Added focused task-list recovery tests.

## Validation completed in this environment

- TypeScript/TSX syntax transpilation: 143 files, 0 syntax errors.
- Local import resolution: 264 imports, 0 missing local paths.
- JSON parsing: 10 files, 0 errors.
- Task-list recovery execution test: passed for recovered, missing-project-evidence, and conflicting-project cases.
- Version agreement: `package.json`, `package-lock.json`, and root lock package all report `1.1.14`.
- Package manifest and internal source checksums: 242 files.
- Structural scan: no `.env`, `.next`, `node_modules`, private keys, certificates, TypeScript build cache, symlinks, or merge-conflict markers.
- Database schema, Drizzle migrations, application routes, page components, and financial calculation engine are unchanged from v1.1.13.

## Dependency-backed build status

A complete dependency installation and Next.js build could not be rerun in this environment because the configured package mirror returned HTTP 404 for the existing transitive package `zod-validation-error@4.0.2`.

The user's v1.1.13 local run already established that the dependency set, linting, TypeScript check, 120 tests, production build, database connection, authentication verification, time-entry date repair, Kapalua pilot, and actual-cost reconciliation pass. v1.1.14 only changes the diagnostic startup and relationship-audit classification/recovery described above.

## Required local gate

Run from a newly extracted v1.1.14 folder after copying the working `.env` file:

```powershell
npm ci --no-audit --no-fund
npm run teamwork:diagnose-time-dates
npm run step9:refresh-calculations
npm run teamwork:diagnose-time-dates
npm run step10:ui-setup
```

Expected results:

```text
teamwork:diagnose-time-dates status: PASS
unresolvedSourceDates: 0
timeEntryDatesImportedWithoutFallback: true
taskListRelationshipsResolvedForReportableProjects: true
pilotProjectFound: true
pilotOutsourcedCalculationPresent: true
pilotOutsourcedCostMatchesConfiguredRate: true
actualCostReconcilesToDatedSourceRecords: true
step10:verify: PASS
```

`taskListRelationshipRecovery.ignoredUnreferenced` may be greater than zero. That is informational and does not represent missing reportable task data. Any nonzero `reportableRelationshipWarnings` remains a blocking issue.
