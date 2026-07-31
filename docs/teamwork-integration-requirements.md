# Teamwork integration requirements

Version: 1.1  
Status: approved for implementation after Step 3 inventory

## Purpose

The application provides internal, read-only reporting from one central connection to the Prologue Systems Teamwork site. Employee dashboard login will use Teamwork credentials in a later build step. Individual employee tokens will not drive dashboard data access; the central connection provides one consistent reporting dataset.

## Project inclusion

The application synchronizes active and archived projects accessible to the central administrator connection.

A project is excluded only when any project tag normalizes to `noreport`. Normalization removes whitespace, punctuation, underscores, and hyphens and ignores capitalization. `Ready Set` projects are included. `DataHall` projects are included and use task-list-level area/mobilization rollups. `NoReport` takes priority over every other tag. Archived projects remain reportable unless they have `NoReport`.

Deleted projects do not appear in ordinary dashboard results. They may remain in synchronization audit records.

## Project identity and classification

The project number is the leading numeric code in the Teamwork project name, preserving internal hyphens. For example, `26-120 - Four Seasons Jackson Hole - BDT` maps to `26-120`.

Project type is based on project tags:

- `DataHall`
- `Scanning`
- `Modeling`
- `Scanning + Modeling`
- `Ready Set` when no more specific type tag is present
- `Unclassified`

Client defaults to the Teamwork company associated with the project.

## Operational-group hierarchy

The reporting hierarchy is:

```text
Project
└── Operational group
    └── Teamwork task list
        └── Task
            └── Subtask
```

Initial task-list classification rules:

| Task-list name contains                               | Operational group |
| ----------------------------------------------------- | ----------------- |
| Mobilization                                          | Mobilization      |
| Fieldwork, Field Work, Field Ops, or Field Operations | Fieldwork         |
| Modeling or Modelling                                 | Modeling          |
| No match                                              | Other / Unmapped  |

Multiple task lists can roll into one operational group. Users must be able to expand the group and filter to individual task lists. Administrator overrides take precedence over automatic rules.

Deleted task lists and deleted tasks are retained for synchronization audit history but excluded from current operational and financial calculations.

## Project financial budget

For each applicable project, the active Teamwork fixed-fee financial budget is the current project financial source.

| Dashboard field         | Teamwork source             |
| ----------------------- | --------------------------- |
| Client fee              | Financial budget `capacity` |
| Target project cost     | `budgetExpectedCost`        |
| Target profit margin    | `budgetProfitMargin`        |
| Target profit           | `budgetExpectedProfit`      |
| Budget status and dates | Active budget record        |

Missing financial values are stored as `null`, not zero.

A later budget update or approved change order updates current reporting during the next synchronization. Historical dashboard snapshots preserve earlier synchronized values.

## Task-list budgets

Prologue uses Teamwork task-list budgets as target-cost values for task lists. Not every existing project currently has these values. Prologue is working toward consistent entry for active and future projects.

The Teamwork API inventory did not return the visibly saved pilot values through the tested endpoints. The production connector will retry the documented supported sources with the production OAuth connection and retain source diagnostics.

A task-list target cost is accepted only when a numeric Teamwork value is actually returned or an audited dashboard-only override exists.

When a task-list target cost is returned:

- It is labeled `Target Cost - Teamwork task-list budget`.
- It can be compared with projected, actual, and forecast task-list cost.

When no value is returned:

- The target cost remains `null`.
- The dashboard does not display `$0`.
- Projected, actual, and forecast task-list costs are still calculated.
- Target-cost variance is unavailable.
- The dashboard displays `No Teamwork task-list target budget was returned for this budget period.`

### Operational-group target-cost coverage

For an operational group containing several included task lists:

- The complete group target cost is the sum of task-list target costs only when every included task list has a numeric target-cost source.
- A numeric zero is a valid covered value and is different from missing.
- When only some task lists are covered, the dashboard may display a `Known target-cost subtotal` and a coverage count such as `2 of 3 task lists budgeted`.
- A partial subtotal is not labeled as the complete operational-group target cost.
- Group target-cost variance is unavailable until coverage is complete.

The database supports an audited dashboard-only override. An override never updates Teamwork and records the administrator, date, source, prior value, and reason.

## Task estimates and assignments

The connector synchronizes task and subtask identity, parent relationship, task-list relationship, status, estimates, dates, assignments, completion, deletion state, and update timestamps.

For tasks assigned to multiple individual employees, estimated time is divided equally among those employees.

Team-, company-, and job-role-only assignments are retained. Until membership is resolved, projected employee labor cost is marked incomplete rather than assigned to an arbitrary employee.

## Parent and subtask estimates

When estimated subtasks exist, their sum is the canonical branch estimate. A parent estimate is retained as a comparison value and is not added again.

When subtasks have no estimates but the parent has an estimate, the parent estimate is the canonical branch estimate. Time logged to the parent and descendants is measured against that estimate.

When neither the parent nor descendants have an estimate, logged time still counts as actual hours and actual labor cost and is classified as unestimated work.

## Time entries and labor cost

The connector synchronizes time-entry identity, project, task, employee, date, minutes, billable state, description, deletion state, historical Teamwork cost information, and update timestamps.

Actual employee labor cost uses the historical time-entry cost total when available. This prevents old labor from being recalculated using only a current employee rate.

Time logged directly to a project without a task:

- Counts in whole-project actual hours and actual labor cost.
- Is classified as `Unallocated project time`.
- Is excluded from task-list and operational-group totals.
- Generates a data-quality warning.

Time logged to a task with no own or ancestor estimate:

- Counts in actual hours and actual labor cost.
- Counts in estimate consumption.
- Is classified as `Unestimated work`.
- Generates a data-quality warning.

## Employee costs

Employee cost information is synchronized for server-side projected-cost calculations. Missing rates remain missing and generate warnings; they are never treated as zero.

Individual hourly cost rates must never be displayed in pages, browser API responses, Excel exports, PDFs, or saved-view URLs.

## Outsourced Modeling

Initial task aliases are:

- `Outsourced Modeling`
- `Cosmere Modeling`

Aliases are administrator-configurable. Only tasks in non-deleted task lists are eligible.

Projected outsourced cost is:

```text
canonical outsourced estimated hours x effective outsourced hourly rate
```

The initial rate is USD 15.00 per hour and is stored as an effective-dated configuration value.

Actual outsourced cost uses this priority:

1. Matching Teamwork Finance expense Total cost.
2. Parsed `Prologue Hours Allocated` notebook value multiplied by the effective rate.
3. Missing-actual-cost warning.

An expense and notebook fallback are never added together. When both exist, the expense is authoritative and a material discrepancy may be flagged.

## Finance expenses

Not every project currently has consistent Finance expenses. Prologue is standardizing them going forward.

The connector attempts to retrieve expenses for every active and historical budget period. Each returned record retains its Teamwork identity, project, budget period, date, title, category, Total cost, billable total when present, markup when present, assignee, deletion state, and timestamps.

Actual project non-labor cost uses Total cost, not markup or billable total.

When an endpoint succeeds but returns no expense records:

- Actual non-labor cost is not assumed to be zero.
- The expense value remains `null` or incomplete for the affected expected category.
- The dashboard displays `No expense records returned for this budget period.`
- Outsourced Modeling may use its approved notebook fallback.
- Other expected non-labor categories generate data-quality warnings.

### Expense completeness and provisional results

A project may legitimately have no expense. Therefore, absence of expense records does not automatically mean an error. The calculation engine determines whether an expense is expected from configured task aliases, task categories, project configuration, or administrator mappings.

When no expense is expected and none is returned, expense coverage may be complete at zero.

When an expense is expected but neither a Teamwork expense nor an approved fallback is available:

- Known actual labor and known returned expenses continue to be totaled.
- Whole-project actual cost is labeled `Known actual cost` or `Actual cost - incomplete`.
- Profit and margin are labeled provisional.
- Health scoring includes a data-completeness penalty.
- The missing category appears in the administrator correction report.

## Archive dates

The Teamwork `archivedAt` timestamp is the primary archive date. A dashboard correction is permitted only when the timestamp is absent or known to be historically wrong. Corrections are audit logged and do not update Teamwork.

## History and snapshots

Pre-deployment reporting is reconstructed from current Teamwork records and dated actual activity. It is labeled `Reconstructed` because old estimates, budgets, and targets may have changed.

After deployment, nightly and month-end snapshots preserve the synchronized project, budget, estimate, actual, forecast, progress, health, data-quality, and source-coverage state. Those reports are labeled `Snapshot`.

## Read-only guarantee

The production Teamwork connector exposes only GET operations. No create, update, or delete Teamwork request is implemented. The Teamwork token remains server-side and is never returned to the browser.
