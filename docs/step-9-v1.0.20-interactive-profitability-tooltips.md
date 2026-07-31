# Step 9 v1.0.20 — Interactive Profitability Tooltips

## Purpose

Reduce visual clutter in the primary profitability chart while keeping detailed financial values immediately available on demand.

## Interface changes

- Removed static value labels from the operational-group bars.
- Added an HTML tooltip rendered above the SVG chart.
- The tooltip follows pointer movement while the pointer remains over a bar.
- Edge-aware positioning flips and clamps the tooltip so it stays within the chart panel.
- Tooltip values include allocated revenue, included forecast cost, forecast profit or loss, the repeated cost deduction, margin, and project count.
- Hovered or keyboard-focused bars receive a subtle visual emphasis.
- Each bar can be reached with the keyboard; focus displays the tooltip and Escape dismisses it.
- Scrolling the horizontal chart area dismisses any open tooltip to prevent stale positioning.

## Unchanged behavior

- The positive and negative currency scale is unchanged.
- Forecast cost below zero remains a visual comparison only and is not counted twice.
- Financial calculations, operational-group allocation, filtering, and database queries are unchanged.
- No database migration, Teamwork synchronization, or Teamwork reauthorization is required.
- `NoReport` remains the sole reporting-exclusion tag.

## Verification

Run `npm run step9:ui-setup`, then test pointer movement, edge placement, pointer exit, keyboard focus, and Escape dismissal on both the Dashboard and Combined Project Report.
