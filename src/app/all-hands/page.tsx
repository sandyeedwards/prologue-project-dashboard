import Link from "next/link";
import { AllHandsWorkspace } from "@/components/all-hands-workspace";
import { AppShell } from "@/components/app-shell";
import { addWeeks, mondayOf, parseWeek, scheduledHost } from "@/lib/all-hands/agenda";
import {
  getAgendaNotes,
  getLastSyncAt,
  getLastWeekUtilization,
  getPipelineState,
  getProjectInsights,
} from "@/lib/all-hands/all-hands-data";
import { roleAllows } from "@/lib/auth/authorization";
import { requireUser } from "@/lib/auth/session";
import { dateLabel, easternIsoDate, reportingTimestamp } from "@/lib/reporting/format";
import styles from "./all-hands.module.css";
import { Insights, Pipeline, Utilization } from "./sections";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** On a weekend, the agenda being prepared is next Monday's. */
function defaultWeek(today: string): string {
  const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6 ? addWeeks(mondayOf(today), 1) : mondayOf(today);
}

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    console.error("[all-hands]", error);
    return null;
  }
}

export default async function AllHandsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUser("/all-hands");
  const params = await searchParams;
  const requested = typeof params.week === "string" ? parseWeek(params.week) : null;
  const weekStart = requested ?? defaultWeek(easternIsoDate());
  const canSeePeople = roleAllows(session.user.role, "MANAGER");

  const [notes, pipeline, insights, utilization, lastSyncAt] = await Promise.all([
    getAgendaNotes(weekStart),
    getPipelineState(),
    settle(getProjectInsights()),
    settle(getLastWeekUtilization(weekStart, canSeePeople)),
    settle(getLastSyncAt()),
  ]);

  return (
    <AppShell user={session.user}>
      <main className={`shell shell--wide ${styles.page}`}>
        <section className="report-titlebar report-titlebar--executive">
          <div className="report-titlebar__copy">
            <p className="eyebrow">Prologue scheduling, PM &amp; alignment · Mondays 10–11</p>
            <h1>All-Hands · Week of {dateLabel(weekStart)}</h1>
            <p>
              The Monday agenda. Pipeline, projects and utilization fill in on their own; type the
              rest below. Breakout 11–11:30.
            </p>
          </div>
          <div className="report-titlebar__actions">
            <nav className={styles.weekNav} aria-label="Meeting week">
              <Link
                className="button button--secondary"
                href={`/all-hands?week=${addWeeks(weekStart, -1)}`}
              >
                ← Previous week
              </Link>
              <Link
                className="button button--secondary"
                href={`/all-hands?week=${addWeeks(weekStart, 1)}`}
              >
                Next week →
              </Link>
            </nav>
            <Link className="button button--primary" href="/mmm">
              MMM
            </Link>
            <span className="report-date-chip">
              Data as of {lastSyncAt ? reportingTimestamp(lastSyncAt) : "Missing"}
            </span>
          </div>
        </section>
        <AllHandsWorkspace
          key={weekStart}
          weekStart={weekStart}
          initialNotes={notes.notes}
          initialVersion={notes.version}
          carriedFrom={notes.carriedFrom}
          lastSaved={
            notes.updatedAt
              ? `Last saved ${reportingTimestamp(notes.updatedAt)}${notes.updatedBy ? ` by ${notes.updatedBy}` : ""}`
              : null
          }
          scheduledHost={scheduledHost(weekStart)}
          nextWeekHost={scheduledHost(addWeeks(weekStart, 1))}
          pipeline={<Pipeline state={pipeline} />}
          insights={<Insights insights={insights} />}
          utilization={<Utilization data={utilization} />}
        />
      </main>
    </AppShell>
  );
}
