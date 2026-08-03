export default function Loading() {
  return (
    <main
      className="shell shell--wide app-state app-state--loading"
      aria-busy="true"
      aria-label="Loading project reporting data"
    >
      <div className="app-state__heading">
        <span className="app-state__pulse" />
        <div>
          <strong>Preparing portfolio intelligence</strong>
          <span>Loading project financials, effort, and reporting coverage.</span>
        </div>
      </div>
      <div className="app-state__skeleton-grid" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="app-state__skeleton-panel" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </main>
  );
}
