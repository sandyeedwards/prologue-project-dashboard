import { easternIsoDate } from "@/lib/reporting/format";

export type PipelineDealInput = {
  id: string;
  properties?: Record<string, unknown>;
};

export type PipelineDefinition = {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string; displayOrder: number }>;
};

export type PipelineDeal = {
  id: string;
  name: string;
  stage: string;
  /** Null when HubSpot has no amount: shown as missing, never as $0. */
  amount: number | null;
  closeDate: string | null;
};

export type PipelineStageSummary = {
  label: string;
  count: number;
  /** Sum of the deals that have an amount. */
  amount: number;
  unpriced: number;
};

export type PipelineSummary = {
  id: string;
  label: string;
  openCount: number;
  amount: number;
  unpriced: number;
  stages: PipelineStageSummary[];
  /** Open deals expected to close in the next 30 days. */
  closingSoon: PipelineDeal[];
  /** Open deals whose expected close date has passed: need a new date or an outcome. */
  pastClose: PipelineDeal[];
  closingSoonCount: number;
  pastCloseCount: number;
  /** Open deals with no expected close date. */
  undated: number;
};

const LIST_LIMIT = 12;

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function amountValue(value: unknown): number | null {
  const raw = textValue(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** HubSpot close dates arrive as UTC midnight for a plain day, or as a timestamp. */
export function closeDateValue(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return null;
  if (/T00:00:00(\.0+)?Z$/.test(raw)) return raw.slice(0, 10);
  return easternIsoDate(parsed);
}

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function summarizePipelines(
  deals: readonly PipelineDealInput[],
  pipelines: readonly PipelineDefinition[],
  today: string,
): PipelineSummary[] {
  const soonEnd = plusDays(today, 30);
  const byPipeline = new Map<string, PipelineDealInput[]>();
  for (const deal of deals) {
    const key = textValue(deal.properties?.pipeline) || "unknown";
    byPipeline.set(key, [...(byPipeline.get(key) ?? []), deal]);
  }
  const definitions = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]));
  return [...byPipeline.entries()]
    .map(([pipelineId, rows]) => {
      const definition = definitions.get(pipelineId);
      const stageOrder = new Map(
        (definition?.stages ?? []).map((stage) => [stage.id, stage] as const),
      );
      const parsed = rows.map((deal) => {
        const stageId = textValue(deal.properties?.dealstage);
        return {
          stageId,
          deal: {
            id: deal.id,
            name: textValue(deal.properties?.dealname) || "Unnamed deal",
            stage: stageOrder.get(stageId)?.label ?? (stageId || "No stage"),
            amount: amountValue(deal.properties?.amount),
            closeDate: closeDateValue(deal.properties?.closedate),
          } satisfies PipelineDeal,
        };
      });
      const stages = new Map<string, PipelineStageSummary & { order: number }>();
      for (const { stageId, deal } of parsed) {
        const current = stages.get(stageId) ?? {
          label: deal.stage,
          count: 0,
          amount: 0,
          unpriced: 0,
          order: stageOrder.get(stageId)?.displayOrder ?? Number.MAX_SAFE_INTEGER,
        };
        current.count += 1;
        if (deal.amount === null) current.unpriced += 1;
        else current.amount += deal.amount;
        stages.set(stageId, current);
      }
      const all = parsed.map((row) => row.deal);
      const byClose = (a: PipelineDeal, b: PipelineDeal) =>
        (a.closeDate ?? "").localeCompare(b.closeDate ?? "") || a.name.localeCompare(b.name);
      const soon = all.filter(
        (deal) => deal.closeDate && deal.closeDate >= today && deal.closeDate <= soonEnd,
      );
      const past = all.filter((deal) => deal.closeDate && deal.closeDate < today);
      return {
        id: pipelineId,
        label: definition?.label ?? "Unknown pipeline",
        openCount: all.length,
        amount: all.reduce((sum, deal) => sum + (deal.amount ?? 0), 0),
        unpriced: all.filter((deal) => deal.amount === null).length,
        stages: [...stages.values()]
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
          .map(({ label, count, amount, unpriced }) => ({ label, count, amount, unpriced })),
        closingSoon: soon.sort(byClose).slice(0, LIST_LIMIT),
        pastClose: past.sort(byClose).slice(0, LIST_LIMIT),
        closingSoonCount: soon.length,
        pastCloseCount: past.length,
        undated: all.filter((deal) => !deal.closeDate).length,
      };
    })
    .sort((a, b) => b.openCount - a.openCount || a.label.localeCompare(b.label));
}

export type WonDeals = {
  deals: Array<{ id: string; name: string; amount: number | null; closeDate: string | null }>;
  /** Sum of the won deals that have an amount. */
  amount: number;
  unpriced: number;
};

/** Deals won last week, biggest first. A deal without an amount is counted, never as $0. */
export function summarizeWonDeals(deals: readonly PipelineDealInput[]): WonDeals {
  const rows = deals
    .map((deal) => ({
      id: deal.id,
      name: textValue(deal.properties?.dealname) || "Unnamed deal",
      amount: amountValue(deal.properties?.amount),
      closeDate: closeDateValue(deal.properties?.closedate),
    }))
    .sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1) || a.name.localeCompare(b.name));
  return {
    deals: rows,
    amount: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    unpriced: rows.filter((row) => row.amount === null).length,
  };
}
