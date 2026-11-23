import { z } from "zod";

/**
 * Weekly scheduling-host rotation (initials, in order). The anchor is a known Monday and who
 * hosts it; every other week is counted from there.
 */
export const HOST_ROTATION = ["FSR", "HHM", "BSG", "AEE", "KEK", "CPS", "RBT"] as const;
export const HOST_ROTATION_ANCHOR = { weekStart: "2026-11-30", host: "KEK" } as const;

const DAY_MS = 86_400_000;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function iso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** The Monday of the week holding `date` (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return iso(value);
}

export function addWeeks(weekStart: string, weeks: number): string {
  return iso(new Date(utcDate(weekStart).getTime() + weeks * 7 * DAY_MS));
}

/** A requested ?week= value as a Monday, or null when it is not a real date. */
export function parseWeek(value: string | null | undefined): string | null {
  if (!value || !isoDate.test(value)) return null;
  const parsed = utcDate(value);
  if (Number.isNaN(parsed.valueOf()) || iso(parsed) !== value) return null;
  return mondayOf(value);
}

export function scheduledHost(weekStart: string): string {
  const weeks = Math.round(
    (utcDate(weekStart).getTime() - utcDate(HOST_ROTATION_ANCHOR.weekStart).getTime()) /
      (7 * DAY_MS),
  );
  const anchor = HOST_ROTATION.indexOf(HOST_ROTATION_ANCHOR.host);
  const size = HOST_ROTATION.length;
  return HOST_ROTATION[(((anchor + weeks) % size) + size) % size];
}

const text = z.string().max(20_000).catch("");
export const actionItemSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().max(2_000),
  done: z.boolean(),
});
export type ActionItem = z.infer<typeof actionItemSchema>;

/** Typed sections of the agenda, in meeting order. */
export const NOTE_SECTIONS = [
  { key: "missionMoment", title: "Mission Moment", carry: false },
  { key: "calendar", title: "Calendar: WFH / PTO", carry: false },
  { key: "longRange", title: "Long range", carry: true },
  { key: "announcements", title: "Office announcements & team requests", carry: true },
  { key: "projectUpdates", title: "Project updates", carry: true },
  { key: "specialInitiatives", title: "Special initiatives", carry: true },
  { key: "technology", title: "Technology & equipment", carry: true },
  { key: "breakouts", title: "Breakout sessions", carry: true },
] as const;
export type NoteSectionKey = (typeof NOTE_SECTIONS)[number]["key"];

export const allHandsNotesSchema = z.object({
  missionMoment: text,
  calendar: text,
  longRange: text,
  announcements: text,
  projectUpdates: text,
  specialInitiatives: text,
  technology: text,
  breakouts: text,
  /** Pipeline action items (deals to follow up). Open items carry into the next week. */
  actionItems: z.array(actionItemSchema).max(200).catch([]),
  /** Who is actually hosting, when it is not the scheduled person. Blank = scheduled host. */
  hostOverride: z.string().max(40).catch(""),
});
export type AllHandsNotes = z.infer<typeof allHandsNotesSchema>;

export function emptyNotes(): AllHandsNotes {
  return allHandsNotesSchema.parse({});
}

/** Stored JSON as notes; anything unreadable becomes an empty section rather than an error. */
export function parseNotes(value: unknown): AllHandsNotes {
  const record = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  return allHandsNotesSchema.parse(record);
}

/**
 * Starts a new week from the last saved one: ongoing sections and open action items carry
 * forward; the week-specific ones (Mission Moment, WFH/PTO, host swap) start blank.
 */
export function carryForward(previous: AllHandsNotes): AllHandsNotes {
  const next = emptyNotes();
  for (const section of NOTE_SECTIONS) {
    if (section.carry) next[section.key] = previous[section.key];
  }
  next.actionItems = previous.actionItems.filter((item) => !item.done && item.text.trim());
  return next;
}
