"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { HistoricalProfitSeries } from "@/components/historical-profit-chart-types";
import { HistoricalRevenueProfitChart } from "@/components/historical-revenue-profit-chart";
import type { ProfitabilityRow } from "@/components/profitability-chart-types";
import { PortfolioFinancialComposition } from "@/components/portfolio-financial-composition";

type ProfitabilityView = "groups" | "total" | "history";

type ProfitabilityViewDefinition = {
  id: ProfitabilityView;
  label: string;
  description: string;
};

const forecastView: ProfitabilityViewDefinition = {
  id: "total",
  label: "Forecasted Profitability",
  description:
    "View the combined financial position of every operational group in the filtered portfolio with the same revenue, cost-to-date, remaining-cost, and profit structure.",
};

const historicalView: ProfitabilityViewDefinition = {
  id: "history",
  label: "Historical Revenue & Net Profit",
  description:
    "Track gross revenue, source-dated actual cost, anticipated cost, net profit to date, and forecasted net profit over time. Dashboard filters define the portfolio, and the calendar controls adjust the visible historical range.",
};

const groupView: ProfitabilityViewDefinition = {
  id: "groups",
  label: "Profitability by Operational Group",
  description:
    "Compare allocated revenue, actual cost to date, costed remaining work, and forecast profit or loss across operational groups.",
};

export function DashboardProfitabilityTabs({
  groupRows,
  totalRow,
  historicalSeries,
  groupDescription,
  totalDescription,
  historicalDescription,
  historicalInitialRange,
  filterControls,
}: {
  groupRows: ProfitabilityRow[];
  totalRow: ProfitabilityRow | null;
  historicalSeries?: HistoricalProfitSeries[];
  groupDescription?: string;
  totalDescription?: string;
  historicalDescription?: string;
  historicalInitialRange?: { from?: string; to?: string };
  filterControls?: ReactNode;
}) {
  const id = useId();
  const [activeView, setActiveView] = useState<ProfitabilityView>("total");
  const configuredViews = [
    {
      ...forecastView,
      description: totalDescription ?? forecastView.description,
    },
    ...(historicalSeries !== undefined
      ? [{ ...historicalView, description: historicalDescription ?? historicalView.description }]
      : []),
    {
      ...groupView,
      description: groupDescription ?? groupView.description,
    },
  ];
  const active = configuredViews.find((view) => view.id === activeView) ?? configuredViews[0];
  const activeIndex = configuredViews.findIndex((view) => view.id === active.id);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % configuredViews.length;
    if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + configuredViews.length) % configuredViews.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = configuredViews.length - 1;
    if (nextIndex === activeIndex) return;
    event.preventDefault();
    setActiveView(configuredViews[nextIndex].id);
    requestAnimationFrame(() => {
      document.getElementById(`${id}-${configuredViews[nextIndex].id}-tab`)?.focus();
    });
  };

  return (
    <article className={`chart-panel executive-report-grid__profitability dashboard-profitability-tabs dashboard-profitability-tabs--${active.id}`}>
      <div
        className="dashboard-profitability-tabs__list"
        role="tablist"
        aria-label="Profitability chart views"
      >
        {configuredViews.map((view) => {
          const selected = view.id === active.id;
          return (
            <button
              key={view.id}
              id={`${id}-${view.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-${view.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`dashboard-profitability-tabs__tab${selected ? " dashboard-profitability-tabs__tab--active" : ""}`}
              onClick={() => setActiveView(view.id)}
              onKeyDown={handleTabKeyDown}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      {filterControls ? (
        <div className="dashboard-profitability-tabs__filters">{filterControls}</div>
      ) : null}

      <p className="dashboard-profitability-tabs__description">{active.description}</p>

      {configuredViews.map((view) => (
        <div
          key={view.id}
          id={`${id}-${view.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${view.id}-tab`}
          className="dashboard-profitability-tabs__panel"
          hidden={active.id !== view.id}
        >
          {view.id === "groups" ? (
            <PortfolioFinancialComposition rows={groupRows} variant="groups" />
          ) : view.id === "total" ? (
            totalRow ? (
              <PortfolioFinancialComposition rows={[totalRow]} variant="total" />
            ) : (
              <div className="chart-empty">No complete portfolio financial position is available.</div>
            )
          ) : historicalSeries !== undefined ? (
            <HistoricalRevenueProfitChart series={historicalSeries} initialDateRange={historicalInitialRange} />
          ) : (
            <div className="chart-empty">No historical portfolio data is available.</div>
          )}
        </div>
      ))}
    </article>
  );
}
