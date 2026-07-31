import "dotenv/config";
import { getDb, getSqlClient } from "@/db/client";
import { timeEntries } from "@/db/schema";
import { teamworkDateText } from "@/lib/teamwork/date";
import { firstValue, isRecord, type TeamworkRecord } from "@/lib/teamwork/fields";

const LOGGED_DATE_PATHS = [
  "timeLogged",
  "time-logged",
  "timelog.timeLogged",
  "date",
  "loggedDate",
  "dateUserPerspective",
  "dateUTC",
  "dateUtc",
  "loggedAt",
] as const;

async function main() {
  const db = getDb();
  const rows = await db
    .select({ teamworkId: timeEntries.teamworkId, loggedDate: timeEntries.loggedDate, raw: timeEntries.raw })
    .from(timeEntries);

  const unresolved = rows.flatMap((row) => {
    const raw = isRecord(row.raw) ? row.raw : ({} as TeamworkRecord);
    const sourceValue = firstValue(raw, LOGGED_DATE_PATHS);
    if (teamworkDateText(sourceValue)) return [];

    return [
      {
        teamworkId: row.teamworkId,
        storedLoggedDate: row.loggedDate,
        availableDateFields: Object.keys(raw)
          .filter((key) => /date|time|logged/i.test(key))
          .sort(),
        sourceValue: sourceValue ?? null,
      },
    ];
  });

  console.log(
    JSON.stringify(
      {
        status: unresolved.length === 0 ? "PASS" : "NEEDS_REVIEW",
        totalTimeEntries: rows.length,
        recognizedSourceDates: rows.length - unresolved.length,
        unresolvedSourceDates: unresolved.length,
        samples: unresolved.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end();
  });
