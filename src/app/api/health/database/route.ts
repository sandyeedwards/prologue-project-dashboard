import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { authorizeApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  const startedAt = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      service: "postgresql",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Database health check failed.", error);
    return NextResponse.json(
      { status: "error", service: "postgresql", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
