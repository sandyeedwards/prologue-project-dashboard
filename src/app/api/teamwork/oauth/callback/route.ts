import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { teamworkConnections } from "@/db/schema";
import { safeReturnTo } from "@/lib/auth/authorization";
import { applicationUrl } from "@/lib/app-url";
import { provisionLogin } from "@/lib/auth/identity";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { encryptToken } from "@/lib/teamwork/crypto";
import { consumeOauthState, oauthConfig } from "@/lib/teamwork/oauth";

type TokenResponse = {
  access_token?: string;
  installation?: { apiEndPoint?: string; id?: number; name?: string; region?: string };
  status?: string;
  message?: string;
};

type UserInfo = {
  user_id?: number;
  installation_id?: number;
  email?: string;
  given_name?: string;
  family_name?: string;
};

function errorRedirect(request: NextRequest, purpose: "CONNECTION" | "LOGIN", code: string) {
  const path = purpose === "LOGIN" ? "/login" : "/admin/teamwork";
  return NextResponse.redirect(
    applicationUrl(`${path}?error=${encodeURIComponent(code)}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return errorRedirect(request, "LOGIN", "invalid_state");
  const oauthState = await consumeOauthState(state);
  if (!oauthState) return errorRedirect(request, "LOGIN", "invalid_state");

  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const response = await fetch("https://www.teamwork.com/launchpad/v1/token.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const token = (await response.json()) as TokenResponse;
  if (!response.ok || !token.access_token || !token.installation?.id) {
    return errorRedirect(request, oauthState.purpose, token.message ?? "token_exchange_failed");
  }

  const userResponse = await fetch("https://www.teamwork.com/launchpad/v1/userinfo.json", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const userInfo = userResponse.ok ? ((await userResponse.json()) as UserInfo) : {};

  if (oauthState.purpose === "LOGIN") {
    if (!userInfo.user_id || !userInfo.email) {
      return errorRedirect(request, "LOGIN", "userinfo_unavailable");
    }
    try {
      const user = await provisionLogin({
        userId: userInfo.user_id,
        installationId: userInfo.installation_id ?? token.installation.id,
        email: userInfo.email,
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
      });
      const session = await createSession(user.id);
      await setSessionCookie(session.token, session.expiresAt);
      return NextResponse.redirect(
        applicationUrl(safeReturnTo(oauthState.returnTo, "/dashboard"), request.url),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "login_failed";
      return errorRedirect(request, "LOGIN", message);
    }
  }

  if (!token.installation.apiEndPoint) {
    return errorRedirect(request, "CONNECTION", "installation_endpoint_missing");
  }
  const encrypted = encryptToken(token.access_token);
  const db = getDb();
  await db.update(teamworkConnections).set({ isActive: false, updatedAt: new Date() });
  await db
    .insert(teamworkConnections)
    .values({
      installationId: token.installation.id,
      installationName: token.installation.name ?? "Prologue Systems",
      apiEndpoint: token.installation.apiEndPoint,
      region: token.installation.region ?? null,
      encryptedAccessToken: encrypted.encrypted,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      connectedByTeamworkUserId: userInfo.user_id ?? null,
      connectedByEmail: userInfo.email ?? null,
      lastVerifiedAt: new Date(),
      isActive: true,
    })
    .onConflictDoUpdate({
      target: teamworkConnections.installationId,
      set: {
        installationName: token.installation.name ?? "Prologue Systems",
        apiEndpoint: token.installation.apiEndPoint,
        region: token.installation.region ?? null,
        encryptedAccessToken: encrypted.encrypted,
        tokenIv: encrypted.iv,
        tokenAuthTag: encrypted.authTag,
        connectedByTeamworkUserId: userInfo.user_id ?? null,
        connectedByEmail: userInfo.email ?? null,
        lastVerifiedAt: new Date(),
        isActive: true,
        updatedAt: new Date(),
      },
    });
  return NextResponse.redirect(applicationUrl("/admin/teamwork?connected=1", request.url));
}
