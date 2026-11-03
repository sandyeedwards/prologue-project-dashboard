# Reporting sync reliability audit — November 2026

## Confirmed operational problem

The Render production and staging hosting crons were both enabled, used the same
production database, and started at minute 17 every six hours. The database's
single-running-sync constraint correctly rejected one invocation. This explains
the intermittent `HostingSyncAlreadyRunningError` failures; it is not evidence
that HubSpot rejected the import.

The user confirmed suspending **only** `prologue-hosting-sync-staging` after
computer-control tools could not reconnect. The staging web service was already
suspended. Keep production hosting enabled. Do not resume staging hosting until
it has a separate staging database.

The blueprint now staggers staging hosting to minute 47 for future isolated use.
Staggering does not make a shared production database appropriate for staging.

## Changes prepared

- Production Teamwork schedules: 6:10 AM and 4:10 PM America/New_York. The morning
  start leaves room for the existing 90-minute job timeout before the requested
  8:00 AM weekday readiness target. Scheduler delays and vendor outages can still
  prevent that target. Staging Teamwork runs at 8:25 AM and 5:25 PM Eastern.
- Read-only Teamwork and HubSpot requests have a 30-second request timeout and up
  to four attempts for transient network, server, and rate-limit failures.
  Authentication failures remain visible. Long vendor cooldowns are not shortened.
- A scheduled hosting invocation retries a short overlap twice. If another run
  remains active, it logs `SKIPPED_ALREADY_RUNNING` and does not bypass the lock or
  advance the successful-refresh timestamp. Genuine failures still exit nonzero.
- Hosting deal replacement runs in a database transaction. Project calculations
  are built before replacing reporting tables, then publish together with their
  successful calculation-run status in one transaction. Failed calculations keep
  the previous complete calculated report.
- Financial imports read successive pages rather than only the first page.
  Missing, malformed, repeated, and excessive pages fail explicitly. Current
  budget flags are replaced only for projects with validated returned budget
  relationships, in a transaction.
- Both scheduled and manual Teamwork refreshes run source import, financial
  import, calculations, and snapshot in order. A thrown financial import error
  stops publication of new calculations and snapshots. Optional endpoint failures
  retain their existing warning behavior and make the overall result a warning.
- Hosting shows the last successful refresh separately from the latest attempt,
  and marks data overdue after eight hours. Sync timestamps explicitly display
  Eastern time. Default snapshot dates use the Eastern reporting date.
- Starting a calculation no longer declares another recent calculation failed;
  only running records older than two hours are treated as abandoned.

## Validation and limits

Unit tests, lint, type checking, and a production build were run locally. No live
production sync, database migration, or deployment was run as part of validation.
Transaction behavior still needs a disposable PostgreSQL integration check; no
local database was available. The unit tests do not substitute for that check.

The source-import lock does not cover every later financial/calculation phase or
standalone maintenance command. GitHub serializes its scheduled workflow, but
operators should avoid simultaneous manual and scheduled reporting refreshes.
A durable lock covering the entire reporting pipeline remains a follow-up.

After deployment, verify one production hosting run, one complete Teamwork
workflow, the displayed successful-refresh times, and next-morning readiness.
Code schedule changes take effect in production only after reaching `main`.
