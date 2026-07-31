# Prologue Project Dashboard — Step 10 v1.1.15

## v1.1.15 Step 10 verifier closure

- Loads `.env` in the final reporting-page verifier and closes the SQL client after every outcome.
- Replaces brittle exact-copy assertions with behavior-oriented checks for tooltip interaction, collapsible operational groups, and provisional-label support.
- Preserves detailed per-check diagnostics while avoiding failures caused only by harmless wording or default-open markup changes.
- Does not change the dashboard UI, financial formulas, Teamwork synchronization, database schema, reporting data, or Kapalua pilot.
- This is the Step 10 closure candidate; run `npm run step10:ui-setup` locally to record the final database-backed PASS.

## v1.1.14 relationship-audit recovery

- Fixes the date diagnostic command so it reads the same `.env` file as the other Teamwork and database commands.
- Requests only normal Teamwork projects for task-list and task synchronization.
- Defers task lists whose project relationship is absent, then recovers the relationship from their task records when possible.
- Ignores unreferenced task lists that cannot affect reportable calculations while continuing to fail verification for unresolved reportable tasks or time entries.
- Reports recovered, unreferenced, conflicting, and reportable relationship counts separately in Step 7 verification.
- No database migration or Teamwork reauthorization is required.

## v1.1.13 data-integrity fixes

- Uses **26-101 - Resort at Kapalua Bay - JHGI** as the calculation pilot and verifies outsourced cost against the configured hourly rate.
- Reads Teamwork V3 time-entry dates from the documented `timeLogged` field, while retaining compatibility with older date shapes.
- Adds date-parser tests for ISO dates, compact dates, Unix timestamps, nested values, and invalid/pre-2000 values.
- Adds `npm run teamwork:diagnose-time-dates` to identify any remaining Teamwork date shapes that are not recognized.
- Silently skips task lists, tasks, and time entries belonging to `NoReport` projects so excluded records do not create relationship-warning noise.
- Step 7 verification now fails when time entries still use fallback dates or reportable task-list relationships remain unresolved.


## Step 10 v1.1.12 project workspace refinement

- Made the three profitability tabs more visually distinct and easier to scan.
- Moved Projects workspace filters beside the project-selection workflow, directly above the selectable list and below any active report.
- Added 25, 50, and 100 projects-per-page options with Previous, Next, and page-number controls.
- Project selections remain intact while filtering, paging, changing page size, and reviewing an open Compare or Combined Report.
- Financial formulas, historical calculations, Teamwork synchronization, database schema, and report definitions are unchanged.

## Step 10 v1.1.11 historical range workflow update

- Replaced the separate Custom date editor beneath the historical chart with the shared Project date fields above the profitability tabs.
- Selecting **30 days**, **3 months**, **6 months**, or **1 year** immediately populates the shared From and Through fields with the visible historical period.
- Renamed **Project life** to **Unlimited**. Unlimited clears the shared historical dates and restores the complete available timeline.
- Added **Reset range**, which returns only the historical view to Unlimited without changing client, project type, health, or status filters.
- Selecting **Custom** highlights and focuses the shared Project date fields. Valid changes update the chart directly, and manually submitted filters remain available after a page refresh.
- Reworked chart selection so pointer-down establishes the first date. Users can press, drag, and release to zoom, or click-release once and click again to finish the range.
- Chart-created zoom ranges populate the shared Project date fields and become the active Custom range.
- Profitability tabs now remain mounted while inactive so a historical range is retained when the user switches between chart tabs.
- Financial calculations, Teamwork synchronization, database schema, project selection, and reporting definitions are unchanged.

## Step 10 v1.1.10 historical range interaction update

- Added click-based historical chart range selection and a Custom range workflow.
- Simplified visible historical labels while preserving cumulative calculations.
- v1.1.11 replaces the separate Custom editor with the shared Project date fields and adds drag-to-zoom.

## Step 10 v1.1.9 historical forecast and date-integrity update

- Prevents invalid legacy epoch dates from extending the Project life chart to 1970. Historical dates before 2000 are rejected.
- Existing legacy-dated labor costs are temporarily assigned to the best available project date so they remain included without distorting the timeline.
- The Teamwork sync now parses ISO, compact, and Unix timestamp dates and no longer writes `1970-01-01` when a time-entry date is unavailable.
- Adds **Cumulative anticipated cost to date** in orange. This is the latest forecast cost for projects that had started by each point on the timeline.
- Adds **Cumulative forecasted net profit** in bright lime green. This is the latest forecast profit for projects that had started by each point on the timeline.
- Changes **Cumulative actual cost to date** to red while preserving gross revenue in blue and actual net profit to date in dark green.
- Forecast lines are current projections arranged by project start date; they are not archived historical forecast snapshots.
- No database migration is required. Run `npm run step9:refresh-calculations` once after installing this version to repair legacy time-entry dates through the normal Teamwork sync and recalculate the reporting metrics.

## Step 10 v1.1.8 financial-integrity update

- Rebuilt the Historical Revenue & Net Profit series from dated Teamwork source transactions instead of posting each project's entire actual cost at completion.
- Labor cost is recognized on each time-entry date using `historical_cost_total`, or `logged hours × historical_cost_rate` when Teamwork did not return a total.
- Project expenses are recognized on their expense dates; an expense without a source date uses its import date and is identified in the historical tooltip.
- Cumulative net profit now always equals cumulative gross revenue minus cumulative actual cost to date.
- Removed completed-project revenue from the main historical tooltip because it is not part of the net-profit-to-date calculation.
- Actual completion counts now use actual Teamwork completed/archived timestamps rather than a past planned end date.
- Added source-to-metric actual-cost reconciliation to `npm run step7:verify`. A mismatch now fails the verification gate and is surfaced in the historical chart.
- Improved Actual Cost to Date coverage wording so known subtotals from partial projects are not described as fully complete.
- No database migration is required.

## Step 10 v1.1.7 updates

- Moved the filtered reporting-project count into the Selection Workspace beneath its description.
- Moved the filtered-results persistence note directly beneath the Compare selected and Combine selected buttons.
- Preserved project selection, filters, compare/combine limits, calculations, and report behavior.

## Step 10 v1.1.6 updates

- Removed the remaining blue, amber, green, and red visual accents from the three primary financial KPI tiles.
- Actual Cost to Date, Costed Remaining Work, and Forecasted Profit now use clean white surfaces with neutral gray indicators.
- Applied the neutral primary KPI treatment consistently to the Dashboard, Combined Project Report, and individual project pages.
- Preserved the hover help, financial values, filters, Teamwork integration, reporting definitions, exports, and database behavior.

## Step 10 v1.1.5 updates

- Removed hover-state flashing from the six Dashboard and Combined Report KPI tiles.
- Changed KPI question-mark explanations from click-open details to automatic hover and keyboard-focus tooltips.
- Widened and spaced the Portfolio, Projects, and Guide navigation controls to better use the header.
- Extended the light Prologue-blue page canvas to every authenticated page while preserving white report surfaces and tiles.
- Preserved all financial calculations, filters, Teamwork integration, reporting definitions, exports, and database behavior.

## Step 10 v1.1.4 updates

- Added **Historical Revenue & Net Profit** as a third tab in the Combined Project Report, scoped to the selected projects.
- Moved the light Prologue-blue treatment from the KPI wrapper to the page canvas on the Dashboard and Combined Report.
- Removed the enclosing tile behind the KPI tiles so each metric card sits independently on the blue canvas.
- Preserved all financial calculations, filters, Teamwork integration, and reporting definitions.

## v1.1.3 refinement

- Added a restrained Prologue-blue backing behind the six Dashboard KPI tiles so the financial summary reads as one intentional section.
- Removed the blue allocated-revenue outline/foundation from the Forecasted Profitability composition graphic.
- The composition bar now uses the full available revenue width whenever there is no cost overrun; red extension space is reserved only when an overrun actually exists.
- Corrected the date-field accessibility warning by moving `aria-expanded`, `aria-haspopup`, and popup ownership to the calendar button instead of the text input.

This release continues the executive refinement from Step 10 v1.1.1 and focuses on clearer revenue context and a more informative historical financial trend. It keeps the existing Teamwork integration, PostgreSQL schema, financial calculations, filters, authentication, reporting definitions, exports, project-health logic, historical calculations, and `NoReport` exclusion policy intact.

## v1.1.2 financial visualization refinements

- v1.1.2 added a visible blue allocated-revenue foundation and threshold to the primary profitability composition graphic; v1.1.4 replaces that treatment with a cleaner full-width composition bar.
- Added cumulative cost to date as a third historical line alongside cumulative gross revenue and cumulative net profit.
- Made the historical tooltip follow the pointer horizontally and vertically while retaining keyboard navigation.
- Preserved all existing filtering, Teamwork integration, database schema, financial formulas, and reporting behavior.

## v1.1.1 report workflow refinements

- Moved Dashboard filters into the shared profitability-tab region so one visible filter row updates every Dashboard graph and KPI.
- Prioritized project dates and project type, followed by client, health, and status. Dashboard project search and custom project selection were removed from this page.
- Added flexible date controls: click anywhere to open the calendar, or double-click to type dates such as `4/4/24`, `04/04/2024`, or `4-4-24`. Valid entries normalize to `MM/DD/YYYY`.
- Made project search and all comparison filters permanently visible in the Projects workspace.
- Extended Dashboard and Combined Report profitability graphics to the full report width. Health Summary and Logged vs Estimated Hours now sit in a balanced support row below the financial graph.
- Made every operational group in Compare Projects independently collapsible while keeping each group expanded by default.
- Preserved financial formulas, Teamwork integrations, database schema, reporting definitions, exports, and project-health logic.

## Design direction

The application now uses one restrained Prologue Systems interface system rather than a collection of unrelated cards. Financial pages consistently prioritize:

1. **Actual Cost to Date**
2. **Costed Remaining Work**
3. **Unspent Revenue / Forecasted Profit**

Secondary metrics remain available but no longer compete with those three values.

## Major improvements

### Executive Dashboard and Combined Report

- Consolidated primary and supporting KPIs into compact financial bands with consistent alignment and spacing.
- Replaced the primary profitability graphic with a horizontal composition view showing actual cost, remaining work, forecast profit, the allocated-revenue threshold, and red overrun extensions.
- Flattened chart framing, reduced unused space, refined tabs and legends, and improved the Key Takeaway hierarchy.
- Preserved the historical revenue and net-profit timeline and its filtering behavior.

### Project comparison

- Added an **Attention first** default order plus margin, profit, and name sorting.
- Added direct project status labels such as On track, Work remaining, Low margin, and Over budget.
- Preserved Entire Project and By Operational Group modes while making project order consistent between groups.
- Replaced repeated detail cards with a compact financial register for faster comparison.

### Projects and project detail

- Reorganized project filters into everyday and advanced controls.
- Refined the financial-first project table with stronger numeric alignment, quieter row separation, and health cues that do not rely on color alone.
- Applied the same Actual / Remaining / Profit hierarchy to individual project pages.
- Standardized task, labor, expense, coverage, issue, and supporting-data sections.

### Application system

- Made navigation more compact and integrated the Prologue mark without allowing the header to dominate the page.
- Standardized typography, control heights, border radii, section spacing, tables, tooltips, badges, loading states, empty states, and errors.
- Added responsive layouts for large desktops, office monitors, laptops, narrow windows, and tablet-sized widths.

## Functional and calculation changes

v1.1.8 corrects the historical reporting calculation without changing the underlying project-level financial engine. The Dashboard and Combined Report now reconstruct dated actual cost from Teamwork time entries and expenses, and historical net profit is gross revenue minus those cumulative costs. Project-level Actual Cost to Date, forecast calculations, Teamwork synchronization, database schema, health logic, filters, and exports remain unchanged. The verification gate now reconciles the project metric actual total against the same source records used by the historical chart.

## Step 10 completion status

The Step 10 design and source implementation is complete in this release, subject to the local source-cost reconciliation and real-database checks. Promotion to the next development step should occur after the local dependency-backed gate and the real-database checks in `docs/step-10-completion-checklist.md` pass.

## Setup

Extract the package into a new folder. Copy only the working `.env` file from Step 10 v1.1.7; do not copy `.next` or `node_modules`.

```powershell
npm ci --no-audit --no-fund
npm run step9:refresh-calculations
npm run step10:ui-setup
npm run dev
```

The application expects the existing PostgreSQL database and Teamwork connection. The refresh step is recommended for final sign-off so source transactions and project metrics are synchronized before reconciliation. This release does not add a database migration.

## Focused testing checklist

1. Confirm Actual Cost to Date, Costed Remaining Work, and Forecasted Profit match v1.0.1 for the same filters.
2. Test Dashboard date, project-type, client, health, and status filters, plus reset and no-result states.
3. Compare one, several, and six projects in Entire Project and By Operational Group modes.
4. Verify profitable and over-budget rows, exact-value tooltips, sorting, and missing-data labels.
5. Open profitable, provisional, incomplete, and over-budget project pages.
6. Confirm the latest historical Actual Cost to Date matches the Dashboard/Combined actual-cost total for the same portfolio, and verify Net Profit = Gross Revenue − Actual Cost.
7. Confirm active-project labor and expenses appear on their source dates before project completion, and that a past planned end date alone does not mark a project completed.
8. Verify Viewer, Manager, and Admin navigation and permissions.
9. Review large desktop, 1280 px, laptop, narrow-window, and tablet layouts.
10. Confirm report/export values still match the visible dashboard values.

## Known validation limitation

The final dependency-backed Next.js build must be run locally. The packaging environment could not install one transitive npm package from its internal registry mirror. Static TypeScript/TSX syntax, imports, CSS, configuration, archive integrity, and unchanged calculation-source checks are documented in the accompanying validation report.


