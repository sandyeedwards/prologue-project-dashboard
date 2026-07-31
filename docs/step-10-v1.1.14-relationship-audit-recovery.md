# Step 10 v1.1.14 — Relationship Audit Recovery

## Why v1.1.13 failed

The date diagnostic command opened the database before loading `.env`, even though the other database commands loaded it correctly. The production build, date import, actual-cost reconciliation, and Kapalua pilot checks passed, but Step 7 still treated 67 task lists with unresolved project links as reportable failures.

## Diagnostic environment repair

`npm run teamwork:diagnose-time-dates` now imports `dotenv/config` before constructing the database client and closes the SQL connection after completion. It therefore uses the same local `.env` file as the synchronization, database-check, and verification commands.

## Relationship classification

The Teamwork task-list and task requests now use `projectType=normal` so project-template records are outside the reporting import.

When a task list does not expose a usable project relationship directly, the sync defers it until tasks have been retrieved:

1. A consistent project ID on its task records recovers and imports the task list.
2. A project excluded by the `NoReport` policy remains excluded without a warning.
3. A task list that is not referenced by any imported task is counted as `ignoredUnreferenced` and does not fail reporting verification.
4. Conflicting project evidence, unresolved reportable tasks, and unresolved reportable time entries remain blocking warnings.

## Step 7 output

The Teamwork sync audit now reports:

```text
reportableRelationshipWarnings
legacyTaskListRelationshipWarnings
taskListRelationshipRecovery:
  recoveredFromTaskEvidence
  ignoredUnreferenced
  referencedWithoutProjectEvidence
  conflictingTaskEvidence
```

The existing check remains:

```text
taskListRelationshipsResolvedForReportableProjects
```

It passes when no unresolved relationship affects reportable task or time-entry data. Legacy task-list-only warnings and unreferenced records no longer cause a false failure.

## Local verification

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
