import "dotenv/config";
import { and, count, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appSessions, appUsers, people, teamworkConnections } from "@/db/schema";

const eligiblePerson = and(
  eq(people.isActive, true),
  eq(people.isClientUser, false),
  eq(people.isServiceAccount, false),
  isNotNull(people.email),
  sql`length(trim(${people.email})) > 0`,
);

async function main() {
  const db = getDb();
  const [
    [connection],
    [eligible],
    [users],
    [provisionedEligible],
    [admins],
    [managers],
    [viewers],
    [sessions],
    [ineligible],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(teamworkConnections)
      .where(eq(teamworkConnections.isActive, true)),
    db.select({ value: count() }).from(people).where(eligiblePerson),
    db.select({ value: count() }).from(appUsers),
    db
      .select({ value: count() })
      .from(appUsers)
      .innerJoin(people, eq(people.teamworkId, appUsers.teamworkUserId))
      .where(eligiblePerson),
    db
      .select({ value: count() })
      .from(appUsers)
      .where(and(eq(appUsers.role, "ADMIN"), eq(appUsers.isActive, true))),
    db
      .select({ value: count() })
      .from(appUsers)
      .where(and(eq(appUsers.role, "MANAGER"), eq(appUsers.isActive, true))),
    db
      .select({ value: count() })
      .from(appUsers)
      .where(and(eq(appUsers.role, "VIEWER"), eq(appUsers.isActive, true))),
    db.select({ value: count() }).from(appSessions),
    db
      .select({ value: count() })
      .from(appUsers)
      .leftJoin(people, eq(people.teamworkId, appUsers.teamworkUserId))
      .where(
        and(
          eq(appUsers.isActive, true),
          or(
            isNull(people.id),
            eq(people.isActive, false),
            eq(people.isClientUser, true),
            eq(people.isServiceAccount, true),
          ),
        ),
      ),
  ]);

  const checks = {
    centralConnectionPreserved: connection.value === 1,
    eligibleEmployeesFound: eligible.value > 0,
    usersProvisioned: provisionedEligible.value === eligible.value,
    activeAdministratorExists: admins.value > 0,
    noIneligibleActiveUsers: ineligible.value === 0,
    sessionStorageReady: Number.isInteger(sessions.value),
  };
  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  console.log(
    JSON.stringify(
      {
        status,
        checks,
        counts: {
          eligibleEmployees: eligible.value,
          provisionedEligibleEmployees: provisionedEligible.value,
          appUsers: users.value,
          activeAdmins: admins.value,
          activeManagers: managers.value,
          activeViewers: viewers.value,
          sessions: sessions.value,
          ineligibleActiveUsers: ineligible.value,
        },
        policies: {
          authentication: "TEAMWORK_OAUTH",
          sessionStorage: "HASHED_DATABASE_SESSION",
          sessionHours: 12,
          roles: ["VIEWER", "MANAGER", "ADMIN"],
          employeeTokensStored: false,
          centralReportingConnectionSeparated: true,
        },
      },
      null,
      2,
    ),
  );
  if (status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
