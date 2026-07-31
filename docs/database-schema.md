# Step 5 database schema

## Purpose

PostgreSQL is the authoritative persistence layer for synchronized Teamwork data, dashboard-only configuration, data-quality findings, audit history, and reporting snapshots.

Missing financial values are stored as `NULL`, never as zero. Source and coverage fields distinguish complete Teamwork records, partial coverage, missing records, dashboard overrides, derived values, and notebook fallbacks.

## Main synchronized entities

- `companies`
- `people`
- `projects`
- `tags` and `project_tags`
- `task_lists`
- `tasks`
- `task_assignments`
- `time_entries`
- `project_budgets`
- `task_list_budgets`
- `expenses`

Teamwork numeric IDs have unique constraints so repeated syncs update existing rows instead of creating duplicates.

## Dashboard configuration

- `app_users`: dashboard identity and Viewer, Manager, or Admin role
- `operational_group_rules`: configurable task-list naming rules
- `outsourced_task_aliases`: outsourced task-name aliases
- `outsourced_rates`: effective-dated hourly outsourced rates
- `project_archive_overrides`: audited dashboard-only archive-date corrections

Task-list budget overrides use the same `task_list_budgets` table with `source = DASHBOARD_OVERRIDE`, an override reason, administrator, and timestamp.

## Operations and audit

- `sync_runs`: initial, nightly, manual, and snapshot execution records
- `sync_issues`: warnings and errors associated with a sync run
- `data_quality_issues`: unresolved and resolved project correction items
- `audit_log`: administrator and system changes

## Historical reporting

`project_snapshots` stores nightly, month-end, and reconstructed project metrics. Each snapshot records calculation version and financial coverage so historical reports remain reproducible after rules or Teamwork values change.

## Privacy rule

Employee cost rates are stored server-side because they are required for projections. They must never be selected into Viewer-facing API response types, exports, URLs, or browser payloads.

## Step 7 derived calculation tables

### `calculation_runs`

Records each calculation execution, version, status, project coverage, warning count, error count, and summary.

### `project_metrics`

Stores the current whole-project financial, forecast, hours, progress, coverage, provisional, and health result. There is one current row per reporting-eligible project.

### `task_metrics`

Stores canonical estimate source, counted and branch estimates, own and branch logged time, remaining time, labor costs, outsourced cost, and assignment coverage.

### `operational_group_metrics`

Stores operational-group target-cost coverage, estimated and logged hours, projected and actual cost, forecast, variance, and progress. It intentionally does not store group profit or margin.

## Step 8 authentication tables

### `app_sessions`

Stores only SHA-256 hashes of opaque browser session tokens, along with user, expiry, last-seen, revocation, and limited user-agent metadata. Raw session tokens and employee Teamwork OAuth tokens are not stored.

### `oauth_states`

Step 8 adds a purpose and internal return path so one single-use Teamwork OAuth callback can safely distinguish central reporting authorization from employee sign-in.

## Step 9 review and role-cost tables

### `job_roles`

Stores synchronized Teamwork job-role identities and internal cost rates used only for server-side remaining-work forecasts when no individual employee assignment takes precedence. Billable rates are not stored or used for internal project cost.

### `unplanned_work_reviews`

Stores an Admin's review state for a top-level task that has logged time without a canonical estimate. The row records the logged-minute and labor-cost threshold at dismissal. Additional logged minutes automatically make the current issue active again; the review never alters Teamwork time, estimates, or historical labor cost.
