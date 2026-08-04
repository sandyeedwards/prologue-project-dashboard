# Step 11 Completion Checklist

## Source Control

- [x] Private GitHub repository established.

- [x] `develop` is the integration branch.

- [x] `main` is reserved for production releases.

- [x] Feature work is performed in feature branches.

- [x] GitHub Actions runs validation for `develop` and `main`.

## Environment Configuration

- [x] Local `.env` is excluded from Git.

- [x] Sanitized `.env.example` is tracked.

- [x] Required environment variables are validated.

- [x] Runtime database traffic uses `DATABASE_URL`.

- [x] Database migrations prefer `DIRECT_DATABASE_URL`.

- [x] Hard-coded migration database fallback was removed.

- [x] Staging and production secrets will remain separate.

## Application Hosting

- [x] Render selected for application hosting.

- [x] Neon selected for hosted PostgreSQL.

- [x] Staging service uses the `develop` branch.

- [x] Production service uses the `main` branch.

- [x] Production automatic deployment remains disabled initially.

- [x] Render Blueprint configuration is tracked in `render.yaml`.

- [x] Application health endpoint is available at `/api/health`.

## Staging Preparation

- [x] Create the Neon project.

- [x] Create separate staging and production database environments.

- [x] Create the Render Blueprint.

- [x] Add staging environment variables in Render.

- [x] Run database migrations against the staging database.

- [x] Deploy the staging web service.

- [x] Configure the staging Teamwork OAuth callback.

- [x] Validate staging authentication and reporting.

## Production Preparation

- [ ] Add production environment variables in Render.

- [ ] Run database migrations against the production database.

- [ ] Configure `dashboard.prologuesystems.com`.

- [ ] Configure the production Teamwork OAuth callback.

- [ ] Validate backups and recovery procedures.

- [ ] Enable production deployment only after staging approval.

## Step 11 Exit Criteria

Step 11 is complete when:

1. All tracked architecture and environment changes pass CI.

2. The feature branch is merged into `develop`.

3. The staging and production architecture is documented.

4. No real credentials are committed.

5. Step 12 can begin with creation of the hosted staging environment.
