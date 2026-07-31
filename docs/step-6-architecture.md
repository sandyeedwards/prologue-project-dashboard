# Step 6 Architecture

## Stable foundation

Step 6 uses the Step 5 PostgreSQL schema and the centrally authorized Teamwork OAuth connection. The OAuth connection is preserved during a clean import restart.

## Import phases

1. Companies, tags, and projects
2. Owner-company people
3. Task lists
4. Tasks and subtasks
5. Historical time entries
6. Verification and diagnostics

## Relationship strategy

Teamwork relationships can be returned as numeric IDs, numeric strings, nested `{ id }` references, or omitted from the primary record while available through another imported relationship.

The importer uses explicit field paths rather than searching an entire record for any field named `id`. A task's project is inferred through its task list when the task does not contain a direct project relationship. A time entry's project is inferred through its task when needed.

## Diagnostics

Each dataset records counts for read, created, updated, and skipped records. Repeated warnings are counted by code, while only a limited number of examples are stored in `sync_issues`.

The verifier requires nonzero project, task-list, task, and time-entry counts, plus at least 90 percent coverage for tasks and time entries.
