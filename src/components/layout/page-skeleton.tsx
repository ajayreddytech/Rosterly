/** Lightweight loading state shown while per-user data streams in. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6" role="status" aria-label="Loading">
      <div className="h-16 animate-pulse rounded-2xl border border-amber-500/10 bg-slate-900/60" />
      <div className="mt-6 h-12 animate-pulse rounded-2xl border border-amber-500/10 bg-slate-900/60" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-amber-500/10 bg-slate-900/60" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
