import { randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { appSessions, appUsers, people } from "@/db/schema";
import { roleAllows, safeReturnTo } from "./authorization";
import type { DashboardRole } from "./authorization";
import { SESSION_COOKIE_NAME } from "./constants";
import { hashSessionToken } from "./tokens";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export type SessionUser = {
  id: string;
  teamworkUserId: number | null;
  email: string;
  displayName: string;
  role: DashboardRole;
};

export type VerifiedSession = {
  sessionId: string;
  expiresAt: Date;
  user: SessionUser;
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const headerStore = await headers();
  await getDb().insert(appSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSession(): Promise<VerifiedSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({
      sessionId: appSessions.id,
      expiresAt: appSessions.expiresAt,
      lastSeenAt: appSessions.lastSeenAt,
      userId: appUsers.id,
      teamworkUserId: appUsers.teamworkUserId,
      email: appUsers.email,
      displayName: appUsers.displayName,
      role: appUsers.role,
    })
    .from(appSessions)
    .innerJoin(appUsers, eq(appUsers.id, appSessions.userId))
    .innerJoin(people, eq(people.teamworkId, appUsers.teamworkUserId))
    .where(
      and(
        eq(appSessions.tokenHash, hashSessionToken(token)),
        gt(appSessions.expiresAt, new Date()),
        isNull(appSessions.revokedAt),
        eq(appUsers.isActive, true),
        eq(people.isActive, true),
        eq(people.isClientUser, false),
        eq(people.isServiceAccount, false),
        isNotNull(people.email),
        sql`length(trim(${people.email})) > 0`,
      ),
    )
    .limit(1);

  if (!row) return null;
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(appSessions).set({ lastSeenAt: new Date() }).where(eq(appSessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      teamworkUserId: row.teamworkUserId,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
    },
  };
}

export async function revokeCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await getDb()
      .update(appSessions)
      .set({ revokedAt: new Date() })
      .where(eq(appSessions.tokenHash, hashSessionToken(token)));
  }
  await clearSessionCookie();
}

export async function requireUser(returnTo = "/dashboard"): Promise<VerifiedSession> {
  const session = await getSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`);
  return session;
}

export async function requireRole(
  required: DashboardRole,
  returnTo = "/dashboard",
): Promise<VerifiedSession> {
  const session = await requireUser(returnTo);
  if (!roleAllows(session.user.role, required)) redirect("/forbidden");
  return session;
}

export async function authorizeApi(required: DashboardRole): Promise<
  | { ok: true; session: VerifiedSession }
  | { ok: false; response: Response }
> {
  const session = await getSession();
  if (!session) return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roleAllows(session.user.role, required)) {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
