/**
 * §F design tokens, as one map each.
 *
 * Two rules this file exists to enforce:
 *  · Type colour belongs to the INTERNAL type and never changes with the
 *    label — "a Delivery note is amber everywhere a Waybill is" (§F).
 *  · Status colour comes from ONE map (§Q names it "StatusBadge with the
 *    single colour map"), so no surface invents its own palette.
 *
 * No display text lives here. Words come from `src/domain/locale`.
 */

import type { DocumentType } from '../domain/documents/types'
import type { IconName } from './Icon'

export interface TypePalette {
  readonly accent: string
  /**
   * The light stop, for the three-stop gradients the design uses on heroes,
   * FABs and primary buttons.
   *
   * Not in the F table, which fixes accent/tint/deep. It comes from the
   * prototype, which is the reference for what F describes without
   * quantifying — and a gradient needs a lighter end than the accent or it
   * is a flat fill with extra steps.
   */
  readonly light: string
  readonly tint: string
  readonly deep: string
  /**
   * Tabler icon name. Fixed to the internal type, like the colour (§F).
   *
   * Typed as `IconName` rather than `string` so §F's four pairings are
   * checked against what the bundled set can actually draw — a renamed glyph
   * becomes a type error here instead of an empty square on Home.
   */
  readonly icon: IconName
}

export const TYPE_PALETTE: Readonly<Record<DocumentType, TypePalette>> = {
  invoice: { accent: '#2b3fd6', light: '#4a60ee', tint: '#e6ebff', deep: '#1e2fae', icon: 'file-invoice' },
  quotation: { accent: '#534AB7', light: '#7b70e2', tint: '#EEEDFE', deep: '#3C3489', icon: 'file-check' },
  receipt: { accent: '#0F6E56', light: '#26b489', tint: '#E1F5EE', deep: '#085041', icon: 'receipt' },
  waybill: { accent: '#BA7517', light: '#f0a731', tint: '#FAEEDA', deep: '#854F0B', icon: 'truck-delivery' },
}

/** The four status tones of §F. Everything a badge can be resolves to one. */
export type StatusTone = 'info' | 'good' | 'warn' | 'bad' | 'neutral'

/**
 * The tone palette, as CLASSES rather than hex.
 *
 * It was a map of literal colours applied through an inline `style`, and that
 * is why it was the one part of the app dark mode did not reach: an inline
 * style cannot know about a theme. The badges stayed pale-blue-on-white over a
 * dark page — a bug invisible to the class scan, because there were no classes
 * to scan.
 *
 * §F's hues are unchanged; the classes resolve to the same values in light and
 * to the dark washes in dark.
 */
export interface TonePalette {
  /** Tailwind classes for text and background together. */
  readonly className: string
}

export const TONE_PALETTE: Readonly<Record<StatusTone, TonePalette>> = {
  info: { className: 'text-status-info bg-status-info-tint' },
  good: { className: 'text-status-good bg-status-good-tint' },
  warn: { className: 'text-status-warn bg-status-warn-tint' },
  bad: { className: 'text-status-bad bg-status-bad-tint' },
  neutral: { className: 'text-ink bg-page' },
}

/**
 * The single status → tone map. Covers every stored status of every type and
 * every derived state, so a badge can never fall through to an invented colour.
 */
const TONE_OF: Readonly<Record<string, StatusTone>> = {
  // stored, shared
  draft: 'neutral',
  issued: 'neutral',
  void: 'bad',
  // invoice / quotation
  sent: 'info',
  accepted: 'good',
  rejected: 'bad',
  // waybill
  dispatched: 'info',
  in_transit: 'info',
  delivered: 'good',
  // derived (§C — computed at read time, never stored)
  unpaid: 'warn',
  partially_paid: 'warn',
  paid: 'good',
  overdue: 'warn',
  expired: 'bad',
  // money direction, for analytics and expenses (§F coral is "money out")
  money_out: 'bad',
  settled: 'good',
}

export const toneFor = (status: string): StatusTone => TONE_OF[status] ?? 'neutral'

/** Every status token the map knows. Used by the completeness test. */
export const MAPPED_STATUSES: readonly string[] = Object.keys(TONE_OF)
