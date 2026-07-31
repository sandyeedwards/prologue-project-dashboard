# Step 6 Completion Checklist

Use the guided restart rather than manually troubleshooting individual database rows.

## Required sequence

```powershell
npm ci --no-audit --no-fund
npm run db:check
npm run step6:restart
```

Type `RESTART STEP 6` when prompted.

## Required result

The final verification output must report:

```json
{
  "status": "PASS"
}
```

The following checks must all be true:

- active Teamwork connection exists;
- latest sync completed successfully or with acceptable warnings;
- projects imported;
- task lists imported;
- tasks imported;
- time entries imported;
- task import coverage is at least 90 percent;
- time-entry import coverage is at least 90 percent.

## Independent verification

```powershell
npm run teamwork:verify
npm run teamwork:status
npm run check
npm run build
```

Do not proceed to Step 7 if verification reports `FAIL`.
