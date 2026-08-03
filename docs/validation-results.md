# Validation Results

Package: Step 7 v1.0.0  
Application version: 0.5.0

## Completed in the packaging environment

- Strict TypeScript structural validation passed for the Step 7 calculation modules, commands, jobs, and database schema using isolated dependency stubs.
- Pure calculation assertions passed for:
  - parent-versus-subtask canonical estimate selection;
  - branch logged-time aggregation;
  - equal user-assignment collection while preserving team/company/job-role assignments;
  - health scoring and negative-margin red override;
  - outsourced-modeling inheritance from a matched parent task.
- Drizzle migration metadata was validated as JSON and contains the four Step 7 derived-data tables.
- `package-lock.json` contains public npm registry package URLs and no authoring-environment registry URLs.
- Package JSON and all Drizzle metadata JSON files parse successfully.

## Dependency-installation limitation

The packaging environment's npm gateway returned HTTP 503 while downloading dependencies. Because of that external package-service failure, a fresh dependency-based Prettier, ESLint, Vitest, and Next.js build could not be completed in the packaging environment.

Run these commands on the Windows development computer before executing Step 7:

```powershell
npm ci --no-audit --no-fund
npm run format
npm run check
npm run build
```

The final acceptance test is `npm run step7:run` followed by a Step 7 verification result with `status: PASS`.

## Step 7 v1.0.1 correction

Corrected strict-null typing in the expense subtotal, corrected Drizzle transaction execution in the reset helper, removed an unused variable, and changed the Step 7 runner to migrate before calculating.

The packaging environment could not reach its npm dependency service during the v1.0.1 correction. The corrected source was reviewed against the exact five compiler errors supplied by the Windows validation run. Run `npm run step7:setup` on the development computer for the authoritative formatter, lint, TypeScript, test, build, migration, calculation, and verification result.

## Step 8 validation scope

The Step 8 package adds pure unit tests for role hierarchy, safe internal return paths, administrator-email normalization, and session-token hashing. The guided setup additionally validates formatting, lint, strict TypeScript, all unit tests, the production build, PostgreSQL, the Step 7 calculation state, employee provisioning, one active administrator, session storage, and exclusion of ineligible Teamwork users.

### Step 8 package-build validation note

The package source passed TypeScript syntax transpilation across all source files, internal import-resolution checks, and direct assertions for role hierarchy, safe return paths, employee eligibility, administrator-email normalization, and session-token hashing. A temporary dependency-registry outage prevented a fresh dependency-based lint, full typecheck, test, and Next.js build in the packaging environment. `npm run step8:setup` performs those complete checks on the target Windows workstation before applying the Step 8 migration or provisioning users.

## Step 9 v1.0.3 validation scope

- TypeScript syntax transpilation passed for all 100 source files.
- Internal source import resolution passed for all 100 source files.
- Direct assertions passed for project-budget normalization and source-aware expense normalization, including `352500 -> 3525` for budget expenses and preserving `1950 -> 1950` for legacy expenses.
- The project reporting query now returns internal labor and expenses separately, and Step 9 verification checks that their sum reconciles to actual cost.
- The package environment's npm gateway continued returning HTTP 503 for dependency tarballs, so `npm run step9:setup` on the Windows workstation remains the authoritative Prettier, ESLint, strict TypeScript, Vitest, production-build, live-data refresh, and reconciliation verification.

## Step 9 v1.0.5 validation scope

- TypeScript syntax transpilation passed for all 111 TypeScript and TSX source/configuration files.
- Local import resolution passed for all 111 checked files.
- Direct assertions passed for individual-assignment precedence, role-only fallback, equal allocation, partial-rate handling, top-level unplanned-work classification, subtask exemption, USD job-role cost selection, and nested/ID-keyed assignment parsing.
- Package JSON, lockfile metadata, migration journal, and the Step 9 migration snapshot parse successfully.
- `package-lock.json` uses public npm registry URLs.
- The packaging environment's npm gateway returned HTTP 503 for a dependency tarball, so `npm run step9:setup` on the Windows workstation remains the authoritative formatter, lint, strict TypeScript, Vitest, production-build, migration, live-data refresh, and Step 7–9 verification run.

## Step 9 v1.0.6 package validation

- TypeScript syntax transpilation: 114 source files passed.
- Local import resolution: 211 imports passed.
- Expense-coverage assertions passed for ordinary projects, outsourced-cost projects, complete expenses, and partial expenses.
- Full npm validation is run by `npm run step9:setup` on the target Windows computer because the packaging registry was unavailable during this build.

## Step 9 v1.0.8 package validation

- TypeScript/TSX syntax transpilation passed for 116 source and configuration files.
- Local source import resolution passed for 216 imports.
- JSON parsing passed for package metadata and TypeScript configuration.
- CSS block-balance validation passed.
- Direct source assertions confirmed that health badges display percentages, dashboard filters drive the summarized project set, the persistent navigation is reduced to reporting links, and the Help page contains role-authorized tool links.
- `package-lock.json` contains public npm registry URLs.
- The packaging environment's npm service did not complete a dependency installation, so `npm run step9:setup` on the Windows workstation remains the authoritative Prettier, ESLint, strict TypeScript, Vitest, production-build, live-sync, calculation, and Step 7-9 verification run.

## Step 9 v1.0.9 package validation

Validated in the packaging environment on July 27, 2026:

- TypeScript/TSX syntactic transpilation passed for 113 source files.
- Local import resolution passed for 220 project-relative imports.
- The cleaned Prologue SVG parsed successfully in both public and Next.js app-icon locations.
- JSON metadata and lockfile parsing passed.
- CSS brace validation passed with 372 balanced rule blocks.
- Direct source assertions passed for semantic health labels, financial color mapping, Ready Set/DataHall Scanning facets, and the NoReport exclusion message.
- Logo preview rendered successfully as a transparent 512×512 PNG.

A fresh `npm ci` in the packaging container stalled without registry output and timed out. The workstation command `npm run step9:setup` remains the definitive dependency-based Prettier, ESLint, strict TypeScript, Vitest, Next.js production build, database, sync, calculation, and runtime-reporting validation.

## Step 9 v1.0.10 packaging validation

- Parsed 114 TypeScript/TSX source files successfully with the TypeScript compiler API.
- Type-checked the new searchable multi-project selector against strict local stubs.
- Validated all `@/` local imports.
- Parsed the complete CSS file successfully with PostCSS.
- Verified that dashboard scope contains Client, Health, Status, and repeated Project inputs only.
- Verified that Financial Status, Project Type, and Project Order are absent from the dashboard scope.
- Verified client and explicit project-ID filtering in the reporting data layer.
- A fresh dependency installation was attempted but the package registry did not respond within the packaging runtime. `npm run step9:setup` performs the definitive formatter, lint, strict typecheck, unit tests, and Next.js production build on the deployment workstation.

## Step 9 v1.0.11 packaging validation

- Restored the Projects page import for `getAvailableProjectTypes`, resolving the exact strict TypeScript error reported by the workstation.
- Confirmed that `getAvailableProjectTypes` is exported by the reporting data module and imported by the Projects page.
- TypeScript/TSX syntax transpilation passed across the source tree.
- Project-local import resolution passed.
- A fresh dependency installation did not finish within the packaging runtime, so `npm run step9:setup` remains the authoritative formatter, ESLint, strict TypeScript, Vitest, Next.js build, database, synchronization, calculation, and reporting verification run.

## Step 9 v1.0.13 packaging validation

- TypeScript/TSX syntax transpilation: 119 files passed.
- Local `@/` import resolution: passed.
- JSON and SVG parsing: passed.
- Compare and Combine controls: present on the Projects page.
- Compare mode six-project server validation: present.
- Combine mode application-level selection cap: none.
- Combined margin uses combined totals rather than an average of project margins.
- Profitability bridge uses a dark zero baseline and plots forecast cost below zero as a deduction.
- Primary navigation no longer includes a separate Compare tab.
- Full dependency-based lint, strict typecheck, unit tests, and Next.js build must be run with `npm run step9:ui-setup` on the target workstation because the packaging registry returned HTTP 503.
