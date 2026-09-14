/**
 * The quick chips under the inline calendar (§G step 1).
 *
 * "Per-type quick chips (Today · 7/14/30 days for invoice due; Today ·
 * Tomorrow for a delivery; Today · Yesterday for receipt date-paid)."
 *
 * They are the reason the calendar is worth building at all: a native date
 * picker cannot offer "30 days" and cannot know that 30 days means thirty days
 * after the ISSUE date rather than thirty days from now. Every chip here saves
 * the taps that a month-grid would otherwise cost, which is Rule #1 applied to
 * the single most-used field in the app.
 *
 * Pure, and keyed by the INTERNAL type, so the table can be tested without a
 * calendar, a locale or a screen — and so a Delivery note offers what a
 * Waybill offers, because they are the same document (§D).
 *
 * Dates are plain `YYYY-MM-DD` throughout, and the arithmetic lives in
 * `src/domain/dates/calendar` — see the note there on why an instant and a
 * day are not the same thing.
 */

import type { DocumentType } from '../../domain/documents/types'
import { addDays, parseIsoDay, todayIso, toIsoDay } from '../../domain/dates/calendar'

/*
 * The calendar primitives moved to `src/domain/dates/calendar`, because six
 * other places needed them and two of them were answering money questions in
 * UTC. Re-exported here so this module's own callers did not have to care
 * where they went — and so there is exactly one implementation.
 */
export { addDays, todayIso, toIsoDay }
export { parseIsoDay as parseIsoDate, toIsoDay as toIsoDate }

/** Which of step 1's two date fields a chip row belongs to. */
export type DateSlot = 'first' | 'second'

/**
 * A chip is a WORD plus an offset, never a pre-computed date: the offset is
 * applied at tap time, against a base that may itself have changed since the
 * card was drawn.
 */
export interface DateChip {
  /** Chooses the word. `days` carries the count into "{days} days". */
  readonly kind: 'today' | 'tomorrow' | 'yesterday' | 'days'
  /** Days from the slot's base date. Negative reaches backwards. */
  readonly offset: number
}

const TODAY: DateChip = { kind: 'today', offset: 0 }

/**
 * §G's table, transcribed.
 *
 * A receipt has no second date — it records when money arrived, and there is
 * nothing to fall due — so its second slot is empty rather than absent, which
 * keeps the lookup total.
 */
const CHIPS: Readonly<Record<DocumentType, Readonly<Record<DateSlot, readonly DateChip[]>>>> = {
  invoice: {
    first: [TODAY],
    second: [
      { kind: 'days', offset: 7 },
      { kind: 'days', offset: 14 },
      { kind: 'days', offset: 30 },
    ],
  },
  quotation: {
    first: [TODAY],
    second: [
      { kind: 'days', offset: 14 },
      { kind: 'days', offset: 30 },
    ],
  },
  receipt: {
    // "Today · Yesterday": money that arrived after hours is entered the next
    // morning, and that is the common case rather than the edge one.
    first: [TODAY, { kind: 'yesterday', offset: -1 }],
    second: [],
  },
  waybill: {
    first: [TODAY],
    second: [TODAY, { kind: 'tomorrow', offset: 1 }],
  },
}

export const chipsFor = (type: DocumentType, slot: DateSlot): readonly DateChip[] =>
  CHIPS[type][slot]

/**
 * What a chip resolves to.
 *
 * The base is the point §G's wording implies and a native picker cannot
 * express: the FIRST field counts from today, the SECOND counts from whatever
 * the first field says. "30 days" on an invoice is thirty days of credit from
 * the issue date — not thirty days from the moment somebody happened to tap.
 */
export function applyChip(chip: DateChip, slot: DateSlot, firstDate: string, today: string): string {
  const base = slot === 'first' ? today : (firstDate === '' ? today : firstDate)
  return addDays(base, chip.offset)
}
