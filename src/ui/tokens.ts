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

export interface TypePalette {
  readonly accent: string
  readonly tint: string
  readonly deep: string
  /** Tabler icon name. Fixed to the internal type, like the colour (§F). */
  readonly icon: string
}

export const TYPE_PALETTE: Readonly<Record<DocumentType, TypePalette>> = {
  invoice: { accent: '#2b3fd6', tint: '#e6ebff', deep: '#1e2fae', icon: 'file-invoice' },
  quotation: { accent: '#534AB7', tint: '#EEEDFE', deep: '#3C3489', icon: 'file-check' },
  receipt: { accent: '#0F6E56', tint: '#E1F5EE', deep: '#085041', icon: 'receipt' },
  waybill: { accent: '#BA7517', tint: '#FAEEDA', deep: '#854F0B', icon: 'truck-delivery' },
}

/** The four status tones of §F. Everything a badge can be resolves to one. */
export type StatusTone = 'info' | 'good' | 'warn' | 'bad' | 'neutral'

export interface TonePalette {
  readonly fg: string
  readonly bg: string
}

export const TONE_PALETTE: Readonly<Record<StatusTone, TonePalette>> = {
  info: { fg: '#185FA5', bg: '#E6F1FB' },
  good: { fg: '#0F6E56', bg: '#E1F5EE' },
  warn: { fg: '#854F0B', bg: '#FAEEDA' },
  bad: { fg: '#993C1D', bg: '#FAECE7' },
  neutral: { fg: '#1d2452', bg: '#eef2fb' },
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
