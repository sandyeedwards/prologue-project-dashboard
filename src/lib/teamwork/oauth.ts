import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { oauthStates } from "@/db/schema";
import { safeReturnTo } from "@/lib/auth/authorization";

export type OauthPurpose = "CONNECTION" | "LOGIN";

export function oauthConfig() {
  const clientId = process.env.TEAMWORK_CLIENT_ID;
  const clientSecret = process.env.TEAMWORK_CLIENT_SECRET;
  const redirectUri = process.env.TEAMWORK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Teamwork OAuth environment variables are incomplete.");
  }
  return { clientId, clientSecret, redirectUri };
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createOauthState(
  options: {
    purpose?: OauthPurpose;
    returnTo?: string | null;
  } = {},
): Promise<string> {
  const db = getDb();
  const state = randomBytes(32).toString("base64url");
  await db.insert(oauthStates).values({
    stateHash: hash(state),
    expiresAt: new Date(Date.now() + 15 * 60_000),
    purpose: options.purpose ?? "CONNECTION",
    returnTo: options.purpose === "LOGIN" ? safeReturnTo(options.returnTo) : null,
  });
  return state;
}

export async function consumeOauthState(state: string): Promise<{
  purpose: OauthPurpose;
  returnTo: string | null;
} | null> {
  const db = getDb();
  const [row] = await db
    .update(oauthStates)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(oauthStates.stateHash, hash(state)),
        gt(oauthStates.expiresAt, new Date()),
        isNull(oauthStates.usedAt),
      ),
    )
    .returning({ purpose: oauthStates.purpose, returnTo: oauthStates.returnTo });
  if (!row) return null;
  return {
    purpose: row.purpose === "LOGIN" ? "LOGIN" : "CONNECTION",
    returnTo: row.returnTo,
  };
}
