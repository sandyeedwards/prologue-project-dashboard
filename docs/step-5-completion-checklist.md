# Step 5 completion checklist

- [ ] Docker Desktop is running.
- [ ] `.env` exists and contains the local `DATABASE_URL`.
- [ ] `docker compose up -d database` reports a healthy PostgreSQL container.
- [ ] `npm run db:migrate` succeeds.
- [ ] `npm run db:seed` succeeds.
- [ ] `npm run db:check` returns `status: ok`.
- [ ] `npm run check` passes formatting, lint, TypeScript, and tests.
- [ ] `npm run build` succeeds.
- [ ] `/api/health/database` returns `status: ok` while the database runs.
- [ ] `.env` remains uncommitted.
