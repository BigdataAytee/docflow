/**
 * Skeletons, not spinners (§C: "No spinners, no blank screens").
 *
 * Sheen stops under reduced motion (§F), which is why the shimmer is a
 * motion-safe variant rather than an always-on animation.
 */

export interface SkeletonProps {
  readonly className?: string
  /** What is loading, for assistive tech. */
  readonly label?: string
}

export function Skeleton({ className = 'h-4 w-full', label }: SkeletonProps) {
  return (
    <span
      className={`block rounded-lg bg-ink/10 motion-safe:animate-pulse ${className}`}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      role={label === undefined ? undefined : 'status'}
    />
  )
}

/** A list placeholder shaped like the rows it stands in for. */
export function SkeletonList({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label ?? 'Loading'} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-2xl p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}
