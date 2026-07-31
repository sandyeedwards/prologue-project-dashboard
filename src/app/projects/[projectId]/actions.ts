"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  auditLog,
  dataQualityIssues,
  unplannedWorkReviews,
} from "@/db/schema";
import { requireRole } from "@/lib/auth/session";

const issueSchema = z.object({
  projectId: z.string().uuid(),
  issueId: z.string().uuid(),
});

const projectSchema = z.object({ projectId: z.string().uuid() });
const taskSchema = z.object({ projectId: z.string().uuid(), taskId: z.string().uuid() });

function detailRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function dismissIssue(
  issue: typeof dataQualityIssues.$inferSelect,
  adminUserId: string,
): Promise<void> {
  if (issue.code !== "UNPLANNED_ACTUAL_WORK" || !issue.taskId) {
    throw new Error("Only current unplanned-work issues can be dismissed.");
  }
  const details = detailRecord(issue.details);
  const minutes = Math.max(0, Math.round(finiteNumber(details.minutes)));
  const laborCost = finiteNumber(details.laborCost);
  const now = new Date();
  await getDb()
    .insert(unplannedWorkReviews)
    .values({
      projectId: issue.projectId,
      taskId: issue.taskId,
      dismissedByUserId: adminUserId,
      dismissedAt: now,
      dismissedLoggedMinutes: minutes,
      dismissedLaborCost: laborCost.toFixed(2),
    })
    .onConflictDoUpdate({
      target: unplannedWorkReviews.taskId,
      set: {
        projectId: issue.projectId,
        dismissedByUserId: adminUserId,
        dismissedAt: now,
        dismissedLoggedMinutes: minutes,
        dismissedLaborCost: laborCost.toFixed(2),
        updatedAt: now,
      },
    });
}

function refreshProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function dismissUnplannedWork(formData: FormData): Promise<void> {
  const input = issueSchema.parse({
    projectId: formData.get("projectId"),
    issueId: formData.get("issueId"),
  });
  const session = await requireRole("ADMIN", `/projects/${input.projectId}`);
  const db = getDb();
  const [issue] = await db
    .select()
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.id, input.issueId),
        eq(dataQualityIssues.projectId, input.projectId),
        eq(dataQualityIssues.code, "UNPLANNED_ACTUAL_WORK"),
      ),
    )
    .limit(1);
  if (!issue) throw new Error("The unplanned-work item is no longer current.");
  await dismissIssue(issue, session.user.id);
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "UNPLANNED_WORK_DISMISSED",
    entityType: "data_quality_issue",
    entityId: issue.id,
    after: { projectId: issue.projectId, taskId: issue.taskId },
  });
  refreshProject(input.projectId);
}

export async function dismissAllUnplannedWork(formData: FormData): Promise<void> {
  const input = projectSchema.parse({ projectId: formData.get("projectId") });
  const session = await requireRole("ADMIN", `/projects/${input.projectId}`);
  const db = getDb();
  const issues = await db
    .select()
    .from(dataQualityIssues)
    .where(
      and(
        eq(dataQualityIssues.projectId, input.projectId),
        eq(dataQualityIssues.code, "UNPLANNED_ACTUAL_WORK"),
      ),
    );
  for (const issue of issues) await dismissIssue(issue, session.user.id);
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "UNPLANNED_WORK_PROJECT_DISMISSED",
    entityType: "project",
    entityId: input.projectId,
    after: { dismissedIssueCount: issues.length },
  });
  refreshProject(input.projectId);
}

export async function reopenUnplannedWork(formData: FormData): Promise<void> {
  const input = taskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
  });
  const session = await requireRole("ADMIN", `/projects/${input.projectId}`);
  const db = getDb();
  await db
    .delete(unplannedWorkReviews)
    .where(
      and(
        eq(unplannedWorkReviews.projectId, input.projectId),
        eq(unplannedWorkReviews.taskId, input.taskId),
      ),
    );
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "UNPLANNED_WORK_REOPENED",
    entityType: "task",
    entityId: input.taskId,
    after: { projectId: input.projectId },
  });
  refreshProject(input.projectId);
}
