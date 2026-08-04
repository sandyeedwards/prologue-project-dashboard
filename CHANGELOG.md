# Changelog

## 1.3.0

- Deployed the hosted staging application to Render using the `develop` branch.
- Created and migrated the Neon staging database while preserving a separate production branch.
- Added separate staging and production Render Blueprint definitions.
- Added hosted URL construction through `APP_BASE_URL` for OAuth and logout redirects.
- Authorized the central Teamwork reporting connection and completed the initial hosted synchronization.
- Added automated staging synchronization at 7:00 AM and 4:00 PM America/New_York.
- Added encrypted GitHub Actions access to the staging database and Teamwork token key.
- Updated the health endpoint to report the version bundled from `package.json`.
- Validated Teamwork login, Admin provisioning, database connectivity, dashboard reporting, lint, TypeScript, 123 tests, and the production build.
- Left production deployment disabled pending staging approval.

## 1.2.0

- Added sanitized environment configuration for local, staging, and production deployments.
- Added separate runtime and direct migration database URL support, with required environment validation and no hard-coded migration fallback.
- Added Render staging and production service configuration using `develop` and `main`, with production automatic deployment initially disabled.
- Documented the Render and Neon hosting architecture and added the Step 11 completion checklist.
- Preserved reporting behavior, financial calculations, Teamwork synchronization, database schema, and the existing health endpoint.

## 1.1.15

- Added `.env` loading and deterministic SQL-client cleanup to the final reporting-page verifier.
- Replaced stale exact-copy assertions with behavior-oriented checks for profitability tooltip mechanics, collapsible operational groups, and provisional-label support.
- Retained detailed failed-check diagnostics without requiring a current provisional project or exact historical wording.
- Preserved all UI behavior, financial calculations, Teamwork mappings, database schema, NoReport handling, and the 26-101 Kapalua pilot.

## 1.1.14

- Fixed `teamwork:diagnose-time-dates` so it loads `.env` before opening the database and closes the SQL client cleanly.
- Limited task-list and task synchronization to normal Teamwork projects so project-template records do not enter the reporting audit.
- Added deferred task-list relationship recovery using the project IDs returned on task records.
- Treats task lists with no project relationship and no reportable task references as non-reporting records instead of false verification failures.
- Keeps unresolved relationships that affect reportable tasks or time entries as blocking warnings.
- Expanded Step 7 relationship diagnostics to distinguish recovered, unreferenced, conflicted, reportable, and legacy relationship records.
- Preserved the Kapalua pilot, time-entry date repair, financial formulas, database schema, and reporting UI.

## 1.1.13

- Changed the calculation pilot to **26-101 - Resort at Kapalua Bay - JHGI**.
- Reconciled the pilot outsourced-modeling projection to estimated hours multiplied by the configured outsourced hourly rate.
- Added support for Teamwork V3 `timeLogged` dates and resilient date normalization.
- Added focused Teamwork date parsing tests and a time-date diagnostic command.
- Suppressed task-list, task, and time-entry relationship warnings for projects excluded by the `NoReport` policy.
- Added Step 7 verification checks for fallback-dated time entries and unresolved reportable task-list relationships.

## 1.1.12

- Strengthened the Dashboard and Combined Report profitability tabs with larger click targets, distinct inactive states, and a prominent active treatment.
- Moved the Projects workspace filters directly above the selectable project list, below any open Compare or Combined Report.
- Added server-side project-list pagination with 25, 50, and 100 projects-per-page options.
- Preserved project selections across filter changes, page-size changes, pagination, and open Compare or Combined Reports.
- Added responsive project-list controls with visible matching-result and page-position summaries.
- Kept report calculations, Teamwork synchronization, database schema, historical metrics, and reporting definitions unchanged.
- Updated Step 10 verification to recognize hover/focus KPI help and the new paginated project-selection workspace.

## 1.1.11

- Replaced the historical chart's separate Custom date editor with the shared Project date From and Through fields.
- Preset historical ranges now populate those shared date fields; Unlimited and Reset range clear them.
- Renamed Project life to Unlimited and added a Reset range control that restores the full historical view without resetting other portfolio filters.
- Custom highlights and focuses the shared date fields, and valid date changes update the historical graph directly.
- Added pointer-down drag-to-zoom while retaining the click-release, move, and second-click workflow.
- Chart zoom selections populate the shared date fields and become Custom ranges.
- Kept profitability panels mounted while inactive so historical range state persists when switching tabs.
- No financial calculations, Teamwork synchronization, database schema, or reporting definitions changed.

## 1.1.10

- Added two-click historical chart zoom: click once to set the first date, move left or right, and click again to apply the selected date range.
- Added a translucent live selection band with boundary dates while a historical zoom range is being chosen.
- Added a Custom range tab with explicit From and Through calendar fields, validation, and reusable custom dates.
- A chart-created zoom automatically becomes the active Custom range.
- Added Escape and pointer-cancel behavior to abandon an in-progress chart selection.
- Simplified historical legend and tooltip labels by removing repetitive “Cumulative” prefixes while preserving cumulative calculations.
- Removed a duplicate gross-revenue SVG path from the historical chart.
- No financial calculations, database schema, Teamwork synchronization, or historical source metrics were changed.

## 1.1.9

- Removed legacy epoch dates from project-life history. Dates before 2000 are treated as invalid instead of extending the chart to 1970.
- Reassigns legacy or missing time-entry dates to the best available project date for display, while clearly reporting the fallback in the historical tooltip.
- Improved Teamwork time-entry date parsing for ISO dates, compact dates, and Unix timestamps; future syncs replace the former 1970 fallback with a created date, project start date, or import date and record a sync warning.
- Added cumulative anticipated cost to date using the latest forecast cost for projects started by each historical point.
- Added cumulative forecasted net profit using the latest forecast profit for projects started by each historical point.
- Changed cumulative actual cost to date to red, anticipated cost to orange, and forecasted net profit to bright lime green.
- Preserved cumulative gross revenue in blue and cumulative net profit to date in dark green.
- Added forecast-data coverage counts and legacy-date fallback counts to the historical tooltip.
- No database migration is required.

## 1.1.8

- Rebuilt historical Actual Cost to Date from dated Teamwork time entries and project expenses.
- Uses Teamwork historical cost totals first and falls back to logged hours multiplied by the historical cost rate for each time entry.
- Recognizes expenses on their expense date, with import-date fallback explicitly reported when the source date is missing.
- Calculates cumulative net profit as cumulative gross revenue minus cumulative actual cost to date at every historical point.
- Removed completed-project revenue from the primary historical tooltip and stopped using project completion as the financial-recognition event.
- Uses actual completed/archived timestamps only for the supplemental completed-project count; planned end dates no longer imply completion.
- Added actual-cost source reconciliation to Step 7 verification and an in-chart integrity warning when the source total differs from project metrics.
- Distinguished complete versus partial/missing actual-cost coverage in Dashboard and Combined Report KPI details.
- Added unit coverage for active-project costs, loss outcomes, true completion handling, missing cost records, and fallback-dated expenses.
- No database migration was added.

## 1.1.7

- Moved the visible reporting-project count into the Selection Workspace beneath its explanatory copy.
- Positioned the filtered-results persistence note below the Compare selected and Combine selected controls.
- Preserved all project filtering, selection, compare/combine, and financial-report behavior.

## 1.1.6

- Removed color accents and tinted backgrounds from the primary Actual Cost to Date, Costed Remaining Work, and Forecasted Profit KPI tiles.
- Standardized those primary KPI surfaces across Dashboard, Combined Report, and individual project pages.
- Preserved all financial formulas, filters, tooltips, Teamwork integration, exports, and report behavior.

## 1.1.5

- Removed transient hover highlighting from the six executive KPI tiles so their visual treatment remains stable as the pointer moves across them.
- Replaced click-to-toggle KPI help with hover and keyboard-focus tooltips that close automatically when the pointer or focus leaves.
- Expanded and spaced the three primary navigation buttons to use more of the available header width.
- Applied the Prologue-blue report canvas consistently across all authenticated application pages.
- Preserved financial calculations, filters, Teamwork integration, reporting definitions, database schema, and exports.

## 1.1.4

- Added the Dashboard historical revenue, cumulative cost, and net-profit chart to the Combined Project Report as a third tab.
- Scoped the combined historical graph to the projects currently selected in the combined report.
- Moved the light Prologue-blue treatment from the KPI wrapper to the Dashboard and Combined Report page canvas.
- Removed the enclosing KPI backing tile so the six KPI cards render as independent tiles.
- Preserved all calculations, filters, reporting logic, database schema, and Teamwork integration.

## 1.1.3

- Added a visible Prologue-blue backing behind the Dashboard KPI tiles.
- Removed the blue allocated-revenue outline and foundation from the Forecasted Profitability composition bar.
- Expanded under-budget profitability composition to use the full bar width, reserving extension space only when costs exceed revenue.
- Fixed the `jsx-a11y/role-supports-aria-props` warning by moving calendar popup ARIA state from the textbox to the calendar button.

## 1.1.2

- Added a visible Prologue-blue allocated-revenue foundation and threshold to the primary financial composition chart so the revenue baseline is no longer represented only by a neutral track.
- Added cumulative cost to date as a third historical trend line using the existing completed-project cost series.
- Updated the historical tooltip to follow the pointer in both directions while preserving keyboard inspection.
- Updated historical legends, points, tooltip labels, accessibility copy, and Help documentation to explain the cost line.
- Preserved all financial calculations, Teamwork synchronization, filtering, database schema, and reporting definitions.

## 1.1.1

- Moved Dashboard portfolio controls into one shared, always-visible filter row beneath the profitability tabs.
- Added Dashboard project-type filtering and removed Dashboard-specific project search/custom selection.
- Added calendar-first date controls with double-click manual entry, flexible separators, two-digit year handling, validation, and `MM/DD/YYYY` normalization.
- Made all Projects workspace search and filter controls visible while preserving compare/combine selections when filters are applied.
- Expanded Dashboard and Combined Report profitability panels to full width and moved Health Summary and effort exposure into a responsive support row below.
- Added independently collapsible operational-group sections to Compare Projects, expanded by default.
- Preserved all financial calculations, data sources, Teamwork synchronization, reporting definitions, exports, and database migrations.

## 1.1.0

- Introduced a restrained Prologue Systems executive design system with tighter spacing, consistent typography, quieter surfaces, and reduced card nesting.
- Rebuilt Dashboard, Combined Report, and project-detail KPIs around a shared financial hierarchy led by Actual Cost to Date, Costed Remaining Work, and Forecasted Profit.
- Replaced the primary profitability bars with a horizontal financial-composition view that directly shows actual cost, remaining work, unspent revenue, and cost overruns.
- Added a clearer compare workflow with attention-first sorting, performance labels, compact project rows, and a financial register beneath the visual comparison.
- Reorganized Dashboard and Projects filters into frequently used controls and expandable advanced controls without changing query parameters or filtering behavior.
- Refined project tables, report sections, Key Takeaway content, tooltips, empty states, navigation, responsive layouts, and focus/hover states.
- Preserved Teamwork integration, database schema, financial formulas, project calculations, health logic, reporting definitions, exports, and the NoReport exclusion rule.

## 1.0.1 — Dashboard Density and Compare Simplification

- Reduced Dashboard KPI tile height, padding, type scale, and spacing so the main profitability graph appears higher in the initial viewport.
- Strengthened the blue visual treatment of Actual Cost to Date.
- Removed colored accents from Allocated Revenue, Projects in View, and Logged Hours on the Dashboard.
- Renamed the primary Dashboard profit KPI to Forecasted Profit.
- Simplified Compare Projects composition bars to Actual Cost to Date, Costed Remaining Work, Unspent Revenue / Forecasted Profit, and Cost Above Revenue.
- Removed the allocated-revenue fill and permanent profitability / threshold markers from the compare graphic while preserving allocated revenue as the 100% calculation baseline and in exact-value tooltips.
- Centered Forecast Profit and Margin headings and values.
- Preserved all financial formulas, filters, Teamwork integration, database schema, and reporting definitions.

## 1.0.0 — Step 10 Executive Redesign

- Completed a full visual and user-experience overhaul across the application shell, Dashboard, project workspace, Compare and Combine reports, individual project pages, help, authentication, administration, loading, empty, and error states.
- Reorganized primary financial reporting around Actual Cost to Date, Costed Remaining Work, and Unspent Revenue / Forecasted Profit.
- Normalized Compare Project profitability rows to a consistent revenue baseline while preserving exact dollar values and cost-overrun extensions.
- Added a purpose-built individual-project financial composition graphic.
- Reordered the project table to prioritize actual cost, remaining work, forecasted profit, and margin.
- Preserved all calculation logic, Teamwork integration, filters, database schema, authentication, and reporting definitions.

## 0.7.39

- Moved **Project life** to the end of the Historical Revenue & Net Profit range controls.
- Reworked Logged vs Estimated Hours to use a shared 1:1 percentage scale across all rows.
- Positioned the 100% estimate marker proportionally within the scale and extended red overrun bars in direct proportion to the amount above estimate.
- Preserved the Compare Projects profitability graphic while documenting a future simplification direction rather than changing it in this release.

## 0.7.38

- Added a green profitability marker line to each Compare Projects revenue/cost row wherever forecast profit remains inside revenue.
- Added a black dashed revenue-threshold marker when forecast cost extends beyond allocated revenue.
- Extended the Compare Projects legend and tooltips so the new row markers are explained clearly.
- Preserved the Entire Project and By Operational Group compare tabs, row tooltips, and all existing profitability calculations.

## 0.7.37

- Renamed **Total Profitability** to **Forecasted Profitability**.
- Made **Forecasted Profitability** the default tab on the Dashboard and Combined Project Report.
- Reordered Dashboard profitability tabs to Forecasted Profitability, Historical Revenue & Net Profit, and Profitability by Operational Group.
- Preserved all calculations, filters, and Compare Project Report behavior.

## 0.7.36

- Added pointer-following and keyboard-accessible tooltips to the Compare Projects revenue and forecast-cost bars.
- Added detailed revenue, actual-cost, remaining-cost, forecast-cost, profit/loss, margin, project-status, and operational-group values to the tooltip.
- Removed the gray comparison-track background outside the allocated-revenue bar so unused space remains blank.
- Preserved all Dashboard, Combined Report, Compare tabs, and financial calculations.

## 0.7.35

- Removed the project-type selector from the Dashboard historical revenue and net-profit graph.
- Added solid-color fills beneath the cumulative gross-revenue and net-profit lines.
- Redesigned only the Compare Projects profitability report around horizontal project rows.
- Added **Entire Project** as the default compare view and **By Operational Group** as the detailed view.
- Preserved full project names and placed forecast profit or loss and margin at the right end of every row.
- Represented allocated revenue as the background bar, actual cost in orange, remaining cost in yellow, forecast profit as uncovered revenue, and cost above revenue as a red extension.
- Preserved the Combined Project Report and all underlying calculations.

## 0.7.34

- Rebuilt the historical Dashboard chart as a cumulative project-life financial timeline.
- Recognized total client fees as gross revenue on each project start date.
- Recognized completed-project net profit on each project end date using client fee minus final labor and expense costs.
- Added step-line rendering so project starts and completions create explicit cumulative changes.
- Corrected date controls to span full calendar windows and carry forward the opening cumulative balance.
- Preserved Dashboard filters, project-type filtering, and all Compare and Combined Report behavior.

## 0.7.33

- Rebuilt the Dashboard historical graph as a true project-life line chart.
- Added a default **Project life** range from the earliest selected project start or first activity through the latest project end or current date.
- Reconstructed cumulative actual cost from dated time entries and expenses while retaining snapshot/current totals as coverage floors.
- Removed area fills to keep gross revenue and net profit visually clear.

## 0.7.32

- Added a third Dashboard tab, **Historical Revenue & Net Profit**.
- Added a two-line historical chart where gross revenue is total known client fees and net profit to date is gross revenue minus known actual costs.
- Added project-type and historical-range controls while preserving the active Dashboard project filters.
- Reused the existing `project_snapshots` table and included the current calculated position as the latest point.
- Updated the nightly sync workflow to create or refresh the nightly project snapshot after calculations.
- Preserved Compare and Combined Report chart behavior.

## 0.7.31

- Changed only the Compare report profitability graphic; Dashboard and Combined Report profitability views were preserved.
- Added **Profitability by Operational Group and Project**, with one P1–P6 project position inside each operational-group cluster.
- Added a project-code legend, financial composition legend, missing-group placeholders, exact-value tooltips, keyboard support, and provisional-status context.
- Batched compare-mode operational-group metric loading into one database query before calculating each selected project separately.

## 0.7.30

- Anchored the expanded profitability charts to the top of their tiles for better use of vertical space.
- Refined profitability tabs, legend, labels, gridlines, card depth, and explanatory text for a more polished final presentation.
- Preserved all calculations, filters, tooltips, keyboard interactions, and the `NoReport`-only exclusion rule.

## 0.7.29

- Made **Profitability by Operational Group** the primary/default profitability tab.
- Reordered the profitability tabs so the group view comes first.
- Removed the visible tab-strip scrollbar for a cleaner profitability card header.

## 0.7.28

- Further widened the bars in **Total Profitability** for a stronger single combined presentation.
- Slightly widened the bars in **Profitability by Operational Group** while keeping the view uncluttered.
- Increased the top **Prologue Forecasting and Profitability** logo size.

## 0.7.27

- Widened the bars in **Total Profitability** so the single combined chart reads more clearly.
- Slightly widened the bars in **Profitability by Operational Group** while keeping the view uncluttered.
- Increased profitability tooltip size and type for easier reading.

## 0.7.26

- Made **Total Profitability** the default tab on dashboard and compare/combine profitability panels.
- Expanded the **Profitability by Operational Group** chart so it better fills the available tile height.
- Increased the size and spacing of the top brand, navigation, account info, and sign-out button for a less cramped header.

## 0.7.25

- Increased the over-estimate red bar scaling in Logged vs Estimated Hours by Group so larger overruns are visually more proportional.
- Expanded the Total Profitability tab layout so the single combined chart better fills the available tile height.

## 0.7.24

- Carried the Dashboard profitability and effort cleanup into Compare and Combine reports.
- Replaced the Compare financial graph with side-by-side client fee, actual cost, remaining cost, and forecast profit or loss markers.
- Added visible forecast profit and loss value pills to the Compare chart.
- Replaced Compare estimated-versus-logged bars with percent-to-estimate progress and overrun indicators.
- Added a cleaner margin and task-completion comparison component.
- Replaced Compare and Combine forecast-cost-at-completion labels with Remaining cost to complete.
- Added profitability tabs and the new hours-progress component to the Combined Project Report.
- Preserved the NoReport-only exclusion policy and all underlying calculations.

## 0.7.23

- Expanded the Dashboard layout so the page fills the browser window more effectively.
- Replaced the Dashboard forecast-cost KPI with Remaining cost to complete.
- Refined the Dashboard profitability chart with cleaner spacing, rounded bars, and visible profit or loss value pills.
- Simplified Dashboard profitability language to focus on actual cost to date, costed remaining work, and forecast profit or loss.
- Replaced the Dashboard effort summary with Logged vs Estimated Hours by Group, using percent-to-estimate progress and clear overrun indicators.
- Updated Dashboard help copy to match the new profitability and effort presentation.

## 0.7.22

- Added Dashboard tabs for Profitability by Operational Group and Total Profitability.
- Made both profitability views use the same filtered operational-group results.
- Added a combined portfolio profitability row without double-counting project counts across groups.
- Replaced the Dashboard profitability graphic with side-by-side allocated-revenue and forecast-cost bars.
- Split forecast cost into actual cost to date and costed remaining work when composition is available.
- Added green forecast-profit markers and red forecast-loss markers on the shared currency axis.
- Preserved pointer-following hover tooltips, keyboard focus, and Escape-to-close behavior.
- Updated Dashboard help and Step 9 verification for the new tabbed chart.
- Preserved all calculation rules and kept `NoReport` as the sole reporting-exclusion tag.

## 0.7.21

- Renamed the primary metric to Forecast cost at completion and added the explicit calculation formula to help text.
- Changed allocated revenue from a hidden backing fill to a visible navy outline around each positive bar.
- Changed forecast cost to amber, retained green forecast profit, and changed the below-zero cost mirror to pale amber.
- Added red loss caps for operational groups whose forecast cost exceeds allocated revenue.
- Added operational-group actual-cost and remaining-cost aggregation for explanatory hover tooltips.
- Expanded tooltips to show actual cost to date and costed remaining work beneath forecast cost at completion.
- Applied the terminology and visual changes to the Dashboard, Combined Project Report, and project-detail financial labels.
- Preserved all calculation rules and kept `NoReport` as the sole reporting-exclusion tag.

## 0.7.20

- Removed always-visible financial values from the operational-group profitability bars.
- Added a dark hover tooltip that follows the pointer while it remains over a bar.
- Included allocated revenue, included forecast cost, forecast profit or loss, cost deduction, margin, and project count in the tooltip.
- Added edge-aware tooltip placement so the pop-up flips and stays within the chart panel.
- Added keyboard focus support and Escape-to-close behavior for each operational-group bar.
- Applied the interaction to both the Dashboard and Combined Project Report.
- Preserved all calculations and kept `NoReport` as the sole reporting-exclusion tag.

## 0.7.19

- Rebuilt the operational-group profitability chart around a clean positive/negative currency axis.
- Added subtle gridlines and compact currency labels above and below the zero baseline.
- Changed stacked profitability columns to square, full-width segments.
- Simplified and reordered the profitability legend to match the approved visual reference.
- Replaced the multi-box chart explanation with a compact single-line note.
- Increased Key Takeaway heading and body text with safe wrapping for longer generated copy.
- Kept `NoReport` as the sole reporting-exclusion tag.

## 0.7.18

- Filled chart legend swatches and removed the legacy transparent swatch override.
- Aligned forecast-cost deduction columns with the inset cost/profit stack in the profitability bridge.
- Repositioned loss labels above revenue bars and improved their contrast.
- Improved profitability-card height usage and anchored its explanatory note.
- Added known-value coverage counts to Dashboard and combined-report financial KPIs.
- Corrected the Step 9 brand verifier to inspect the shared application shell.
- Updated Help guidance to match the current Dashboard scope controls.
- Reaffirmed `NoReport` as the sole reporting-exclusion tag.
- Added regression coverage for financial known-value counts.

## 0.7.17

- Rebuilt the Dashboard to match the approved compact executive-report reference.
- Changed the Dashboard title to Prologue Portfolio Dashboard.
- Changed combined-report and comparison titles to Combined Project Report and Compared Project Report.
- Replaced the large always-visible report-scope form with a compact Filters button and expandable filter panel.
- Added the full Prologue wordmark treatment to the application header while retaining Dashboard, Compare or Combine Projects, and Help navigation.
- Arranged the main report as profitability on the left with Health Summary and Effort Summary stacked on the right.
- Changed Dashboard effort reporting to operational-group rollups for consistency with combined reporting.
- Split Additional Data Views into three independently collapsible sections: Profit vs. Loss, KPI Breakdown and Group Summary, and Project Performance Details.
- Removed duplicate Dashboard attention and project-detail sections because project-level detail is now available in the collapsible Project Performance Details view.
- Applied the same executive report structure to combined-project reports.

## 0.7.16

- Removed the Dashboard hero action buttons for Compare or combine projects and Open filtered list.
- Renamed the primary Projects tab and Projects workspace heading to Compare or Combine Projects.
- Reframed the Dashboard summary area to match the combined-report visual system more closely.
- Increased padding and breathing room inside the Needs attention and Projects in this report fenced sections.
- Increased the inner spacing around attention cards and embedded reporting sections for a cleaner edge margin.
- Updated combined-report labels and section headings to align more closely with the requested executive report layout.

## 0.7.15

- Removed decorative squares from KPI titles and strengthened title/value hierarchy.
- Added click-only question-mark explanations to selected financial KPI tiles.
- Refined Health and Effort panel spacing, alignment, legends, and density.
- Reduced profitability-chart bar width and simplified the legend and explanatory footer.
- Added a closed-by-default More profitability analysis section.
- Added a diverging operational-group profit/loss chart.
- Added operational summary KPIs and a detailed revenue, cost, profit, and margin table.
- Added the same expandable analysis to Dashboard and combined-project reporting.

## 0.7.14

- Added overlapping project date-range filters to the Dashboard and Projects page.
- Replaced the generated mark with a cleaned transparent version of the supplied Prologue mosaic P image.
- Changed combined reporting to use the same aggregate portfolio structure as the Dashboard.
- Rolled selected-project task lists into Fieldwork, Mobilization, Modeling, Ready Set, DataHall, and Other.
- Added analytical operational-group revenue allocation using task-list target cost, estimated hours, or forecast cost in that precedence order.
- Reworked the profitability chart so revenue is the full bar, included cost and profit compose that bar, and a strong zero line separates the repeated visual cost deduction below.
- Added operational-group combined totals for revenue, cost, profit, margin, estimated hours, and logged hours.
- Refined Dashboard and Projects spacing, card hierarchy, filter density, and responsive presentation.
- Kept Compare limited to six projects and Combine unlimited.

## 0.7.13

- Merged project comparison and combination into the Projects workspace.
- Added unlimited project combination and retained the six-project comparison limit.
- Added combined portfolio KPIs, health, effort, and top-contributor reporting.
- Added a profitability bridge with a strong zero baseline and forecast costs plotted below zero as deductions.
- Removed Compare from primary navigation while preserving the legacy route as a redirect.
- Refined the geometric Prologue P mark and restored it to the application header.

## Step 9 v1.0.12 — Executive Ledger

- Rebuilt the Prologue geometric P as a tall, padded SVG matching the supplied original mark more closely.
- Removed the Prologue wordmark from the persistent top ribbon.
- Limited the top navigation to Dashboard, Projects, Compare, and Help.
- Added route-aware active-page highlighting with accessible `aria-current` state.
- Redesigned the login, public landing, and dashboard hero areas.
- Refined typography, spacing, focus states, tables, cards, surfaces, shadows, and responsive behavior across the application.
- Corrected visual hierarchy so the reporting workspace reads as a professional financial decision tool.
- No database, Teamwork sync, calculation, or authorization changes.

## 0.7.11 - Projects type-filter build recovery

- Restored the `getAvailableProjectTypes` import used by the Projects page.
- Added a regression assertion so the Projects page type facet cannot compile without its data helper.
- Preserved the Step 9 v1.0.10 report-scope redesign without database or calculation changes.

## 0.7.10 - Refined report scope and multi-project dashboard selection

- Replaced the dashboard keyword field with a dedicated Client dropdown.
- Retained Health and Status dropdowns as the broad portfolio scope controls.
- Removed dashboard Financial Status, Project Type, and Project Order controls.
- Added an optional searchable multi-project selector at the end of the report scope.
- Added removable selected-project chips and project results with client, status, and health context.
- Applied explicit project selections together with Client, Health, and Status to all dashboard KPIs, graphs, attention items, and project rows.
- Refined dashboard spacing, typography, input focus states, card density, responsive behavior, and visual hierarchy.
- Changed dashboard KPI cards to a more readable three-column desktop layout.
- Added tests and verification for client filtering and multi-project selection.

## 0.7.9 - Prologue branding, semantic health, financial colors, and type facets

- Added a cleaned faceted Prologue mark for the app icon, header, login, and portfolio title.
- Renamed the main dashboard title to **Prologue Forecasting and Profitability**.
- Renamed health distribution labels to Healthy, At risk, Unhealthy, and N/A while preserving the existing score thresholds.
- Added matching outlined color keys and color-linked bars to project and portfolio financial-position visuals.
- Added matching color accents to individual-project financial cards.
- Added Ready Set and DataHall as explicit type-filter choices.
- Treated Ready Set and DataHall projects as Scanning for type filtering while preserving their special type labels.
- Kept `NoReport` as the only reporting exclusion and added a visible filter-policy explanation.
- Added verification and tests for the cleaned app brand, semantic health labels, financial colors, Ready Set filtering, DataHall filtering, and Scanning inheritance.

## 0.7.8 - Step 9 executive dashboard and simplified navigation

- Replaced health band text in project pills with the exact health percentage while retaining the band color and accessible label.
- Turned the home dashboard into a filterable portfolio report using the same search, health, status, type, financial-coverage, and sort controls as the Projects page.
- Applied the selected project scope consistently to KPIs, graphs, attention cards, and the dashboard project table.
- Added filtered-scope counts and links that carry the active filters into the Projects page.
- Simplified the primary navigation to Dashboard, Projects, Compare, and Help.
- Added a Help and Administration page with usage instructions, metric explanations, Teamwork correction guidance, and role-specific links to Labor, Users, Calculations, and Teamwork.
- Added verification coverage for score-first health badges, dashboard filtering, simplified navigation, and the help center.

## 0.7.7 - Step 9 group cost performance and source-data evidence

- Replaced the operational-group cost composition graph with a target-versus-forecast performance bar using actual cost and costed remaining work.
- Kept operational-group reporting cost-based rather than inventing profit or margin without allocated group revenue.
- Made each operational group an explicit closed-by-default dropdown with a visible View tasks control.
- Preserved task search and coverage filters and automatically opens matching groups when filters are active.
- Added expandable evidence to project data-quality issues.
- Lists the actual project-only time entries behind UNALLOCATED_PROJECT_TIME, including user, date, description, hours, and historical labor cost.
- Lists affected time entries for historical-cost coverage issues and task-specific issues.
- Lists task lists missing current target-cost budgets.
- Added direct Teamwork correction links for project time, task, and finance areas.

## 0.7.6 - Step 9 operational accordions, reporting graphs, and expense expectation refinement

- Nested calculated task branches inside their operational group or DataHall area using searchable, filterable disclosure panels.
- Added portfolio graphs for known financial position, project health distribution, and planned-versus-logged hours.
- Added project graphs for budget/cost/profit, group hours, and group cost composition.
- Added comparison graphs for financials, hours, margin ceilings, and task completion.
- Clarified provisional results as known actual costs plus currently costed remaining work.
- Stopped treating every Modeling-tagged project as expense-incomplete when no Teamwork expenses exist.
- Now expects an expense only when an outsourced-cost task exists or an imported expense row is incomplete.
- Bumped calculation output to `step7-v1.0.7`.

## 0.7.5 - Step 9 unplanned-work review and job-role forecast costs

- Reclassified logged time on top-level tasks without estimates as reviewable unplanned actual work rather than a calculation error.
- Exempted subtasks from missing-estimate flags.
- Added Admin-only per-task review/dismiss and project-level dismiss-all actions without requiring notes.
- Persisted reviewed state across recalculations and automatically reopened an item when additional unplanned time is logged.
- Added separate unplanned hours and historical labor cost details while keeping both in actual project totals.
- Suppressed assignment warnings for completed branches and branches with no remaining estimated work.
- Imported Teamwork job-role cost rates and used them for role-only remaining-work forecasts.
- Preserved individual-assignee precedence over job roles and equal allocation across multiple selected assignees.
- Kept all raw employee and job-role rates server-side and out of reporting responses.
- Added the `job_roles` and `unplanned_work_reviews` database tables and Step 9 migration.
- Bumped calculation output to `step7-v1.0.6`.

## 0.7.4 - Step 9 reporting tag policy and DataHall rollups

- Replaced the former `Ready Set` exclusion with a single `NoReport` exclusion rule.
- Included `Ready Set` projects in reporting.
- Added normalized `DataHall` project recognition and project typing.
- Classified each non-administrative DataHall task list as its own area/mobilization group.
- Grouped clearly administrative DataHall task lists under `Other / Administrative`.
- Preserved archived projects in dashboards unless they have `NoReport`.
- Added archived badges and DataHall-specific labels to the reporting pages.
- Made Step 9 setup run a full Teamwork synchronization before financial refresh and calculation.
- Added runtime verification for `NoReport`, `Ready Set`, `DataHall`, and archived-project behavior.
- Bumped calculation output to `step7-v1.0.5`.

## 0.7.3 - Step 9 expense-unit reconciliation

- Converted Teamwork budget-expense monetary values from minor units into currency units.
- Preserved legacy expense endpoint decimal values without rescaling.
- Added source-aware expense deduplication and normalization metadata.
- Linked expenses to task lists by direct relationship or exact project/task-list name.
- Classified expenses as outsourced modeling through their linked outsourced task list.
- Split internal labor and expenses in project reporting.
- Added a project expense reconciliation table and actual profit/margin-to-date display.
- Added regression tests for the $3,525 Jackson Hole expense total.
- Bumped calculation output to `step7-v1.0.4`.

## 0.7.2 - Step 9 financial reconciliation

- Converted Teamwork budget monetary fields from minor units into currency units.
- Added a regression test for the Jackson Hole budget scale example.
- Bumped the calculation version to `step7-v1.0.3`.
- Changed provisional financial labels to known cost/profit and margin ceiling.
- Clarified task completion versus health score.
- Added explicit unresolved-assignment labeling on task rows.
- Made Step 9 setup refresh financial sources and calculations before verification.

## 0.7.1 - Step 9 runtime date normalization

- Normalized PostgreSQL timestamp values at the reporting data boundary before dashboard sorting.
- Added the same normalization for task completion and data-quality timestamps.
- Improved date formatting for both date-only and full timestamp strings.
- Added regression tests for serialized PostgreSQL timestamps.

## 0.6.0 - Step 8

- Added Teamwork employee OAuth sign-in without storing employee access tokens.
- Added hashed, revocable, 12-hour PostgreSQL sessions.
- Added Viewer, Manager, and Admin authorization with secure DAL checks.
- Added automatic internal-employee provisioning and administrator bootstrap.
- Added Admin user-role management and audit logging.
- Protected calculation, Teamwork, and database administration routes and APIs.
- Added Step 8 setup and verification commands.

## 0.5.2 - Step 7 large-percentage correction

- Expanded estimate-consumption storage from `numeric(9,4)` to `numeric(18,4)` in current metrics and project snapshots.
- Added a forward migration for databases where Step 7 v1.0.1 already created the calculation tables.
- Added a regression assertion for projects whose logged time is many times larger than their canonical estimate.
- Updated the calculation version to `step7-v1.0.2`.

## 0.5.1 - Step 7 validation correction

- Fixed strict TypeScript handling for optional non-labor expense totals.
- Corrected the Teamwork reset helper to use Drizzle transaction execution.
- Removed an unused operational-group calculation variable.
- Made `npm run step7:run` apply pending database migrations before calculation.
- Clarified that the optional Teamwork financial refresh may continue with a warning.

## 0.5.0 — Step 7

- Added canonical parent/subtask estimate calculations.
- Added task assignment normalization and equal user allocation.
- Added project, task, and operational-group current metric tables.
- Added optional Teamwork financial-source enrichment.
- Added projected and actual labor calculations.
- Added outsourced-modeling forecast calculations with effective-dated rates.
- Added project forecast cost, profit, margin, coverage, and provisional status.
- Added transparent data-quality issue generation.
- Added weighted project health scoring and red overrides.
- Added nightly snapshot materialization.
- Added `step7:run` and `step7:verify` commands.
- Added calculation administration and status endpoints.

## 0.4.0 — Step 6 Clean Restart

- Rebuilt the Teamwork import into controlled phases.
- Added inferred task and time-entry relationships.
- Added import verification and grouped warning diagnostics.
