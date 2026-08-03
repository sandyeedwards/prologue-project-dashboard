import Link from "next/link";
import { PrologueBrand } from "@/components/prologue-brand";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  return (
    <main className="public-home">
      <section className="public-home__card">
        <PrologueBrand subtitle="Project intelligence for Prologue Systems" markHeight={112} />
        <div className="public-home__copy">
          <p className="eyebrow">Forecast with confidence</p>
          <h1>One trusted view of project performance.</h1>
          <p className="lede">
            Explore Teamwork project data, actual costs, forecast exposure, profitability, health,
            and source-data quality in a secure internal workspace.
          </p>
          <Link
            className="button button--primary button--large"
            href={session ? "/dashboard" : "/login"}
          >
            {session ? "Open dashboard" : "Employee sign in"}
          </Link>
        </div>
      </section>
    </main>
  );
}
