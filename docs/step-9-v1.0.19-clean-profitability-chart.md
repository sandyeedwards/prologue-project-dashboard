# Step 9 v1.0.19 — Clean Profitability Chart

## Purpose

Bring the primary Dashboard profitability visualization in line with the approved clean financial-report reference without changing calculations or source data.

## Interface changes

- Added a shared positive/negative currency scale with compact tick labels.
- Added subtle horizontal gridlines and a vertical value axis.
- Used square, full-width operational-group columns instead of rounded inset columns.
- Displayed revenue as the total column, divided into included forecast cost and forecast profit.
- Repeated forecast cost below zero in light blue for visual comparison only.
- Simplified the chart explanation into a single compact note.
- Enlarged Key Takeaway text and enabled safe line wrapping for longer generated statements.

## Unchanged behavior

- No database migration is required.
- No Teamwork synchronization or reauthorization is required.
- Financial calculations and operational-group allocation logic are unchanged.
- `NoReport` remains the sole reporting-exclusion tag.

## Verification

Run `npm run step9:ui-setup`, then visually confirm the Dashboard and combined-project report at multiple browser widths.
