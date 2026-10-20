"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { auditLog, hostingBenacoMonthlyBills } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";

const monthlyBillSchema = z.object({
  billingMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Choose a valid billing month.")
    .refine((value) => value >= "2023-01", "Benaco bill history starts in January 2023."),
  billedAmount: z.coerce.number().min(0).max(10_000_000),
  activePanos: z.coerce.number().positive().max(1_000_000_000),
  notes: z.string().trim().max(1_000).optional(),
});

export async function saveBenacoMonthlyBill(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN", "/hosting");
  const input = monthlyBillSchema.parse({
    billingMonth: formData.get("billingMonth"),
    billedAmount: formData.get("billedAmount"),
    activePanos: formData.get("activePanos"),
    notes: formData.get("notes") || undefined,
  });
  const billingMonth = `${input.billingMonth}-01`;
  const db = getDb();

  await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(hostingBenacoMonthlyBills)
      .where(eq(hostingBenacoMonthlyBills.billingMonth, billingMonth))
      .limit(1);

    const values = {
      billedAmount: input.billedAmount.toFixed(2),
      activePanos: input.activePanos.toFixed(2),
      notes: input.notes || null,
      enteredByUserId: session.user.id,
      updatedAt: new Date(),
    };

    if (existing) {
      await transaction
        .update(hostingBenacoMonthlyBills)
        .set(values)
        .where(eq(hostingBenacoMonthlyBills.id, existing.id));
    } else {
      await transaction.insert(hostingBenacoMonthlyBills).values({
        billingMonth,
        ...values,
      });
    }

    await transaction.insert(auditLog).values({
      actorUserId: session.user.id,
      action: existing ? "BENACO_MONTHLY_BILL_UPDATED" : "BENACO_MONTHLY_BILL_CREATED",
      entityType: "hosting_benaco_monthly_bill",
      entityId: billingMonth,
      before: existing
        ? {
            billedAmount: existing.billedAmount,
            activePanos: existing.activePanos,
            notes: existing.notes,
          }
        : null,
      after: {
        billingMonth,
        billedAmount: values.billedAmount,
        activePanos: values.activePanos,
        notes: values.notes,
      },
    });
  });

  revalidatePath("/hosting");
}
