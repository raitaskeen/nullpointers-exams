/** Instant skeleton while a route in the app loads - the shell stays put, only the content area waits. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="skeleton h-9 w-56 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-32 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-[var(--radius-card)]" />
    </div>
  );
}
