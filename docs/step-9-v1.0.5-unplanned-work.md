# Step 9 v1.0.5 — Unplanned work and job-role forecasts

## Unplanned-work policy

- Flag a top-level task when it has logged time and no canonical estimate.
- Never flag a subtask solely because it has no estimate.
- Keep all logged hours and historical labor costs in actual totals.
- Do not invent or retroactively create an estimate.
- Only Admins may mark a flag reviewed or reopen it.
- A note is not required.
- Review state is stored per task.
- A project-level action may mark every currently open unplanned-work task reviewed.
- More logged minutes than the reviewed threshold automatically reopens the item.
- A subsequently added Teamwork estimate resolves the generated issue after synchronization.

## Forecast-assignment policy

- Individual assignees take precedence over job roles.
- Role-only assignments use Teamwork job-role internal cost rates.
- Multiple selected assignees receive equal shares.
- Partial known rates produce a known minimum and keep the forecast provisional.
- Completed branches and branches with no remaining estimate do not require assignments.
- Billable rates are not used for internal cost.
- Raw employee and role rates remain server-side.

## Persistence

Migration `0005_step9_unplanned_roles.sql` adds:

- `job_roles` for synchronized role cost-rate metadata;
- `unplanned_work_reviews` for Admin review state, dismissal thresholds, reviewer, and timestamp.

Review rows are keyed to tasks rather than generated issue IDs so review state survives recalculation.
