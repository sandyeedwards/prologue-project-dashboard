# Step 12 Validation Report

Validation date: August 4, 2026

## Release Candidate

- Version: `1.3.0`
- Integration branch: `develop`
- Closeout branch: `chore/step12-closeout`
- Staging URL: `https://prologue-project-dashboard-staging.onrender.com`
- Application host: Render
- Hosted PostgreSQL: Neon
- Teamwork workspace: Prologue Systems

## Hosted Environment Results

- Render staging deployment reached Live status.
- Public application root returned HTTP 200.
- Public `/api/health` returned `status: ok`.
- The pre-closeout health response reported the obsolete fallback version `0.1.0`.
- Version `1.3.0` replaces that runtime fallback with the version bundled from `package.json`.
- Protected `/api/health/database` returned `status: ok`.
- The observed protected database-health latency was 3 milliseconds.
- The staging dashboard loaded synchronized project and financial data.

## Authentication Results

- The hosted Teamwork OAuth callback completed successfully.
- The central Teamwork reporting connection was stored in Neon.
- Hosted redirects remain on the Render public domain.
- Teamwork employee eligibility checks pass after the initial import.
- The bootstrap administrator successfully received the Admin role.
- No OAuth token, setup key, encryption key, or database credential was committed.

## Synchronization Results

- The existing `job:nightly-sync` process remains unchanged.
- The job synchronizes Teamwork records, refreshes financial sources, recalculates projects, and creates daily snapshots.
- GitHub Actions can connect directly to the Neon staging database.
- The manual staging workflow completed successfully after installing development dependencies.
- Automatic staging synchronization is scheduled for:
  - 7:00 AM America/New_York every day.
  - 4:00 PM America/New_York every day.
- The workflow uses encrypted GitHub repository secrets.
- The workflow does not require the Render web service to remain awake.

## Workstation Validation

The following validation passed on the Windows development workstation:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 26 test files passed.
- 123 tests passed.
- Targeted Step 12 Prettier checks passed.
- `git diff --check` passed.

The combined `npm run check` command remains blocked by pre-existing formatting drift elsewhere in the repository. Step 12 did not reformat those unrelated files.

## Final Deployment Verification

- The Step 12 closeout release deployed successfully to Render.
- Public `/api/health` returned `status: ok`.
- Public `/api/health` reported application version `1.3.0`.
- The Render staging service remains connected to the `develop` branch.
- Render Auto-Deploy remains configured for successful CI checks.
- The closeout deployment was started using **Manual Deploy → Deploy latest commit** after an automatic deployment did not begin.
- The next merge to `develop` should be observed to confirm automatic deployment behavior.
