/**
 * The page header (§F, §G). Blue gradient, rounded bottom, blending its lower
 * edge into the page. Per-type pages pass that type's accent so the header
 * carries the internal type's colour, never the label's (§F).
 */

import type { ReactNode } from 'react'

export interface PageHeaderProps {
  /**
   * The way back off a detail screen.
   *
   * Given, this draws a back control at the head of the page. It exists
   * because primary navigation does NOT appear on detail screens — and when
   * the nav pill was removed from the saved document, that screen had no way
   * off it at all: no back control had ever been needed while a floating pill
   * was sitting on every page.
   *
   * Android's hardware button still worked, which is exactly the trap: the
   * one platform being tested hid a screen with no exit on every other.
   *
   * It goes through `history.back()` at the call site rather than to a fixed
   * path, so Customers → customer → invoice → Back reaches the CUSTOMER and
   * not Home.
   */
  readonly onBack?: () => void
  /** The localised word for it — Rule #4 keeps strings out of this file. */
  readonly backLabel?: string
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
  onBack,
  backLabel,
}: PageHeaderProps) {
  return (
    <header
      className="rounded-b-2xl px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white"
      style={{ background: `linear-gradient(160deg, ${accent} 0%, ${accent}e6 55%, ${accent}cc 100%)` }}
    >
      {onBack !== undefined && (
        <button
          type="button"
          onClick={onBack}
          /*
            A full tap target and its own row, above the title rather than
            beside it: §F caps the title at no truncation, and a control
            sharing that line is a control competing with a heading that is
            allowed to wrap to three lines.
          */
          className="tap-scale -ms-1 mb-1 flex min-h-tap items-center gap-1 text-[13px] font-semibold text-white/90"
        >
          <span aria-hidden="true">←</span>
          {backLabel ?? 'Back'}
        </button>
      )}

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
