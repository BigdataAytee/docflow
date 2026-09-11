/**
 * The page header (§F, §G). Blue gradient, rounded bottom, blending its lower
 * edge into the page. Per-type pages pass that type's accent so the header
 * carries the internal type's colour, never the label's (§F).
 */

import type { ReactNode } from 'react'

export interface PageHeaderProps {
  /** Already resolved through the locale layer (Rule #5). */
  readonly title: string
  readonly eyebrow?: string
  readonly subtitle?: string
  /** The §F accent for this page's internal type. Defaults to brand blue. */
  readonly accent?: string
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  accent = '#2b3fd6',
  leading,
  trailing,
}: PageHeaderProps) {
  return (
    <header
      className="rounded-b-2xl px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white"
      style={{ background: `linear-gradient(160deg, ${accent} 0%, ${accent}e6 55%, ${accent}cc 100%)` }}
    >
      <div className="flex items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          {eyebrow !== undefined && (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-80">
              {eyebrow}
            </p>
          )}
          {/* Never truncates: §F requires the longest shipped label to wrap
              or the container to grow, never to clip or shrink. */}
          <h1 className="break-words text-xl font-bold leading-tight">{title}</h1>
          {subtitle !== undefined && <p className="mt-0.5 text-sm opacity-85">{subtitle}</p>}
        </div>
        {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
      </div>
    </header>
  )
}
