"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { PortfolioOperationalGroupRow } from "@/lib/reporting/dashboard-data";

export type ComparedProfitabilityPosition = {
  allocatedRevenue: number | null;
  actualCostToDate: number | null;
  remainingCost: number | null;
  forecastCost: number | null;
  forecastProfit: number | null;
  marginPercent: number | null;
};

export type ComparedProjectOperationalGroups = {
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  isProvisional: boolean;
  total: ComparedProfitabilityPosition;
  groups: PortfolioOperationalGroupRow[];
};

type ComparisonMode = "project" | "groups";
type ComparisonSort = "attention" | "margin" | "profit" | "name";

type DisplayPosition = ComparedProfitabilityPosition & {
  project: ComparedProjectOperationalGroups;
  groupName?: PortfolioOperationalGroupRow["groupName"];
  isMissing?: boolean;
};

type ResolvedPosition = {
  allocatedRevenue: number;
  actualCostToDate: number;
  remainingCost: number;
  forecastCost: number;
  forecastProfit: number;
  marginPercent: number;
};

const groupOrder: PortfolioOperationalGroupRow["groupName"][] = [
  "Fieldwork",
  "Mobilization",
  "Modeling",
  "Ready Set",
  "DataHall",
  "Other",
];

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonnegative(value: number | null | undefined): number | null {
  return finite(value) ? Math.max(value, 0) : null;
}

function fullCurrency(value: number | null | undefined): string {
  if (!finite(value)) return "Missing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMargin(value: number | null | undefined): string {
  if (!finite(value)) return "—";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function resolvePosition(position: ComparedProfitabilityPosition): ResolvedPosition {
  const revenue = nonnegative(position.allocatedRevenue) ?? 0;
  const actual = nonnegative(position.actualCostToDate) ?? 0;
  const explicitRemaining = nonnegative(position.remainingCost);
  const explicitForecastCost = nonnegative(position.forecastCost);
  const remaining = explicitRemaining ?? Math.max((explicitForecastCost ?? actual) - actual, 0);
  const forecastCost = explicitForecastCost ?? actual + remaining;
  const forecastProfit = finite(position.forecastProfit)
    ? position.forecastProfit
    : revenue - forecastCost;
  const marginPercent = finite(position.marginPercent)
    ? position.marginPercent
    : revenue > 0
      ? (forecastProfit / revenue) * 100
      : 0;

  return {
    allocatedRevenue: revenue,
    actualCostToDate: actual,
    remainingCost: remaining,
    forecastCost,
    forecastProfit,
    marginPercent,
  };
}


function compareProjects(
  left: ComparedProjectOperationalGroups,
  right: ComparedProjectOperationalGroups,
  sort: ComparisonSort,
): number {
  const a = resolvePosition(left.total);
  const b = resolvePosition(right.total);
  if (sort === "name") return left.projectName.localeCompare(right.projectName);
  if (sort === "profit") return b.forecastProfit - a.forecastProfit;
  if (sort === "margin") return b.marginPercent - a.marginPercent;

  const aLoss = a.forecastProfit < 0 ? 1 : 0;
  const bLoss = b.forecastProfit < 0 ? 1 : 0;
  if (aLoss !== bLoss) return bLoss - aLoss;
  if (a.marginPercent !== b.marginPercent) return a.marginPercent - b.marginPercent;
  return a.forecastProfit - b.forecastProfit;
}

function performanceStatus(position: ResolvedPosition): { label: string; tone: "good" | "watch" | "loss" } {
  if (position.forecastProfit < 0) return { label: "Over budget", tone: "loss" };
  if (position.marginPercent < 10) return { label: "Low margin", tone: "watch" };
  if (position.allocatedRevenue > 0 && position.remainingCost / position.allocatedRevenue > 0.35) {
    return { label: "Work remaining", tone: "watch" };
  }
  return { label: "On track", tone: "good" };
}

function positionForGroup(
  project: ComparedProjectOperationalGroups,
  groupName: PortfolioOperationalGroupRow["groupName"],
): DisplayPosition {
  const group = project.groups.find((row) => row.groupName === groupName);
  if (!group) {
    return {
      project,
      groupName,
      allocatedRevenue: null,
      actualCostToDate: null,
      remainingCost: null,
      forecastCost: null,
      forecastProfit: null,
      marginPercent: null,
      isMissing: true,
    };
  }
  return {
    project,
    groupName,
    allocatedRevenue: group.allocatedRevenue,
    actualCostToDate: group.actualCostToDate,
    remainingCost: group.remainingCost,
    forecastCost: group.forecastCost,
    forecastProfit: group.forecastProfit,
    marginPercent: group.marginPercent,
  };
}

function rowAriaLabel(row: DisplayPosition): string {
  if (row.isMissing) {
    return `${row.project.projectName}. ${row.groupName}. No allocated work in this operational group.`;
  }
  const position = resolvePosition(row);
  return [
    row.project.projectName,
    row.groupName ? `${row.groupName}.` : "Entire project.",
    `Allocated revenue ${fullCurrency(position.allocatedRevenue)}.`,
    `Actual cost to date ${fullCurrency(position.actualCostToDate)}.`,
    `Costed remaining work ${fullCurrency(position.remainingCost)}.`,
    `${position.forecastProfit < 0 ? "Forecast loss" : "Forecast profit"} ${fullCurrency(position.forecastProfit)}.`,
    `Margin ${formatMargin(position.marginPercent)}.`,
  ].join(" ");
}

function ComparisonRow({ row, maximumOverrunRatio }: { row: DisplayPosition; maximumOverrunRatio: number }) {
  const tooltipId = useId();
  const barCellRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  if (row.isMissing) {
    return (
      <div className="compare-profitability-rows__row compare-profitability-rows__row--missing" role="img" aria-label={rowAriaLabel(row)}>
        <div className="compare-profitability-rows__project">
          <strong>{row.project.projectName}</strong>
          {row.project.projectNumber ? <small>{row.project.projectNumber}</small> : null}
        </div>
        <div className="compare-profitability-rows__missing-track">No work allocated to this group</div>
        <div className="compare-profitability-rows__outcome"><strong>—</strong><small>Forecast profit</small></div>
        <div className="compare-profitability-rows__margin"><strong>—</strong><small>Margin</small></div>
      </div>
    );
  }

  const position = resolvePosition(row);
  const positionTooltip = (clientX: number, clientY: number) => {
    const container = barCellRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const pointerX = clientX - bounds.left;
    const pointerY = clientY - bounds.top;
    const tooltipWidth = Math.min(356, Math.max(bounds.width - 16, 0));
    const tooltipHeight = Math.min(286, Math.max(bounds.height + 220, 0));
    const pointerGap = 14;
    let x = pointerX + pointerGap;
    let y = pointerY + pointerGap;

    if (x + tooltipWidth > bounds.width - 8) x = pointerX - tooltipWidth - pointerGap;
    if (y + tooltipHeight > bounds.height + 230) y = pointerY - tooltipHeight - pointerGap;

    x = Math.max(8, Math.min(x, Math.max(bounds.width - tooltipWidth - 8, 8)));
    y = Math.max(-220, Math.min(y, Math.max(bounds.height - 8, 8)));
    setTooltip({ x, y });
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    positionTooltip(event.clientX, event.clientY);
  };
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    positionTooltip(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  };
  const revenueBoundary = 82;
  const revenue = position.allocatedRevenue;
  const actualRatio = revenue > 0 ? position.actualCostToDate / revenue : 0;
  const remainingRatio = revenue > 0 ? position.remainingCost / revenue : 0;
  const forecastRatio = revenue > 0 ? position.forecastCost / revenue : 0;
  const actualInsideRatio = Math.min(Math.max(actualRatio, 0), 1);
  const remainingInsideRatio = Math.min(
    Math.max(remainingRatio, 0),
    Math.max(1 - actualInsideRatio, 0),
  );
  const loss = Math.max(position.forecastCost - revenue, 0);
  const profit = Math.max(revenue - position.forecastCost, 0);
  const profitRatio = revenue > 0 ? profit / revenue : 0;
  const overrunRatio = revenue > 0 ? loss / revenue : loss > 0 ? maximumOverrunRatio : 0;
  const overrunWidth = maximumOverrunRatio > 0
    ? Math.min((overrunRatio / maximumOverrunRatio) * (100 - revenueBoundary), 100 - revenueBoundary)
    : 0;
  const style = {
    "--compare-actual-width": `${actualInsideRatio * revenueBoundary}%`,
    "--compare-remaining-left": `${actualInsideRatio * revenueBoundary}%`,
    "--compare-remaining-width": `${remainingInsideRatio * revenueBoundary}%`,
    "--compare-profit-left": `${Math.min(Math.max(forecastRatio, 0), 1) * revenueBoundary}%`,
    "--compare-profit-width": `${Math.max(profitRatio, 0) * revenueBoundary}%`,
    "--compare-loss-left": `${revenueBoundary}%`,
    "--compare-loss-width": `${overrunWidth}%`,
  } as CSSProperties;
  const outcomeTone = position.forecastProfit < 0 ? "loss" : "profit";
  const status = performanceStatus(position);

  return (
    <div className="compare-profitability-rows__row">
      <div className="compare-profitability-rows__project">
        <div className="compare-profitability-rows__project-heading">
          <strong>{row.project.projectName}</strong>
          <span className={`compare-profitability-rows__status compare-profitability-rows__status--${status.tone}`}>{status.label}</span>
        </div>
        <small>
          {row.project.projectNumber ? `${row.project.projectNumber} · ` : ""}
          {row.project.isProvisional ? "Provisional" : "Complete"}
        </small>
      </div>

      <div className="compare-profitability-rows__bar-cell" ref={barCellRef}>
        <div
          className="compare-profitability-rows__track"
          style={style}
          role="img"
          tabIndex={0}
          aria-label={rowAriaLabel(row)}
          aria-describedby={tooltip ? tooltipId : undefined}
          onPointerEnter={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setTooltip(null)}
          onFocus={handleFocus}
          onBlur={() => setTooltip(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTooltip(null);
          }}
        >
          <span className="compare-profitability-rows__actual" />
          {remainingInsideRatio > 0 ? <span className="compare-profitability-rows__remaining" /> : null}
          {profit > 0 ? <span className="compare-profitability-rows__profit" /> : null}
          {loss > 0 ? <span className="compare-profitability-rows__loss" /> : null}
        </div>
        <div className="compare-profitability-rows__bar-meta">
          <span><small>Actual cost</small><strong>{fullCurrency(position.actualCostToDate)}</strong></span>
          <span><small>Remaining work</small><strong>{fullCurrency(position.remainingCost)}</strong></span>
          <span>
            <small>{loss > 0 ? "Cost above revenue" : "Unspent revenue"}</small>
            <strong>{fullCurrency(loss > 0 ? loss : profit)}</strong>
          </span>
        </div>
        {tooltip ? (
          <div
            className="compare-profitability-rows__tooltip"
            id={tooltipId}
            role="tooltip"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className="compare-profitability-rows__tooltip-header">
              <strong>{row.project.projectName}</strong>
              <span>
                {row.groupName ?? "Entire project"}
                {row.project.projectNumber ? ` · ${row.project.projectNumber}` : ""}
              </span>
            </div>
            <dl>
              <div>
                <dt><i className="compare-profitability-rows__tooltip-key compare-profitability-rows__tooltip-key--revenue" />Allocated revenue</dt>
                <dd>{fullCurrency(position.allocatedRevenue)}</dd>
              </div>
              <div>
                <dt><i className="compare-profitability-rows__tooltip-key compare-profitability-rows__tooltip-key--actual" />Actual cost to date</dt>
                <dd>{fullCurrency(position.actualCostToDate)}</dd>
              </div>
              <div>
                <dt><i className="compare-profitability-rows__tooltip-key compare-profitability-rows__tooltip-key--remaining" />Costed remaining work</dt>
                <dd>{fullCurrency(position.remainingCost)}</dd>
              </div>
              <div className="compare-profitability-rows__tooltip-total">
                <dt><i className={`compare-profitability-rows__tooltip-key ${position.forecastProfit < 0 ? "compare-profitability-rows__tooltip-key--loss" : "compare-profitability-rows__tooltip-key--profit"}`} />{position.forecastProfit < 0 ? "Cost above revenue" : "Unspent revenue / forecast profit"}</dt>
                <dd>{fullCurrency(position.forecastProfit < 0 ? Math.abs(position.forecastProfit) : position.forecastProfit)}</dd>
              </div>
            </dl>
            <div className="compare-profitability-rows__tooltip-footer">
              <span>{formatMargin(position.marginPercent)} margin</span>
              <span>{row.project.isProvisional ? "Provisional" : "Complete"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`compare-profitability-rows__outcome compare-profitability-rows__outcome--${outcomeTone}`}>
        <strong>{fullCurrency(position.forecastProfit)}</strong>
        <small>{position.forecastProfit < 0 ? "Forecast loss" : "Forecast profit"}</small>
      </div>

      <div className={`compare-profitability-rows__margin compare-profitability-rows__margin--${outcomeTone}`}>
        <strong>{formatMargin(position.marginPercent)}</strong>
        <small>Margin</small>
      </div>
    </div>
  );
}

export function CompareOperationalProfitabilityChart({
  projects,
  emptyMessage = "No profitability data is available for the selected projects.",
}: {
  projects: ComparedProjectOperationalGroups[];
  emptyMessage?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<ComparisonMode>("project");
  const [sort, setSort] = useState<ComparisonSort>("attention");
  const tabs: Array<{ id: ComparisonMode; label: string }> = [
    { id: "project", label: "Entire Project" },
    { id: "groups", label: "By Operational Group" },
  ];
  const activeIndex = tabs.findIndex((tab) => tab.id === mode);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = (activeIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === activeIndex) return;
    event.preventDefault();
    setMode(tabs[nextIndex].id);
    requestAnimationFrame(() => document.getElementById(`${id}-${tabs[nextIndex].id}-tab`)?.focus());
  };

  if (!projects.length) return <div className="chart-empty">{emptyMessage}</div>;

  const orderedProjects = [...projects].sort((left, right) => compareProjects(left, right, sort));
  const availableGroups = groupOrder.filter((groupName) =>
    projects.some((project) => project.groups.some((group) => group.groupName === groupName)),
  );
  const sections: Array<{ key: string; title: string; rows: DisplayPosition[] }> = mode === "project"
    ? [{
        key: "entire-project",
        title: "Entire Project",
        rows: orderedProjects.map((project) => ({ project, ...project.total })),
      }]
    : availableGroups.map((groupName) => ({
        key: groupName,
        title: groupName,
        rows: orderedProjects.map((project) => positionForGroup(project, groupName)),
      }));
  const maximumOverrunRatio = Math.max(
    1,
    ...sections.flatMap((section) => section.rows.map((row) => {
      if (row.isMissing) return 0;
      const position = resolvePosition(row);
      if (position.allocatedRevenue <= 0) return position.forecastCost > 0 ? 1 : 0;
      return Math.max(position.forecastCost / position.allocatedRevenue - 1, 0);
    })),
  );

  return (
    <div className="compare-profitability-rows">
      <div className="compare-profitability-rows__toolbar">
        <div className="compare-profitability-rows__tabs" role="tablist" aria-label="Project profitability comparison views">
          {tabs.map((tab) => {
            const selected = tab.id === mode;
            return (
              <button
                key={tab.id}
                id={`${id}-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-${tab.id}-panel`}
                tabIndex={selected ? 0 : -1}
                className={selected ? "compare-profitability-rows__tab compare-profitability-rows__tab--active" : "compare-profitability-rows__tab"}
                onClick={() => setMode(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="compare-profitability-rows__sort">
          <span>Order</span>
          <select value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as ComparisonSort)}>
            <option value="attention">Attention first</option>
            <option value="margin">Highest margin</option>
            <option value="profit">Highest profit</option>
            <option value="name">Project name</option>
          </select>
        </label>
      </div>

      <p className="compare-profitability-rows__description">
        {mode === "project"
          ? "Compare each selected project as a whole. Switch to the operational-group view for a more detailed breakdown."
          : "Each operational group contains one horizontal row for every selected project, with the full project name retained."}
      </p>

      <div className="chart-legend compare-profitability-rows__legend" aria-hidden="true">
        <span><i className="compare-profitability-rows__legend-key compare-profitability-rows__legend-key--actual" />Actual cost to date</span>
        <span><i className="compare-profitability-rows__legend-key compare-profitability-rows__legend-key--remaining" />Costed remaining work</span>
        <span><i className="compare-profitability-rows__legend-key compare-profitability-rows__legend-key--profit" />Unspent revenue / forecast profit</span>
        <span><i className="compare-profitability-rows__legend-key compare-profitability-rows__legend-key--loss" />Cost above revenue</span>
      </div>

      <div
        id={`${id}-${mode}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}-tab`}
        className="compare-profitability-rows__panel"
      >
        {sections.map((section) => {
          const sectionBody = (
            <>
              <div className="compare-profitability-rows__column-headings" aria-hidden="true">
                <span>Project</span>
                <span>Cost composition against revenue</span>
                <span>Forecast profit</span>
                <span>Margin</span>
              </div>
              <div className="compare-profitability-rows__rows">
                {section.rows.map((row) => (
                  <ComparisonRow
                    key={`${section.key}-${row.project.projectId}`}
                    row={row}
                    maximumOverrunRatio={maximumOverrunRatio}
                  />
                ))}
              </div>
            </>
          );

          return mode === "groups" ? (
            <details className="compare-profitability-rows__section compare-profitability-rows__section--collapsible" key={section.key} open>
              <summary className="compare-profitability-rows__section-heading compare-profitability-rows__section-summary">
                <span className="compare-profitability-rows__section-title">
                  <i className="compare-profitability-rows__section-chevron" aria-hidden="true" />
                  <strong>{section.title}</strong>
                </span>
                <span>{section.rows.length} project{section.rows.length === 1 ? "" : "s"}</span>
              </summary>
              {sectionBody}
            </details>
          ) : (
            <section className="compare-profitability-rows__section" key={section.key}>
              <div className="compare-profitability-rows__section-heading">
                <h4>{section.title}</h4>
                <span>{section.rows.length} project{section.rows.length === 1 ? "" : "s"}</span>
              </div>
              {sectionBody}
            </section>
          );
        })}
      </div>

      <p className="compare-profitability-rows__note">
        Each row uses allocated revenue as its 100% comparison baseline. Orange is actual cost to date, yellow is costed remaining work, light blue is unspent revenue / forecast profit, and red extends beyond revenue when forecast cost is over budget.
      </p>
    </div>
  );
}
