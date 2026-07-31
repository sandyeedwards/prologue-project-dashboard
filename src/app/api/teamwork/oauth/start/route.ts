import { NextRequest, NextResponse } from "next/server";
import { createOauthState, oauthConfig } from "@/lib/teamwork/oauth";

export async function GET(request: NextRequest) {
  const setupKey = process.env.TEAMWORK_SETUP_KEY;
  if (!setupKey || request.nextUrl.searchParams.get("key") !== setupKey)
    return NextResponse.json({ error: "Unauthorized setup request." }, { status: 401 });
  const { clientId, redirectUri } = oauthConfig();
  const state = await createOauthState({ purpose: "CONNECTION" });
  const login = new URL("https://prologuesystems.teamwork.com/launchpad/login");
  login.searchParams.set("client_id", clientId);
  login.searchParams.set("redirect_uri", redirectUri);
  login.searchParams.set("state", state);
  return NextResponse.redirect(login);
}
