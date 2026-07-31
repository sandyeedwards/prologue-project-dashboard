# Step 10 v1.1.15 Completion Checklist

## Automated checks

- [ ] `npm ci --no-audit --no-fund`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run db:check`
- [ ] `npm run step9:refresh-calculations`
- [ ] `npm run step7:verify` — confirm `actualCostReconcilesToDatedSourceRecords: true` and review partial coverage details
- [ ] `npm run step8:verify`
- [ ] `npm run step10:verify`

## Dashboard

- [ ] Primary financial KPIs match v1.0.39 values.
- [ ] Filters update all Dashboard views consistently.
- [ ] Forecasted Profitability, Historical Revenue & Net Profit, and Operational Group tabs work.
- [ ] One-project, multi-project, and empty portfolios render correctly.
- [ ] Historical range controls display the correct period.
- [ ] Two-click historical zoom selects the first boundary, previews the band while moving, and applies the range on the second click.
- [ ] A chart-created zoom activates the Custom range and preserves the selected From/Through dates.
- [ ] Clicking Custom without a saved range requires both dates and rejects an end date earlier than the start.
- [ ] Escape cancels an unfinished two-click range selection.
- [ ] Historical Actual Cost to Date equals the source-dated labor-plus-expense total for the same filtered portfolio.
- [ ] Historical Net Profit equals Gross Revenue minus Actual Cost to Date at every inspected point.
- [ ] Active-project time and expenses appear before project completion.
- [ ] A past planned end date does not increment the completed-project count without an actual completed/archived timestamp.
- [ ] Historical tooltip reports partial/missing source-cost coverage and fallback-dated expenses when present.

## Projects workspace

- [ ] Search, client, health, status, type, and date filters work.
- [ ] Project table actual cost, remaining work, profit, and margin match project detail.
- [ ] Selection remains intact when filters are applied.
- [ ] Compare allows no more than six projects.
- [ ] Combine accepts the intended number of projects.

## Compare and Combine

- [ ] Entire Project compare rows use a consistent revenue baseline.
- [ ] Operational Group compare retains all project names and groups.
- [ ] Profitable projects show the forecast-cost boundary.
- [ ] Over-budget projects show the revenue threshold and red overrun extension.
- [ ] Tooltips show exact values.
- [ ] Combined totals match the sum of selected projects.

## Individual project

- [ ] Financial composition matches the underlying fee, actual cost, forecast cost, and profit.
- [ ] Provisional messaging remains accurate.
- [ ] Effort and cost charts remain consistent with task/group tables.
- [ ] Expenses, coverage, issues, and task filters work.

## Responsive and accessibility

- [ ] 1600 px desktop
- [ ] 1280 px desktop
- [ ] 1024 px tablet
- [ ] 390 px mobile
- [ ] Keyboard navigation for tabs, filters, tooltips, and accordions
- [ ] No clipped labels, overlapping content, or unreadable charts
- [ ] Empty, loading, not-found, and error states display correctly
