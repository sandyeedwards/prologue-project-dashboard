# Step 12 Completion Checklist

## Hosted Database

- [x] Neon project created for the Prologue Project Dashboard.
- [x] Separate `production` and `staging` Neon branches created.
- [x] Staging database `prologue_dashboard` created.
- [x] All six application migrations applied successfully.
- [x] Staging schema verified with 32 application tables.
- [x] Render runtime traffic uses the pooled staging database URL.
- [x] Migration tooling retains the direct staging database URL.
- [x] No database credentials are committed to Git.

## Render Staging Service

- [x] Render staging web service created.
- [x] Staging service deploys from `develop`.
- [x] Staging service uses the Virginia region.
- [x] Staging service uses the Free plan during testing.
- [x] Automatic deployment is configured for successful CI checks.
- [x] Public application URL is `https://prologue-project-dashboard-staging.onrender.com`.
- [x] Public `/api/health` endpoint returns HTTP 200.
- [x] Application root returns HTTP 200.
- [x] Hosted redirects use `APP_BASE_URL` instead of Render's internal bind address.

## Teamwork Authentication

- [x] Hosted Teamwork OAuth callback registered.
- [x] Central Teamwork reporting connection authorized.
- [x] Teamwork access token stored encrypted in Neon.
- [x] Initial Teamwork data synchronization completed.
- [x] Active internal employees can sign in through Teamwork.
- [x] Bootstrap administrator can sign in with the Admin role.
- [x] Protected database health endpoint returns `status: ok`.

## Automated Data Refresh

- [x] Existing `job:nightly-sync` logic preserved.
- [x] GitHub Actions staging database secret configured.
- [x] GitHub Actions Teamwork encryption-key secret configured.
- [x] Scheduled workflow installs required development tooling.
- [x] Manual staging synchronization completed successfully.
- [x] Synchronization scheduled for 7:00 AM America/New_York every day.
- [x] Synchronization scheduled for 4:00 PM America/New_York every day.
- [x] Concurrent staging sync runs are prevented.
- [x] Daily project snapshots safely update the same daily record.

## Application Validation

- [x] ESLint passed.
- [x] Strict TypeScript validation passed.
- [x] All 26 Vitest files passed.
- [x] All 123 unit tests passed.
- [x] Next.js production build passed.
- [x] Targeted Prettier validation passed for Step 12 files.
- [x] Existing repository-wide formatting drift was not modified.
- [x] Application version advanced to `1.3.0`.
- [x] Health endpoint now reads the bundled package version.
- [x] Hosted `/api/health` reports version `1.3.0` after the closeout deployment.

## Production Safeguards

- [x] Production Render configuration remains separate.
- [x] Production service remains associated with `main`.
- [x] Production deployment has not been enabled as part of Step 12.
- [x] Staging and production secrets remain separate.
- [x] No production database migration was performed.

## Step 12 Exit Criteria

Step 12 is complete when:

1. The closeout pull request is merged into `develop`.
2. Render deploys the closeout commit successfully.
3. Hosted `/api/health` reports version `1.3.0`.
4. Teamwork login and the protected database health endpoint remain functional.
5. The Step 12 release is tagged after final verification.
