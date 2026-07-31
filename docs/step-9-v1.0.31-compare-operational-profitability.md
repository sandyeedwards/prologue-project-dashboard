# Step 9 v1.0.31 — Compare Operational-Group Profitability

This release changes only the Compare report profitability graph.

## Compare report behavior

- Each selected project remains separate.
- Projects are assigned stable P1–P6 codes in selection order.
- Each operational group is one chart cluster.
- Every cluster contains one project position for each selected project.
- A dash indicates that a project has no work mapped to that operational group.
- The shared currency axis allows direct comparison between projects and groups.

## Profitability column composition

- Blue outline: allocated revenue
- Dark amber: actual cost to date
- Light amber: costed remaining work
- Green: forecast profit
- Red: forecast loss

Hovering or focusing a project/group position shows exact values, margin, and provisional status.

## Scope preserved

The Dashboard profitability views and Combined Project Report profitability views are unchanged. No database schema migration, authentication change, Teamwork reauthorization, or calculation-rule change is included.
