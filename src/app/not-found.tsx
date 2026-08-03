import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell app-state app-state--error">
      <section>
        <p className="eyebrow">Report not found</p>
        <h1>This project view is unavailable.</h1>
        <p>
          The project may have been removed from the reporting set, archived, or excluded from the
          current workspace.
        </p>
        <Link className="button button--primary" href="/projects">
          Return to projects
        </Link>
      </section>
    </main>
  );
}
