"use server";

import { and, count, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { appSessions, appUsers, auditLog } from "@/db/schema";
import { dashboardRoles } from "@/lib/auth/authorization";
import { requireRole } from "@/lib/auth/session";

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(dashboardRoles),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export async function updateUserAccess(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN", "/admin/users");
  const input = updateSchema.parse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  });
  const db = getDb();

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext('dashboard_admin_access'))`,
    );

    const [target] = await transaction
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, input.userId))
      .limit(1);
    if (!target) throw new Error("Dashboard user not found.");

    const removingAdmin =
      target.role === "ADMIN" && target.isActive && (input.role !== "ADMIN" || !input.isActive);
    if (removingAdmin) {
      const [adminCount] = await transaction
        .select({ value: count() })
        .from(appUsers)
        .where(and(eq(appUsers.role, "ADMIN"), eq(appUsers.isActive, true)));
      if (adminCount.value <= 1) {
        throw new Error("The last active administrator cannot be removed.");
      }
    }

    await transaction
      .update(appUsers)
      .set({ role: input.role, isActive: input.isActive, updatedAt: new Date() })
      .where(eq(appUsers.id, target.id));

    if (!input.isActive) {
      await transaction
        .update(appSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(appSessions.userId, target.id), isNull(appSessions.revokedAt)));
    }

    await transaction.insert(auditLog).values({
      actorUserId: session.user.id,
      action: "AUTH_USER_ACCESS_UPDATED",
      entityType: "app_user",
      entityId: target.id,
      before: { role: target.role, isActive: target.isActive },
      after: { role: input.role, isActive: input.isActive },
    });
  });

  revalidatePath("/admin/users");
}
