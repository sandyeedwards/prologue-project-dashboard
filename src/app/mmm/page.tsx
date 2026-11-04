import { AppShell } from "@/components/app-shell";
import { MeetingWorkspace } from "@/components/meeting-workspace";
import { requireUser } from "@/lib/auth/session";
import { getMeetingReport } from "@/lib/reporting/mmm-data";

export const dynamic = "force-dynamic";

export default async function MondayMeetingPage() {
  const session = await requireUser("/mmm");
  const report = await getMeetingReport();
  let teamworkBase: string | null = null;
  try {
    const source = new URL(process.env.TEAMWORK_SITE_URL ?? "");
    if (source.protocol === "https:") teamworkBase = source.origin;
  } catch {
    /* Source buttons remain hidden until a site URL is configured. */
  }
  return (
    <AppShell user={session.user}>
      <MeetingWorkspace
        projects={report.projects}
        window={report.window}
        teamworkBase={teamworkBase}
      />
    </AppShell>
  );
}
