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
  | { kind: "clean" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; message: string; conflict: boolean };

/** Notes save themselves this long after the last keystroke. */
const AUTOSAVE_MS = 1500;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function NoteField({
  title,
  value,
  onChange,
  placeholder,
  hideTitle = false,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** When the section heading already says it, keep the label for screen readers only. */
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, 64)}px`;
  }, [value]);
  return (
    <label className={styles.note}>
      <span className={hideTitle ? styles.srOnly : undefined}>{title}</span>
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
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
  const open = items.filter((item) => !item.done).length;
  return (
    <div className={styles.actionItems}>
      <h3>
        Action items <span className={styles.count}>{open} open</span>
      </h3>
      {items.length ? null : (
        <p className={styles.muted}>No follow-ups yet. Add one as deals come up.</p>
      )}
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
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const id = newId();
                  setFocusId(id);
                  onChange([...items, { id, text: "", done: false }]);
                }
              }}
            />
            <span className={styles.printText}>
              {item.done ? "✓ " : "☐ "}
              {item.text}
            </span>
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
        className={styles.addButton}
        onClick={() => {
          const id = newId();
          setFocusId(id);
          onChange([...items, { id, text: "", done: false }]);
        }}
      >
        + Add action item
      </button>
      <p className={styles.muted}>
        Press Enter for another. Open items carry into next week; checked ones drop off.
      </p>
    </div>
  );
}

type AgendaSection = {
  id: string;
  title: string;
  minutes: number;
  accent: string;
  body: ReactNode;
};

export function AllHandsWorkspace({
  weekStart,
  initialNotes,
  initialVersion,
  carriedFrom,
  lastSaved,
  scheduledHost,
  nextWeekHost,
  glance,
  wins,
  weekAhead,
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
  glance: ReactNode;
  wins: ReactNode;
  weekAhead: ReactNode;
  pipeline: ReactNode;
  insights: ReactNode;
  utilization: ReactNode;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [version, setVersion] = useState(initialVersion);
  const [state, setState] = useState<SaveState>({ kind: "clean" });
  const [savedLabel, setSavedLabel] = useState(lastSaved);
  const edits = useRef(0);
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [sectionStarted, setSectionStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const change = <K extends keyof AllHandsNotes>(key: K, value: AllHandsNotes[K]) => {
    edits.current += 1;
    setNotes((latest) => ({ ...latest, [key]: value }));
    // A conflict stops autosave until the page is reloaded, so nobody is overwritten.
    setState((latest) => (latest.kind === "error" && latest.conflict ? latest : { kind: "dirty" }));
  };

  const save = useCallback(async () => {
    const editsAtStart = edits.current;
    setState({ kind: "saving" });
    let result: Awaited<ReturnType<typeof saveAgendaNotes>>;
    try {
      result = await saveAgendaNotes({ weekStart, version, notes });
    } catch {
      setState({
        kind: "error",
        conflict: false,
        message: "Couldn't save. Check your connection; your notes are still here.",
      });
      return;
    }
    if (result.ok) {
      setVersion(result.version);
      setSavedLabel(`Saved ${timeLabel(result.savedAt)}`);
      // Typing during the save leaves the page dirty, so the next autosave picks it up.
      setState(edits.current === editsAtStart ? { kind: "clean" } : { kind: "dirty" });
    } else {
      setState({ kind: "error", conflict: result.conflict, message: result.message });
    }
  }, [notes, version, weekStart]);

  // Autosave shortly after the last change.
  useEffect(() => {
    if (state.kind !== "dirty") return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [state, save, notes]);

  const unsaved = state.kind === "dirty" || state.kind === "saving" || state.kind === "error";
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (state.kind !== "saving" && !(state.kind === "error" && state.conflict)) void save();
      }
    };
    const onLeave = (event: BeforeUnloadEvent) => {
      if (unsaved) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [unsaved, save, state]);

  const field = (key: NoteSectionKey, placeholder?: string, hideTitle = true) => {
    const section = NOTE_SECTIONS.find((item) => item.key === key)!;
    return (
      <NoteField
        title={section.title}
        placeholder={placeholder}
        hideTitle={hideTitle}
        value={notes[key]}
        onChange={(value) => change(key, value)}
      />
    );
  };

  const host = notes.hostOverride.trim() || scheduledHost;

  const sections: AgendaSection[] = [
    {
      id: "mission",
      title: "Mission Moment",
      minutes: 5,
      accent: "violet",
      body: (
        <div className={styles.mission}>
          {field(
            "missionMoment",
            "A client story, a thank-you, or why our work mattered this week…",
          )}
        </div>
      ),
    },
    {
      id: "wins",
      title: "Last week's wins",
      minutes: 5,
      accent: "green",
      body: wins,
    },
    {
      id: "calendar",
      title: "Calendar & week ahead",
      minutes: 5,
      accent: "blue",
      body: (
        <>
          <div className={styles.twoCol}>
            {field("calendar", "Tue – AEE WFH\nWed – HHM PTO\nThu/Fri – Office closed", false)}
            {field("longRange", "CPS – 12/2–12/4\nRBT – 12/10 (tent.)", false)}
          </div>
          {weekAhead}
        </>
      ),
    },
    {
      id: "announcements",
      title: "Announcements & requests",
      minutes: 5,
      accent: "amber",
      body: field("announcements", "Office news, team requests, reminders…"),
    },
    {
      id: "pipeline",
      title: "Pipeline",
      minutes: 15,
      accent: "teal",
      body: (
        <>
          {pipeline}
          <ActionItems
            items={notes.actionItems}
            onChange={(items) => change("actionItems", items)}
          />
        </>
      ),
    },
    {
      id: "projects",
      title: "Projects & utilization",
      minutes: 15,
      accent: "navy",
      body: (
        <>
          <div className={styles.twoCol}>
            {insights}
            {utilization}
          </div>
          {field("projectUpdates", "Updates the team should hear about…", false)}
        </>
      ),
    },
    {
      id: "initiatives",
      title: "Special initiatives",
      minutes: 5,
      accent: "pink",
      body: field("specialInitiatives", "Zoomhub, marketing, LinkedIn, client portal…"),
    },
    {
      id: "technology",
      title: "Technology & equipment",
      minutes: 3,
      accent: "slate",
      body: field("technology", "Software releases and equipment news worth sharing…"),
    },
    {
      id: "breakouts",
      title: "Breakout sessions",
      minutes: 2,
      accent: "gray",
      body: field("breakouts", "Topics for the 11:00 breakout…"),
    },
  ];
  const totalMinutes = sections.reduce((sum, section) => sum + section.minutes, 0);

  const go = (index: number) => {
    const next = Math.min(Math.max(index, 0), sections.length - 1);
    setCurrent(next);
    setSectionStarted(Date.now());
    if (presenting) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Presenter mode: a one-second clock for the section timer.
  useEffect(() => {
    if (!presenting) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [presenting]);

  // Presenter mode: arrow keys move between sections (not while typing), Esc exits.
  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, [contenteditable]");
      if (event.key === "Escape") setPresenting(false);
      if (typing) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") go(current + 1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const elapsed = Math.max(0, Math.floor((now - sectionStarted) / 1000));
  const active = sections[current];
  const overTime = elapsed > active.minutes * 60;

  const status =
    state.kind === "saving"
      ? "Saving…"
      : state.kind === "error"
        ? state.message
        : state.kind === "dirty"
          ? "Editing…"
          : version === 0
            ? carriedFrom
              ? "Carried over from last meeting · edits save automatically"
              : "Edits save automatically"
            : (savedLabel ?? "All changes saved");

  return (
    <div className={styles.workspace} data-presenting={presenting}>
      <section className={styles.hero} aria-label="This week at a glance">
        <div className={styles.hostCard}>
          <small>Hosting this week</small>
          <strong>{host}</strong>
          <span>
            {notes.hostOverride.trim() ? `Covering for ${scheduledHost} · ` : ""}
            Next week: {nextWeekHost}
          </span>
          <label className={styles.hostOverride}>
            <span>Someone covering?</span>
            <input
              type="text"
              value={notes.hostOverride}
              placeholder="Initials"
              maxLength={40}
              onChange={(event) => change("hostOverride", event.target.value)}
            />
          </label>
        </div>
        {glance}
      </section>

      <nav className={styles.agendaBar} aria-label="Agenda">
        <ol>
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#section-${section.id}`}
                data-accent={section.accent}
                aria-current={presenting && index === current ? "step" : undefined}
                onClick={(event) => {
                  if (presenting) {
                    event.preventDefault();
                    go(index);
                  }
                }}
              >
                <b>{index + 1}</b> {section.title} <small>{section.minutes}m</small>
              </a>
            </li>
          ))}
        </ol>
        <div className={styles.agendaActions}>
          <span className={styles.saveStatus} data-state={state.kind} role="status">
            {status}
          </span>
          <button type="button" className={styles.ghostButton} onClick={() => window.print()}>
            Print
          </button>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => {
              setPresenting((value) => !value);
              setSectionStarted(Date.now());
              setNow(Date.now());
            }}
          >
            {presenting ? "Exit presenting" : `▶ Present (${totalMinutes} min)`}
          </button>
        </div>
      </nav>

      <div className={styles.agenda}>
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className={styles.block}
            data-accent={section.accent}
            data-active={!presenting || index === current}
          >
            <header className={styles.blockHeader}>
              <span className={styles.number}>{index + 1}</span>
              <h2>{section.title}</h2>
              <small>{section.minutes} min</small>
            </header>
            {section.body}
          </section>
        ))}
      </div>

      {presenting ? (
        <div className={styles.presenter} role="region" aria-label="Presenter controls">
          <button type="button" onClick={() => go(current - 1)} disabled={current === 0}>
            ← Back
          </button>
          <div>
            <strong>
              {current + 1} / {sections.length} · {active.title}
            </strong>
            <span data-over={overTime}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} of {active.minutes}
              :00
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              current === sections.length - 1 ? setPresenting(false) : go(current + 1)
            }
          >
            {current === sections.length - 1 ? "Finish ✓" : "Next →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
