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
   * The accent used as INK — a word painted in the type's colour.
   *
   * A different token from `accent`, because a fill and a letterform are
   * read differently: waybill amber makes a perfectly good band and a 3.5:1
   * heading, and in dark mode every accent-coloured word in the app measured
   * between 1.2 and 2.2 against the surface under it. Resolved through a CSS
   * variable so it follows the theme; `accent` stays §F's locked value and
   * keeps painting every fill, border and icon it always did.
   */
  readonly ink: string
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
  invoice: { accent: '#2b3fd6', light: '#4a60ee', tint: '#e6ebff', deep: '#1e2fae', ink: 'rgb(var(--invoice-ink))', icon: 'file-invoice' },
  quotation: { accent: '#534AB7', light: '#7b70e2', tint: '#EEEDFE', deep: '#3C3489', ink: 'rgb(var(--quotation-ink))', icon: 'file-check' },
  receipt: { accent: '#0F6E56', light: '#26b489', tint: '#E1F5EE', deep: '#085041', ink: 'rgb(var(--receipt-ink))', icon: 'receipt' },
  waybill: { accent: '#BA7517', light: '#f0a731', tint: '#FAEEDA', deep: '#854F0B', ink: 'rgb(var(--waybill-ink))', icon: 'truck-delivery' },
}

/**
 * The band a type's screens are headed with (§F, §G).
 *
 * §G asks for the hero, and §F fixes the hue. What was NOT fixed anywhere is
 * the order of the stops, and the order is what decides whether the words on
 * the band can be read.
 *
 * IT USED TO RUN LIGHT → ACCENT → DEEP, and every band puts its text in the
 * top-left corner — which is where the gradient started, and therefore the
 * palest part of it. On the delivery type that meant white at 75% over
 * `#f0a731`, which measures 1.87:1. The eyebrow, the count line and the
 * button on every list, every builder and every document header were all in
 * that corner.
 *
 * So it runs DEEP → ACCENT → LIGHT: the same three stops, the same hue, the
 * same lit-corner look, with the light end now under the decorative circle
 * instead of under the words. White on the deep stop is 6.8:1 on the palest
 * of the four and better on the rest.
 *
 * Declared here rather than written out at each band, because there are five
 * of them and the one that gets it wrong is the one nobody looks at.
 */
export const typeBand = (palette: TypePalette, angle = 140): string =>
  `linear-gradient(${angle}deg, ${palette.deep}, ${palette.accent} 80%, ${palette.light})`

/**
 * The fill of a CONTROL in a type's colour — a primary button, a header band.
 *
 * Not `typeBand`. A band is tall enough that text can sit at its dark end; a
 * pill is not, so the whole of it has to be dark enough for the white label
 * on it. The delivery accent is the one that decides this: white on #BA7517
 * is 3.77:1, under AA for anything but large text, so a control filled with
 * the bare accent cannot carry a label.
 *
 * So the accent stop is placed PAST the end of the box — the gradient runs
 * towards it and never arrives, stopping around 60% of the way. That keeps a
 * lit gradient rather than a flat fill, keeps §F's hue, and leaves the palest
 * point at 4.8:1 on the palest of the four.
 */
export const typeFill = (palette: TypePalette, angle = 160): string =>
  `linear-gradient(${angle}deg, ${palette.deep}, ${palette.accent} 165%)`

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
