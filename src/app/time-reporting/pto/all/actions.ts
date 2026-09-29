"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { auditLog, people, ptoAllowanceOverrides } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";

const updatePtoAllowanceSchema = z.object({
  personId: z.string().uuid(),
  calendarYear: z.coerce.number().int().min(2000).max(2100),
  allowanceDays: z.coerce
    .number()
    .min(0)
    .max(1250)
    .refine((value) => Number.isInteger(value * 2), {
      message: "PTO allowance must be entered in 0.5-day increments.",
    }),
});

export async function updatePtoAllowance(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN", "/time-reporting/pto/all");

  const input = updatePtoAllowanceSchema.parse({
    personId: formData.get("personId"),
    calendarYear: formData.get("calendarYear"),
    allowanceDays: formData.get("allowanceDays"),
  });

  const allowanceMinutes = Math.round(input.allowanceDays * 8 * 60);
  const db = getDb();

  await db.transaction(async (transaction) => {
    const [person] = await transaction
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, input.personId))
      .limit(1);

    if (!person) {
      throw new Error("Employee not found.");
    }

    const [existing] = await transaction
      .select()
      .from(ptoAllowanceOverrides)
      .where(
        and(
          eq(ptoAllowanceOverrides.personId, input.personId),
          eq(ptoAllowanceOverrides.calendarYear, input.calendarYear),
        ),
      )
      .limit(1);

    if (existing) {
      await transaction
        .update(ptoAllowanceOverrides)
        .set({
          allowanceMinutes,
          updatedAt: new Date(),
        })
        .where(eq(ptoAllowanceOverrides.id, existing.id));
    } else {
      await transaction.insert(ptoAllowanceOverrides).values({
        personId: input.personId,
        calendarYear: input.calendarYear,
        allowanceMinutes,
      });
    }

    await transaction.insert(auditLog).values({
      actorUserId: session.user.id,
      action: "PTO_ALLOWANCE_UPDATED",
      entityType: "pto_allowance_override",
      entityId: `${input.personId}:${input.calendarYear}`,
      before: {
        allowanceMinutes: existing?.allowanceMinutes ?? null,
      },
      after: {
        calendarYear: input.calendarYear,
        allowanceMinutes,
      },
    });
  });

  revalidatePath("/time-reporting");
  revalidatePath("/time-reporting/pto");
  revalidatePath("/time-reporting/pto/all");
}
