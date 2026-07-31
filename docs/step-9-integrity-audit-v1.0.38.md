# Step 9 v1.0.38 Integrity Audit

This audit covers the packaged source and static structure of the Step 9 dashboard after the Compare Projects profitability-marker update.

## Static checks completed

- ZIP archive structure and decompression
- External SHA-256 verification
- Internal source-manifest verification
- TypeScript and TSX syntax parsing
- Local import-path resolution
- CSS parsing
- JSON and YAML parsing
- Drizzle migration journal/file consistency
- Package and lockfile metadata consistency
- Merge-marker and secret-file scans
- Packaging hygiene (`.env`, `.next`, `node_modules`, and generated TypeScript build information excluded)
- Compare chart marker presence and Dashboard profitability-tab-order assertions

## Runtime checks still required on the deployment workstation

The full dependency-backed build and database-connected Step 9 verifier could not be executed in the packaging environment because its npm proxy did not contain one transitive package. Before closing Step 9, run:

```powershell
npm ci --no-audit --no-fund
npm run step9:setup
```

Then manually confirm every item in `docs/step-9-completion-checklist.md`, including login, permissions, filters, project detail, compare/combine behavior, and an incognito-browser test.

## Step 10 gate

Proceed to Step 10 only after `npm run step9:setup` returns `PASS` against the real database and the manual completion checklist is signed off. Static packaging integrity alone is not a substitute for those runtime checks.
