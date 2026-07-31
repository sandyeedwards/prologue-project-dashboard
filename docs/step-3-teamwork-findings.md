# Step 3 - Final Teamwork integration findings

## Status

Step 3 is complete.

The Teamwork inventory and focused finance probe established that the dashboard can retrieve the core operational and financial data required for the application. Two Teamwork Finance record types were visible in the user interface but were not returned by the tested public API endpoints for the pilot. The production connector must preserve that distinction rather than interpreting an empty result as zero.

## Inventory scope

The validated Teamwork site contained approximately:

- 74 projects
- 59 archived or inactive projects
- 630 task lists
- 4,003 tasks and subtasks
- 7,729 time entries
- 13 owner-company people records, including inactive or service records

The pilot project was:

```text
26-120 - Four Seasons Jackson Hole - BDT
```

## Confirmed accessible data

The integration account can retrieve:

- Active and archived projects
- `archivedAt` timestamps
- Project tags
- Project company and owner relationships
- Task lists, including deletion status
- Tasks and subtasks
- Parent relationships
- Task estimates
- User, team, company, and job-role assignments
- Time entries
- Billable status
- Historical time-entry cost information
- Employee cost information for server-side forecasting
- Fixed-fee project budget
- Project target cost
- Project target margin
- Project notebooks
- Project activity

## Project exclusion rule

The exact Teamwork tag is currently:

```text
Ready Set
```

The application normalizes tag names by removing spaces, punctuation, underscores, and hyphens and by ignoring capitalization. These values therefore match the same exclusion rule:

```text
Ready Set
ReadySet
ready-set
READY SET
```

The normalized exclusion key is:

```text
readyset
```

## Project-number rule

The first numeric project-code token is extracted while internal hyphens are retained.

Example:

```text
26-120 - Four Seasons Jackson Hole - BDT
```

produces:

```text
26-120
```

A missing project number produces a data-quality warning rather than excluding the project.

## Operational-group rollup

The application supports multiple Teamwork task lists under a single operational group while retaining task-list drilldown.

Pilot example:

```text
Project 26-120
├── Mobilization
│   └── Mobilization
├── Fieldwork
│   └── Fieldwork
├── Modeling
│   ├── Modeling - Priority 1 Areas
│   └── Modeling - Priority 2 Areas
└── Other / Unmapped
    └── Admin
```

Deleted task lists are retained for synchronization history but excluded from current rollups.

## Task and time behavior

- Time entries with cost totals can drive actual labor cost.
- Employee cost information can drive projected labor cost.
- Time logged directly to a project remains in project totals as `Unallocated project time`.
- Task-linked time without an own or ancestor estimate remains in actual hours and actual cost as `Unestimated work`.
- Missing estimates and assignments create data-quality warnings.
- Missing data is never silently converted to zero.

## Task-list budget business meaning

When present, a Teamwork task-list budget represents:

```text
Prologue target cost for the task list
```

It does not represent allocated client revenue.

Task-list budgets are optional. Prologue is working toward consistent entry on active and future projects.

When returned:

```text
Task-list target cost = Teamwork task-list budget
```

When not returned:

```text
Task-list target cost = null
```

For a group containing multiple task lists, the complete operational-group target cost is available only when every included task list has a target cost. Partial coverage may show a known subtotal and a coverage count, but the subtotal is not treated as the complete group target.

## Finance expense business meaning

A Teamwork project Finance expense represents actual non-labor cost.

When returned:

```text
Actual non-labor cost = Expense Total cost
```

Finance expenses are optional and are not yet present consistently on every modeling project. Prologue is working toward consistent entry going forward.

When no expected expense record is returned:

- The value remains `null` rather than `$0`.
- The dashboard displays a financial-coverage warning.
- Outsourced Modeling may use an approved notebook fallback when its value can be parsed reliably.
- Other expected non-labor cost is marked incomplete.
- Actual cost, profit, and margin are labeled provisional when the missing expense could materially affect them.

## Public API discrepancy

For the pilot, Teamwork's public endpoints returned successful HTTP responses but empty collections for:

- Saved task-list budget values visible in the Teamwork interface
- An Outsourced Modeling expense expected in the Teamwork Finance interface

This remains an open connector issue.

Production behavior shall be:

1. Call the documented public API source.
2. Use numeric records when returned.
3. Keep empty results as `null` and mark them `Not returned by Teamwork`.
4. Never infer zero.
5. Retest with the production OAuth connection.
6. Maintain a Teamwork support ticket if the discrepancy remains.
7. Permit an audited dashboard-only override only when the business requires the value and Teamwork's public API remains unavailable.

## Outsourced Modeling aliases

Initial recognized task names:

```text
Outsourced Modeling
Cosmere Modeling
```

Aliases are administrator-configurable.

For the pilot, two active `Cosmere Modeling` tasks contained 235 combined estimated hours.

Initial projected rate:

```text
$15.00 per hour
```

Projected outsourced cost:

```text
Canonical outsourced estimated hours x effective outsourced rate
```

Actual outsourced cost source priority:

1. Matching Teamwork Finance expense Total cost
2. Parsed `Prologue Hours Allocated` value from Cosmere Project Notes multiplied by the effective rate
3. Missing actual outsourced-cost warning

An expense and a notebook-derived value are never added together.

## Historical behavior

The primary archive date is Teamwork's `archivedAt` timestamp.

Pre-deployment reporting is labeled `Reconstructed`.

Post-deployment nightly and month-end values are labeled `Snapshot`.

The application begins authoritative estimate, budget, forecast, and margin history when its snapshot process is enabled.
