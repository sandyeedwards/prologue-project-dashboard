import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { calculationRuns } from "@/db/schema";
import { authorizeApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  const [run] = await getDb()
    .select()
    .from(calculationRuns)
    .orderBy(desc(calculationRuns.startedAt))
    .limit(1);
  return Response.json({
    status: run?.status ?? "NOT_RUN",
    calculationVersion: run?.calculationVersion ?? null,
    completedAt: run?.completedAt ?? null,
    projectsCalculated: run?.projectsCalculated ?? 0,
    warnings: run?.warnings ?? 0,
    errors: run?.errors ?? 0,
  });
}
