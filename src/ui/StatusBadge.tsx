/**
 * The status badge (§Q Phase 2: "StatusBadge with the single colour map").
 *
 * It takes an already-resolved LABEL, never a type name it looks up itself —
 * words come from `src/domain/locale` (Rule #5) and colour from `toneFor`.
 */

import { type StatusTone, TONE_PALETTE, toneFor } from './tokens'

export interface StatusBadgeProps {
  /** The stored or derived status token, e.g. 'overdue'. Decides the colour. */
  readonly status: string
  /** The words to show, already resolved through the locale layer. */
  readonly label: string
  readonly tone?: StatusTone
}

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const palette = TONE_PALETTE[tone ?? toneFor(status)]
  return (
    <span
      className={`inline-flex min-h-[24px] items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${palette.className}`}
      // Never rely on colour alone (§K): the label carries the meaning and the
      // role gives assistive tech something to announce.
      role="status"
    >
      {label}
    </span>
  )
}
