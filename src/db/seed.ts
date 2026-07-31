import "dotenv/config";
import { sql } from "drizzle-orm";

import { getDb, getSqlClient } from "./client";
import { operationalGroupRules, outsourcedRates, outsourcedTaskAliases } from "./schema";
import { normalizeTeamworkLabel } from "../lib/teamwork/normalize";

const groupRules = [
  { priority: 10, pattern: "mobilization", groupName: "Mobilization" },
  { priority: 20, pattern: "fieldwork", groupName: "Fieldwork" },
  { priority: 30, pattern: "field work", groupName: "Fieldwork" },
  { priority: 40, pattern: "field ops", groupName: "Fieldwork" },
  { priority: 50, pattern: "field operations", groupName: "Fieldwork" },
  { priority: 60, pattern: "modeling", groupName: "Modeling" },
  { priority: 70, pattern: "modelling", groupName: "Modeling" },
];

const aliases = ["Outsourced Modeling", "Cosmere Modeling"];

async function seed(): Promise<void> {
  const db = getDb();
  await db.transaction(async (transaction) => {
    for (const rule of groupRules) {
      await transaction
        .insert(operationalGroupRules)
        .values(rule)
        .onConflictDoUpdate({
          target: operationalGroupRules.priority,
          set: {
            pattern: rule.pattern,
            groupName: rule.groupName,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    }

    for (const alias of aliases) {
      const normalizedAlias = normalizeTeamworkLabel(alias);
      await transaction
        .insert(outsourcedTaskAliases)
        .values({ alias, normalizedAlias })
        .onConflictDoUpdate({
          target: outsourcedTaskAliases.normalizedAlias,
          set: { alias, isActive: true, updatedAt: new Date() },
        });
    }

    await transaction
      .insert(outsourcedRates)
      .values({ effectiveFrom: "2026-01-01", hourlyRate: "15.0000" })
      .onConflictDoNothing({ target: outsourcedRates.effectiveFrom });

    await transaction.execute(sql`select 1`);
  });
}

seed()
  .then(async () => {
    console.log("Database seed completed.");
    await getSqlClient().end();
  })
  .catch(async (error: unknown) => {
    console.error("Database seed failed.", error);
    await getSqlClient().end();
    process.exitCode = 1;
  });
