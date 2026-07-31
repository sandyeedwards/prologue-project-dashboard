import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/authorization";
import { PrologueBrand } from "@/components/prologue-brand";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_state: "That sign-in request expired or was already used. Please try again.",
  token_exchange_failed: "Teamwork could not complete the sign-in request.",
  userinfo_unavailable: "Teamwork did not return the employee identity needed to sign in.",
  TEAMWORK_INSTALLATION_NOT_ALLOWED: "Please sign in with the Prologue Systems Teamwork account.",
  TEAMWORK_USER_NOT_ELIGIBLE: "This Teamwork account is not an active internal Prologue employee.",
  DASHBOARD_USER_DISABLED: "Dashboard access for this employee is disabled.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const loginUrl = `/api/auth/teamwork/start?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-card__brand-panel">
          <PrologueBrand subtitle="Internal project intelligence" markHeight={104} />
          <p>
            A secure, read-only reporting workspace for project health, labor, cost, forecasting,
            and profitability.
          </p>
        </div>
        <div className="auth-card__content">
          <p className="eyebrow">Secure employee access</p>
          <h1 className="auth-card__title">Sign in to project reporting</h1>
          <p className="lede">
            Use your Prologue Teamwork account. Employee login tokens are not retained, and the
            central reporting connection remains separate.
          </p>
          {params.error && (
            <p className="notice notice--error">
              {errorMessages[params.error] ?? "Sign-in could not be completed."}
            </p>
          )}
          {params.signedOut && <p className="notice">You have been signed out.</p>}
          <Link className="button button--primary button--large" href={loginUrl}>
            Continue with Teamwork
          </Link>
        </div>
      </section>
    </main>
  );
}
