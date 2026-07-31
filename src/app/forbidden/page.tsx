import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const session = await requireUser("/forbidden");
  return (
    <AppShell user={session.user}>
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Access restricted</p>
          <h1>You do not have permission for this page.</h1>
          <p className="lede">Your current dashboard role is {session.user.role}.</p>
          <Link className="button button--primary" href="/dashboard">
            Return to dashboard
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
