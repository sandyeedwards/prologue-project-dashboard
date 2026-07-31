"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell app-state app-state--error">
      <section>
        <p className="eyebrow">Reporting interruption</p>
        <h1>We could not load this report.</h1>
        <p>The application encountered an unexpected error while preparing the requested project data. Your source data has not been changed.</p>
        <button className="button button--primary" type="button" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
