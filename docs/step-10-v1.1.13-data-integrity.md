# Step 10 v1.1.13 — Teamwork Data Integrity

## Pilot project

The active calculation pilot is `26-101 - Resort at Kapalua Bay - JHGI`. Verification requires a positive outsourced estimate, a positive projected outsourced cost, and reconciliation to the configured outsourced hourly rate.

## Time-entry dates

Teamwork V3 exposes the logged date through `timeLogged`. The importer now checks that field before compatibility aliases and preserves the source calendar day when an ISO timestamp includes an offset. Valid compact dates and Unix timestamps are also supported.

The Step 7 verification output includes `timeEntryDatesImportedWithoutFallback`. This must be `true` before Step 10 is closed.

## NoReport relationship warnings

Task lists, tasks, and time entries whose project is excluded by the existing `NoReport` policy are skipped without relationship warnings. Relationship warnings that remain therefore represent reportable records and continue to fail verification.

## Local verification

```powershell
npm run teamwork:diagnose-time-dates
npm run step9:refresh-calculations
npm run step10:ui-setup
```

Expected checks:

```text
timeEntryDatesImportedWithoutFallback: true
taskListRelationshipsResolvedForReportableProjects: true
pilotProjectFound: true
pilotOutsourcedCalculationPresent: true
pilotOutsourcedCostMatchesConfiguredRate: true
```

> **v1.1.14 correction:** Task-list-only records without a usable project relationship are no longer automatically classified as reportable. v1.1.14 first attempts recovery from task evidence, then ignores only those lists that do not affect imported reportable tasks. Unresolved reportable task or time-entry relationships remain blocking.
