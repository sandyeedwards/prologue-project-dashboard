import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { runTeamworkSync } from "@/lib/teamwork/sync";

export async function POST() {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await runTeamworkSync("MANUAL"));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
