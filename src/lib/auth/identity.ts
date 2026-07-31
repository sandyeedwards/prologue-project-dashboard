import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appSessions, appUsers, auditLog, people, teamworkConnections } from "@/db/schema";
import { parseAdminEmails } from "./authorization";
import type { DashboardRole } from "./authorization";
import { isEligibleEmployee } from "./eligibility";

export type TeamworkIdentity = {
  userId: number;
  installationId: number;
  email: string;
  givenName?: string | null;
  familyName?: string | null;
};

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function displayName(first: string | null | undefined, last: string | null | undefined, email: string) {
  const value = [first?.trim(), last?.trim()].filter(Boolean).join(" ");
  return value || email;
}

async function bootstrapAdminEmails(): Promise<Set<string>> {
  const emails = parseAdminEmails(process.env.DASHBOARD_BOOTSTRAP_ADMIN_EMAILS);
  const [connection] = await getDb()
    .select({ email: teamworkConnections.connectedByEmail })
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);
  if (connection?.email) emails.add(normalizedEmail(connection.email));
  return emails;
}

export async function syncAppUsersFromPeople(): Promise<{
  eligiblePeople: number;
  created: number;
  updated: number;
  skipped: number;
  disabled: number;
  activeAdmins: number;
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.isActive, true),
        eq(people.isClientUser, false),
        eq(people.isServiceAccount, false),
      ),
    );
  const adminEmails = await bootstrapAdminEmails();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const person of rows) {
    const email = person.email ? normalizedEmail(person.email) : "";
    if (!email) {
      skipped += 1;
      continue;
    }
    const [existing] = await db
      .select()
      .from(appUsers)
      .where(
        or(
          eq(appUsers.teamworkUserId, person.teamworkId),
          sql`lower(${appUsers.email}) = ${email}`,
        ),
      )
      .limit(1);
    const shouldBeAdmin = adminEmails.has(email);
    if (existing) {
      await db
        .update(appUsers)
        .set({
          teamworkUserId: person.teamworkId,
          email,
          displayName: displayName(person.firstName, person.lastName, email),
          role: shouldBeAdmin ? "ADMIN" : existing.role,
          isActive: existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(appUsers.id, existing.id));
      updated += 1;
    } else {
      await db.insert(appUsers).values({
        teamworkUserId: person.teamworkId,
        email,
        displayName: displayName(person.firstName, person.lastName, email),
        role: shouldBeAdmin ? "ADMIN" : "VIEWER",
        isActive: true,
      });
      created += 1;
    }
  }

  let disabled = 0;
  const currentUsers = await db
    .select({
      user: appUsers,
      personId: people.id,
      personIsActive: people.isActive,
      personIsClientUser: people.isClientUser,
      personIsServiceAccount: people.isServiceAccount,
      personEmail: people.email,
    })
    .from(appUsers)
    .leftJoin(people, eq(people.teamworkId, appUsers.teamworkUserId));

  for (const row of currentUsers) {
    if (!row.user.isActive) continue;
    const eligible =
      row.personId !== null &&
      isEligibleEmployee({
        isActive: row.personIsActive ?? false,
        isClientUser: row.personIsClientUser ?? true,
        isServiceAccount: row.personIsServiceAccount ?? true,
        email: row.personEmail,
      });
    if (eligible) continue;

    const now = new Date();
    await db
      .update(appUsers)
      .set({ isActive: false, updatedAt: now })
      .where(eq(appUsers.id, row.user.id));
    await db
      .update(appSessions)
      .set({ revokedAt: now })
      .where(and(eq(appSessions.userId, row.user.id), isNull(appSessions.revokedAt)));
    await db.insert(auditLog).values({
      action: "AUTH_USER_AUTO_DISABLED",
      entityType: "app_user",
      entityId: row.user.id,
      before: { isActive: true },
      after: { isActive: false, reason: "TEAMWORK_EMPLOYEE_INELIGIBLE" },
    });
    disabled += 1;
  }

  const activeAdmins = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(and(eq(appUsers.role, "ADMIN"), eq(appUsers.isActive, true)));
  return {
    eligiblePeople: rows.length,
    created,
    updated,
    skipped,
    disabled,
    activeAdmins: activeAdmins.length,
  };
}

export async function provisionLogin(identity: TeamworkIdentity): Promise<{
  id: string;
  email: string;
  displayName: string;
  role: DashboardRole;
}> {
  const db = getDb();
  const email = normalizedEmail(identity.email);
  const [connection] = await db
    .select({ installationId: teamworkConnections.installationId })
    .from(teamworkConnections)
    .where(eq(teamworkConnections.isActive, true))
    .limit(1);
  if (!connection || connection.installationId !== identity.installationId) {
    throw new Error("TEAMWORK_INSTALLATION_NOT_ALLOWED");
  }

  const [person] = await db
    .select()
    .from(people)
    .where(
      or(
        eq(people.teamworkId, identity.userId),
        sql`lower(${people.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (!person || !isEligibleEmployee(person)) {
    throw new Error("TEAMWORK_USER_NOT_ELIGIBLE");
  }

  const [existing] = await db
    .select()
    .from(appUsers)
    .where(
      or(
        eq(appUsers.teamworkUserId, identity.userId),
        sql`lower(${appUsers.email}) = ${email}`,
      ),
    )
    .limit(1);
  const adminEmails = await bootstrapAdminEmails();
  const name = displayName(
    identity.givenName ?? person.firstName,
    identity.familyName ?? person.lastName,
    email,
  );

  let user: typeof appUsers.$inferSelect;
  if (existing) {
    const [updated] = await db
      .update(appUsers)
      .set({
        teamworkUserId: person.teamworkId,
        email,
        displayName: name,
        role: adminEmails.has(email) ? "ADMIN" : existing.role,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, existing.id))
      .returning();
    if (!updated) throw new Error("DASHBOARD_USER_UPDATE_FAILED");
    user = updated;
  } else {
    const [created] = await db
      .insert(appUsers)
      .values({
        teamworkUserId: person.teamworkId,
        email,
        displayName: name,
        role: adminEmails.has(email) ? "ADMIN" : "VIEWER",
        lastLoginAt: new Date(),
      })
      .returning();
    if (!created) throw new Error("DASHBOARD_USER_CREATE_FAILED");
    user = created;
  }
  if (!user.isActive) throw new Error("DASHBOARD_USER_DISABLED");

  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: "AUTH_LOGIN",
    entityType: "app_user",
    entityId: user.id,
    after: { provider: "TEAMWORK", role: user.role },
  });
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}
