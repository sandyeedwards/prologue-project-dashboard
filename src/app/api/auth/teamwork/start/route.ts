import { NextRequest, NextResponse } from "next/server";
import { safeReturnTo } from "@/lib/auth/authorization";
import { createOauthState, oauthConfig } from "@/lib/teamwork/oauth";

export async function GET(request: NextRequest) {
  const { clientId, redirectUri } = oauthConfig();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const state = await createOauthState({ purpose: "LOGIN", returnTo });
  const login = new URL("https://prologuesystems.teamwork.com/launchpad/login");
  login.searchParams.set("client_id", clientId);
  login.searchParams.set("redirect_uri", redirectUri);
  login.searchParams.set("state", state);
  return NextResponse.redirect(login);
}
