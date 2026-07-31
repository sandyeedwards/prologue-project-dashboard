# Step 4 completion checklist

Step 4 is complete when all items below are true.

- [ ] The complete replacement package is extracted to a clean local folder.
- [ ] Node.js 24 LTS is installed, or Node.js 22 LTS is available.
- [ ] `package.json` is visible in the current PowerShell folder.
- [ ] `npm ci` completes.
- [ ] `.env.example` is copied to `.env` without adding production secrets.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run dev` serves the starter page.
- [ ] `/api/health` returns JSON with `status: ok`.
- [ ] Git is initialized locally.
- [ ] The first commit is created.
- [ ] A private GitHub repository is created.
- [ ] The local `main` branch is pushed to the private repository.
- [ ] GitHub Actions completes the quality-check and build job.

Database persistence is intentionally not part of Step 4. The database container is included only as local preparation; Step 5 installs the schema and migration tooling.
