"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { saveAgendaNotes } from "@/app/all-hands/actions";
import {
  NOTE_SECTIONS,
  type ActionItem,
  type AllHandsNotes,
  type NoteSectionKey,
} from "@/lib/all-hands/agenda";
import styles from "@/app/all-hands/all-hands.module.css";

type SaveState =
  { kind: "clean" } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function NoteField({
  title,
  value,
  onChange,
  hint,
  hideTitle = false,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** When the section heading already says it, keep the label for screen readers only. */
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, 72)}px`;
  }, [value]);
  return (
    <label className={styles.note}>
      <span className={hideTitle ? styles.srOnly : undefined}>{title}</span>
      {hint ? <small>{hint}</small> : null}
      <textarea ref={ref} value={value} onChange={(event) => onChange(event.target.value)} />
      <div className={styles.printText} aria-hidden="true">
        {value.trim() || "Nothing this week."}
      </div>
    </label>
  );
}

function ActionItems({
  items,
  onChange,
}: {
  items: ActionItem[];
  onChange: (items: ActionItem[]) => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const update = (id: string, change: Partial<ActionItem>) =>
    onChange(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  return (
    <div className={styles.actionItems}>
      <h3>Action items</h3>
      {items.length ? null : <p className={styles.muted}>No action items yet.</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id} data-done={item.done}>
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Done: ${item.text || "action item"}`}
              onChange={(event) => update(item.id, { done: event.target.checked })}
            />
            <input
              type="text"
              value={item.text}
              autoFocus={item.id === focusId}
              placeholder="e.g. St. Christophers master planning: send proposal"
              aria-label="Action item"
              onChange={(event) => update(item.id, { text: event.target.value })}
            />
            <span className={styles.printText}>{item.text}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${item.text || "action item"}`}
              onClick={() => onChange(items.filter((row) => row.id !== item.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          const id = newId();
          setFocusId(id);
          onChange([...items, { id, text: "", done: false }]);
        }}
      >
        Add action item
      </button>
      <p className={styles.muted}>Open items carry into next week; checked items drop off.</p>
    </div>
  );
}

export function AllHandsWorkspace({
  weekStart,
  initialNotes,
  initialVersion,
  carriedFrom,
  lastSaved,
  scheduledHost,
  nextWeekHost,
  pipeline,
  insights,
  utilization,
}: {
  weekStart: string;
  initialNotes: AllHandsNotes;
  initialVersion: number;
  carriedFrom: string | null;
  lastSaved: string | null;
  scheduledHost: string;
  nextWeekHost: string;
  pipeline: ReactNode;
  insights: ReactNode;
  utilization: ReactNode;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [version, setVersion] = useState(initialVersion);
  const [state, setState] = useState<SaveState>({ kind: "clean" });
  const [savedLabel, setSavedLabel] = useState(lastSaved);
  const dirty = state.kind === "dirty" || state.kind === "error";

  const change = <K extends keyof AllHandsNotes>(key: K, value: AllHandsNotes[K]) => {
    setNotes((current) => ({ ...current, [key]: value }));
    setState({ kind: "dirty" });
  };

  const save = useCallback(async () => {
    setState({ kind: "saving" });
    let result: Awaited<ReturnType<typeof saveAgendaNotes>>;
    try {
      result = await saveAgendaNotes({ weekStart, version, notes });
    } catch {
      setState({
        kind: "error",
        message: "Could not save. Check your connection and try again; your notes are still here.",
      });
      return;
    }
    if (result.ok) {
      setVersion(result.version);
      setSavedLabel(
        `Saved ${new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(result.savedAt))}`,
      );
      setState({ kind: "clean" });
    } else {
      setState({ kind: "error", message: result.message });
    }
  }, [notes, version, weekStart]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (state.kind !== "saving") void save();
      }
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty, save, state.kind]);

  const field = (key: NoteSectionKey, hint?: string, hideTitle = true) => {
    const section = NOTE_SECTIONS.find((item) => item.key === key)!;
    return (
      <NoteField
        title={section.title}
        hint={hint}
        hideTitle={hideTitle}
        value={notes[key]}
        onChange={(value) => change(key, value)}
      />
    );
  };

  const host = notes.hostOverride.trim() || scheduledHost;

  return (
    <div className={styles.workspace}>
      <div className={styles.saveBar} role="status" aria-live="polite">
        <span data-state={state.kind}>
          {state.kind === "saving"
            ? "Saving…"
            : state.kind === "error"
              ? state.message
              : state.kind === "dirty"
                ? "Unsaved changes"
                : version === 0
                  ? carriedFrom
                    ? "Not saved yet: notes carried from the last meeting"
                    : "Not saved yet"
                  : (savedLabel ?? "All changes saved")}
        </span>
        <div className={styles.saveActions}>
          <button type="button" className="button button--secondary" onClick={() => window.print()}>
            Print / PDF
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={state.kind === "saving" || (state.kind === "clean" && version > 0)}
            onClick={() => void save()}
          >
            Save notes
          </button>
        </div>
      </div>

      <section className={styles.hostCard} aria-label="Scheduling host">
        <div>
          <small>Host this week</small>
          <strong>{host}</strong>
          {notes.hostOverride.trim() ? <small>Covering for {scheduledHost}</small> : null}
        </div>
        <div>
          <small>Next week</small>
          <strong>{nextWeekHost}</strong>
        </div>
        <label className={styles.hostOverride}>
          <span>Someone covering this week?</span>
          <input
            type="text"
            value={notes.hostOverride}
            placeholder="Initials"
            maxLength={40}
            onChange={(event) => change("hostOverride", event.target.value)}
          />
        </label>
      </section>

      <div className={styles.agenda}>
        <section className={styles.block}>
          <h2>1. Mission Moment</h2>
          {field("missionMoment")}
        </section>
        <section className={styles.block}>
          <h2>2. Calendar</h2>
          {field("calendar", "Who is WFH or out each day, holidays.", false)}
          {field("longRange", "Trips and site visits coming up, e.g. CPS – 12/2–12/4.", false)}
        </section>
        <section className={styles.block}>
          <h2>3. Office announcements &amp; team requests</h2>
          {field("announcements")}
        </section>
        <section className={styles.block}>
          <h2>4. Pipeline (HubSpot)</h2>
          {pipeline}
          <ActionItems
            items={notes.actionItems}
            onChange={(items) => change("actionItems", items)}
          />
        </section>
        <section className={styles.block}>
          <h2>5. Project insights</h2>
          {insights}
          {utilization}
          {field("projectUpdates", undefined, false)}
        </section>
        <section className={styles.block}>
          <h2>6. Special initiatives</h2>
          {field("specialInitiatives", "Zoomhub, marketing, LinkedIn, client portal…")}
        </section>
        <section className={styles.block}>
          <h2>7. Technology &amp; equipment</h2>
          {field("technology", "Software releases and equipment news worth sharing.")}
        </section>
        <section className={styles.block}>
          <h2>8. Breakout sessions</h2>
          {field("breakouts")}
        </section>
      </div>
    </div>
  );
}
