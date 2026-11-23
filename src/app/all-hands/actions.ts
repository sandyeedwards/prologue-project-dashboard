"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSqlClient } from "@/db/client";
import { allHandsNotesSchema, parseWeek } from "@/lib/all-hands/agenda";
import { getSession } from "@/lib/auth/session";

const saveSchema = z.object({
  weekStart: z.string(),
  /** The version the editor started from; 0 when the week had not been saved yet. */
  version: z.number().int().min(0),
  notes: z.unknown(),
});

export type SaveAgendaResult =
  | { ok: true; version: number; savedAt: string }
  | { ok: false; conflict: boolean; message: string };

/** Saves one week's typed notes. Anyone signed in may edit; stale editors are told, not overwritten. */
export async function saveAgendaNotes(input: unknown): Promise<SaveAgendaResult> {
  // No redirect here: sending an expired session to the login page would throw away the notes.
  const session = await getSession();
  if (!session)
    return {
      ok: false,
      conflict: false,
      message: "Your sign-in has expired. Copy your notes, sign in again in a new tab, then save.",
    };
  const parsed = saveSchema.safeParse(input);
  const weekStart = parsed.success ? parseWeek(parsed.data.weekStart) : null;
  if (!parsed.success || !weekStart || weekStart !== parsed.data.weekStart)
    return { ok: false, conflict: false, message: "That week could not be saved." };
  const notes = allHandsNotesSchema.safeParse(parsed.data.notes);
  if (!notes.success)
    return { ok: false, conflict: false, message: "Some notes were too long to save." };
  const sql = getSqlClient();
  const userId = session.user.id;
  const json = sql.json(notes.data as Parameters<typeof sql.json>[0]);
  const rows =
    parsed.data.version === 0
      ? await sql<{ version: number; updatedAt: Date }[]>`
          insert into all_hands_notes (week_start, notes, version, updated_by_user_id)
          values (${weekStart}::date, ${json}, 1, ${userId})
          on conflict (week_start) do nothing
          returning version, updated_at as "updatedAt"
        `
      : await sql<{ version: number; updatedAt: Date }[]>`
          update all_hands_notes
          set notes = ${json}, version = version + 1, updated_by_user_id = ${userId},
            updated_at = now()
          where week_start = ${weekStart}::date and version = ${parsed.data.version}
          returning version, updated_at as "updatedAt"
        `;
  const saved = rows[0];
  if (!saved)
    return {
      ok: false,
      conflict: true,
      message:
        "Someone else saved this week's notes after you opened the page. Copy anything you need, then reload to see their changes.",
    };
  await sql`
    insert into audit_log (actor_user_id, action, entity_type, entity_id, after)
    values (${userId}, 'ALL_HANDS_NOTES_SAVED', 'all_hands_notes', ${weekStart},
      ${sql.json({ version: saved.version })})
  `;
  revalidatePath("/all-hands");
  return { ok: true, version: saved.version, savedAt: saved.updatedAt.toISOString() };
}
