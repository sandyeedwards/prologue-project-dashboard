# Step 10 v1.0.0 Validation Report

## Baseline

- Source archive: `prologue-project-dashboard-step9-v1.0.39(1).zip`
- Baseline SHA-256: `94cf209f0105207c023cfb42b70f488e397ead8cdf894904d48aac9e7b491ca5`
- Baseline ZIP integrity: passed with no compressed-data errors.

## Scope integrity

The redesign was built directly on the uploaded Step 9 v1.0.39 source. Exact tree comparisons confirmed that the following application logic remained unchanged:

- `src/lib` — reporting, calculations, Teamwork integration, formatting, authorization, and database access
- `src/db` — schema and database layer
- `drizzle` — migrations and snapshots
- `src/config` — reporting configuration
- `src/app/api` — API and authentication routes

No database migration was added.

## Static validation completed

- TypeScript/TSX syntax transpilation: **130 files passed**
- Local source import resolution: **244 imports checked, 0 missing**
- CSS parsing: **1,405 stylesheet rules parsed, 0 errors**
- JSON parsing: **10 files checked, 0 errors**
- YAML parsing: **2 files checked, 0 errors**
- Package and lockfile version consistency: **passed**
- Merge-marker scan: **passed**
- Case-insensitive path-collision scan: **passed**
- Symlink scan: **passed**
- Sensitive/generated-file scan: **passed**
- `node_modules`, `.next`, `.env`, private keys, certificates, and TypeScript build-info files: **not included**
- Step 10 source assertions for executive KPI hierarchy, normalized project comparison, individual-project financial position, application branding, loading state, error state, and not-found state: **passed**

## Financial integrity

No stored financial value or reporting formula was changed. The following display-only relationship is used to present remaining work where the interface needs it:

```text
Costed Remaining Work = Forecast Cost − Actual Cost to Date
```

The normalized Compare Projects graphic changes only the visual scale. Exact dollar values remain unchanged in row labels and tooltips.

## Browser-rendered design checks

Representative static pages were rendered in Chromium at a 1,600 px desktop width and the Dashboard was also rendered at a 390 px mobile width. The checks covered:

- application header and navigation
- executive title and filter area
- primary and secondary KPI tiers
- profitability and effort layout
- normalized project-comparison rows
- individual-project financial composition
- desktop stacking and mobile stacking
- clipped text, overlap, and horizontal overflow in the representative pages

These previews use representative data and the actual Step 10 CSS, but they are not connected to the live database.

## Dependency-backed build limitation

A full `npm ci`, Next.js production build, ESLint run, Vitest run, and database-backed verification could not be completed in the packaging environment. The configured npm proxy returned:

```text
E404: zod-validation-error-4.0.2.tgz is not in this registry
```

This is an environment/package-proxy limitation rather than a source error. Before production deployment, run the following on the normal development workstation where public npm dependencies are available:

```powershell
npm ci --no-audit --no-fund
npm run step10:ui-setup
npm run dev
```

Then complete `docs/step-10-completion-checklist.md`, including database-backed financial comparisons and role-based workflows.

## Release assessment

The source package passed the available structural, syntax, import, stylesheet, serialization, packaging, financial-scope, and representative responsive-render checks. It is ready for local dependency-backed build validation and user acceptance testing.
