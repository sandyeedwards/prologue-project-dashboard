# Step 10 v1.0.0 — Executive Design Overhaul

## Scope

Step 10 is a visual and interaction redesign built directly from Step 9 v1.0.39. No financial source, database table, calculation engine, Teamwork endpoint, authentication rule, or reporting-exclusion policy was changed.

## Design system

- Navy application shell with restrained Prologue blue accents.
- White reporting surfaces on a cool neutral background.
- Reduced corner radii and restrained shadows.
- Stronger typography and spacing hierarchy.
- Consistent financial colors:
  - Blue: actual cost / core reporting
  - Amber: costed remaining work
  - Green: unspent revenue / forecasted profit
  - Red: loss and cost overrun
  - Navy: allocated revenue and primary structure

## Information hierarchy

Primary financial values are presented first throughout the application:

1. Actual Cost to Date
2. Costed Remaining Work
3. Unspent Revenue / Forecasted Profit

Supporting values such as allocated revenue, project count, hours, task completion, and coverage remain available but are visually secondary.

## Compare chart redesign

Each project uses a normalized revenue baseline. This makes project performance comparable regardless of contract size.

- Orange: actual cost to date
- Yellow: costed remaining work
- Uncovered blue: unspent revenue / forecasted profit
- Red beyond the revenue threshold: cost overrun
- Green line: forecast-cost boundary while profitable
- Black dashed line: revenue threshold when costs overrun

The red overrun zone is scaled across the selected projects, while the revenue baseline remains consistent.

## Individual project financial graphic

The project page now includes a financial composition chart using the same categories. Exact values are shown directly above the bar and the original fee and forecast cost are labeled beneath it.

## Responsive behavior

- Desktop: full three-tier KPI hierarchy and two-column analysis layout.
- Tablet: financial cards reduce to two columns and supporting charts stack cleanly.
- Mobile: navigation simplifies, tabs become stacked controls, tables scroll locally, and project/comparison rows collapse into readable vertical groups.
