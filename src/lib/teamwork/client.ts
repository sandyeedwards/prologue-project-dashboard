import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { teamworkConnections } from "@/db/schema";
import { decryptToken } from "./crypto";

export type TeamworkConnection = typeof teamworkConnections.$inferSelect;
export async function activeConnection() {
  const db = getDb();
  const [connection] = await db
    .select()
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);
  if (!connection) throw new Error("No active Teamwork connection. Visit /admin/teamwork.");
  return connection;
}
export function bearerToken(connection: TeamworkConnection) {
  return decryptToken({
    encrypted: connection.encryptedAccessToken,
    iv: connection.tokenIv,
    authTag: connection.tokenAuthTag,
  });
}
export async function teamworkFetch<T>(connection: TeamworkConnection, path: string): Promise<T> {
  const url = new URL(
    path.replace(/^\//, ""),
    connection.apiEndpoint.endsWith("/") ? connection.apiEndpoint : `${connection.apiEndpoint}/`,
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken(connection)}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Teamwork request failed (${response.status}) for ${url.pathname}`);
  return response.json() as Promise<T>;
}
