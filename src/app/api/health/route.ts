import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "prologue-project-dashboard",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
