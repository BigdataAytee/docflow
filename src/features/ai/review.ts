/**
 * The mandatory review (§N).
 *
 * §N: "extracted fields and line items shown before anything is finalized;
 * missing values, conflicts and OCR uncertainty highlighted; every value
 * editable; **model confidence never displayed as calibrated probability**.
 * Recovered content may autosave as a clearly-labelled unconfirmed local
 * draft, but **nothing issues a document, creates a payment, updates a
 * customer or completes a delivery without confirmation.** Failure always
 * offers 'Continue manually' with whatever was recovered."
 *
 * This is a GATE, not a screen. What matters is not that a review UI exists
 * but that no path around it does — so the rule is expressed in the shape:
 * an extraction becomes a draft only through `confirm`, and `confirm` takes
 * the EDITED values. There is deliberately no `toDraft(extraction)`. If one
 * existed, every future caller would have a way past the screen, and §N's
 * rule would hold only until somebody was in a hurry.
 */

import type { Extraction, ExtractedItem } from './extract'

/** Why a field is flagged. Never a number — §N forbids a fake probability. */
export type Flag = 'missing' | 'unreadable' | 'conflict'

export interface FieldReview {
  readonly field: string
  readonly flag: Flag
  /** The text it came from, so the owner sees what was actually said. */
  readonly source?: string
}

export interface ReviewState {
  readonly extraction: Extraction
  readonly flags: readonly FieldReview[]
  /** True only once a person has confirmed. Nothing derives it. */
  readonly confirmed: boolean
}

/**
 * What the review screen must highlight.
 *
 * Flags are CATEGORIES, deliberately. §N: "model confidence never displayed
 * as calibrated probability" — and a rules extractor has no probability at
 * all, so "87% sure" would be a number with nothing whatsoever behind it.
 * "This was not readable" is both true and actionable; a percentage is
 * neither.
 */
export function reviewOf(extraction: Extraction): ReviewState {
  const flags: FieldReview[] = []

  if (extraction.type === undefined) flags.push({ field: 'type', flag: 'missing' })
  if (extraction.customerName === undefined) flags.push({ field: 'customerName', flag: 'missing' })
  if (extraction.items.length === 0) flags.push({ field: 'items', flag: 'missing' })

  extraction.items.forEach((item, index) => {
    if (item.unitPriceMinor === undefined) {
      flags.push({ field: `items.${index}.unitPrice`, flag: 'missing', source: item.description })
    }
  })

  for (const text of extraction.uncertain) {
    flags.push({ field: 'items', flag: 'unreadable', source: text })
  }

  return { extraction, flags, confirmed: false }
}

/** Fields a person may correct. Everything extracted is editable (§N). */
export interface Corrections {
  readonly type?: Extraction['type']
  readonly customerName?: string
  readonly items?: readonly ExtractedItem[]
}

export interface ConfirmedDraft {
  readonly type?: Extraction['type']
  readonly customerName?: string
  readonly items: readonly ExtractedItem[]
  /** §N: the original is preserved all the way through. */
  readonly originalText: string
  /** Proof a person saw this. The only way to obtain one is `confirm`. */
  readonly confirmedAt: string
}

export class NotReviewed extends Error {}

export function confirm(state: ReviewState, corrections: Corrections, at: string): ConfirmedDraft {
  const type = corrections.type ?? state.extraction.type
  const customerName = corrections.customerName ?? state.extraction.customerName
  const items = corrections.items ?? state.extraction.items

  // A confirmed draft with no lines is not a document anybody meant to make.
  if (items.length === 0) {
    throw new NotReviewed('Nothing to save yet — add at least one line.')
  }

  return {
    ...(type === undefined ? {} : { type }),
    ...(customerName === undefined ? {} : { customerName }),
    items,
    originalText: state.extraction.originalText,
    confirmedAt: at,
  }
}

/**
 * §N: "Failure always offers 'Continue manually' with whatever was recovered."
 *
 * Returns the partial work, labelled — never nothing. A failure that discards
 * what it managed to read makes the person type it twice, which is the
 * opposite of what the feature is for.
 */
export function continueManually(extraction: Extraction): {
  readonly items: readonly ExtractedItem[]
  readonly originalText: string
  readonly unconfirmed: true
} {
  return { items: extraction.items, originalText: extraction.originalText, unconfirmed: true }
}
