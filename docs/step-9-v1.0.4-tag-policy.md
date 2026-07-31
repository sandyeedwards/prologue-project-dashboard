# Step 9 v1.0.4 — Reporting tag policy

## Inclusion precedence

1. `NoReport`: exclude from metrics, pages, comparison, portfolio summaries, and data-quality counts.
2. `DataHall`: include and classify non-administrative task lists as individual areas/mobilizations.
3. `Ready Set`: include normally.
4. Archived status does not exclude a project.

Tag comparison uses the same normalized Teamwork label function used by the importer, so capitalization and separators do not change the result.

## DataHall task-list classification

A DataHall task list becomes `Area: <Teamwork task-list name>` unless its name clearly identifies administration, project setup, project management, billing, scheduling, QA/QC, or similar internal setup work. Administrative lists become `Other / Administrative`.

Each resulting group retains task-list estimates, task-linked time, historical labor cost, expenses, completion, target-budget coverage, and variance. All groups still roll up to the whole project. Project-only time remains in the project total and continues to produce an allocation warning because it cannot be assigned to an area.

## Refresh behavior

`npm run step9:setup` runs the full Teamwork synchronization before financial refresh and calculation. This updates project inclusion flags, project types, project tags, and task-list group classifications without clearing the database or OAuth connection.
