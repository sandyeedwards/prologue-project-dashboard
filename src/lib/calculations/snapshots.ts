import { getDb } from "@/db/client";
import { projectMetrics, projectSnapshots } from "@/db/schema";
import { CALCULATION_VERSION } from "@/lib/calculations/engine";

export async function createProjectSnapshots(snapshotDate = new Date().toISOString().slice(0, 10)) {
  const db = getDb();
  const metrics = await db.select().from(projectMetrics);
  for (const metric of metrics) {
    await db
      .insert(projectSnapshots)
      .values({
        projectId: metric.projectId,
        snapshotDate,
        kind: "NIGHTLY",
        clientFee: metric.clientFee,
        targetCost: metric.targetCost,
        projectedLaborCost: metric.projectedLaborCost,
        projectedNonLaborCost: metric.projectedNonLaborCost,
        actualLaborCost: metric.actualLaborCost,
        actualNonLaborCost: metric.actualNonLaborCost,
        forecastCost: metric.forecastCost,
        forecastProfit: metric.forecastProfit,
        forecastMarginPercent: metric.forecastMarginPercent,
        estimatedMinutes: metric.canonicalEstimatedMinutes,
        loggedMinutes: metric.loggedMinutes,
        completedTaskCount: metric.completedTaskCount,
        totalTaskCount: metric.totalTaskCount,
        estimateConsumptionPercent: metric.estimateConsumptionPercent,
        healthScore: metric.healthScore,
        healthBand: metric.healthBand,
        taskListBudgetCoverage: metric.taskListBudgetCoverage,
        expenseCoverage: metric.expenseCoverage,
        isProvisional: metric.isProvisional,
        calculationVersion: CALCULATION_VERSION,
        details: metric.details,
      })
      .onConflictDoUpdate({
        target: [projectSnapshots.projectId, projectSnapshots.snapshotDate, projectSnapshots.kind],
        set: {
          clientFee: metric.clientFee,
          targetCost: metric.targetCost,
          projectedLaborCost: metric.projectedLaborCost,
          projectedNonLaborCost: metric.projectedNonLaborCost,
          actualLaborCost: metric.actualLaborCost,
          actualNonLaborCost: metric.actualNonLaborCost,
          forecastCost: metric.forecastCost,
          forecastProfit: metric.forecastProfit,
          forecastMarginPercent: metric.forecastMarginPercent,
          estimatedMinutes: metric.canonicalEstimatedMinutes,
          loggedMinutes: metric.loggedMinutes,
          completedTaskCount: metric.completedTaskCount,
          totalTaskCount: metric.totalTaskCount,
          estimateConsumptionPercent: metric.estimateConsumptionPercent,
          healthScore: metric.healthScore,
          healthBand: metric.healthBand,
          taskListBudgetCoverage: metric.taskListBudgetCoverage,
          expenseCoverage: metric.expenseCoverage,
          isProvisional: metric.isProvisional,
          calculationVersion: CALCULATION_VERSION,
          details: metric.details,
        },
      });
  }
  return { status: "ok" as const, snapshotDate, projects: metrics.length };
}
