import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/session";
import { runTeamworkSync, TeamworkSyncAlreadyRunningError } from "@/lib/teamwork/sync";

export async function POST() {
  const auth = await authorizeApi("ADMIN");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await runTeamworkSync("MANUAL"));
  } catch (error) {
    if (error instanceof TeamworkSyncAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
