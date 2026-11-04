# Monday Morning Meeting report

Company Overview's **MMM** button opens `/mmm` for signed-in reporting users.
The report shows active, unfinished Teamwork projects that are included in
reporting, including active projects that do not yet have calculated metrics.
Closed, completed, archived, on-hold, and excluded projects are outside this view.

The agenda defaults to all active projects, sorted by delivery and reporting
signals. Search and filters narrow by owner, client, overdue work, discussion
items, or tasks due this week. Selecting an agenda project opens its breakdown.
All summaries follow the displayed project selection.

Project breakdowns include completion counts, client fee, current and projected
costs, projected profit/margin, internal estimated/logged/remaining/final hours,
last week's time and task completions, work groups, and searchable task detail.
Work groups use Admin, Mobilization, Fieldwork, Modeling, then other groups.
Completed tasks can be included explicitly. Source links open the relevant
Teamwork project or task when the configured site URL is available. Printing
expands all shown projects; open tasks appear by default.

## Calculation rules

- Financial values use the existing project calculations, not another financial
  model. Provisional and missing figures are identified. Known totals explicitly
  state how many projects have a forecast.
- Projected internal hours = project logged hours + estimated remaining hours
  on unfinished internal estimate holders. Parent/subtask estimates are counted
  once, using the existing calculation engine's canonical estimate holders.
- Outsourced/vendor modeling estimates and their subtasks are excluded from
  internal estimated remaining hours. Recorded vendor expenses remain in the
  project financial forecast. Internal time logged against those tasks remains
  part of actual project hours.
- Task rows show time logged directly to the task; ancestor branch totals are
  not added again. Remaining hours appear on the estimate holder only. Project
  totals also retain unallocated project time, which is called out separately.
- Reaching an estimate does not complete a task. Open exhausted estimates,
  missing estimates, missing dates, overdue work, missing calculations, changed
  task counts, and provisional/stale forecasts become discussion signals.
- Missing calculations do not silently turn into zero remaining work. Active
  source projects remain visible even without a financial calculation.
- Task completion is an unweighted count, not percent of effort or revenue.
- Week boundaries are Monday–Sunday in America/New_York. Last week's activity
  is the previous complete Monday–Sunday week. Overdue means before the current
  Eastern date, excluding completed tasks.

This is a review of the latest imported state, not a saved or date-selectable
historical meeting snapshot. Individual sync/calculation timestamps are shown.
No new sync schedules, database migrations, or Teamwork writes are introduced.
The loader uses batch queries rather than per-project requests.
