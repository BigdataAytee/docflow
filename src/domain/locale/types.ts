/**
 * The shape of a locale profile (§D). Phase 0 ships the DATA — the resolution
 * layer that reads it is Phase 1 (§Q), built before builders, PDFs and search,
 * all of which depend on it.
 *
 * One profile, chosen once, drives everything regional. The internal model never
 * changes: a delivery document is always `type: "waybill"` in the database
 * everywhere on Earth; only presentation adapts.
 */

import type { DocumentType } from '../documents/types'

export type LocaleId = string

/**
 * Rule #1 of §D: machine translation is a draft, never a release. A table stays
 * `draft` until a native speaker of that launch market signs it off, and the
 * Phase 1 resolver refuses to serve a `draft` table in a release build.
 */
export type ReviewStatus = 'draft' | 'in_review' | 'approved'

/** Everything a document type is called, on every surface, in one locale. */
export interface TypeTerminology {
  /** The name standing alone — a tile, a list heading, a builder title. */
  readonly label: string
  /**
   * The same word inside a sentence: "New invoice", "Save bon de livraison".
   *
   * The singular twin of `pluralInSentence`, and it exists for the same
   * reason: case is part of the word, and which part depends on the language.
   * See the note there.
   */
  readonly labelInSentence: string
  /** Plural, standing on its own — a list hero's heading, a tile. */
  readonly pluralLabel: string
  /**
   * Plural, inside a sentence: "4 invoices", "3 bons de livraison".
   *
   * A separate field rather than `pluralLabel.toLocaleLowerCase()`, because
   * CASE IS NOT A TRANSFORM — it is part of the word, and which part depends
   * on the language. English and French lower a common noun mid-sentence;
   * Arabic has no case at all, so the two forms are identical; German would
   * keep every noun capitalised, and lowercasing it there is a spelling
   * mistake rather than a style choice.
   *
   * Lowercasing at the call site gets English right and quietly gets the next
   * language wrong, in a place nobody looks — which is exactly the failure §D
   * exists to prevent.
   */
  readonly pluralInSentence: string
  /** The heading printed on the PDF. Usually the label; EN-US quotations differ. */
  readonly printedTitle: string
  /** Customer / Client / Deliver to / Received from (§G step 1). */
  readonly partyLabel: string
  /** AUTHORISED SIGNATURE / PREPARED BY / ISSUED BY / DISPATCHED BY (§I). */
  readonly signatureCaption: string
  /** The five builder step names, in order (§G). */
  readonly steps: readonly [string, string, string, string, string]
  /** Suggested numbering prefix. The user's configured prefix always wins (§D). */
  readonly numberingPrefix: string
}

/** Headings shared across types, resolved through the same lookup. */
export interface SharedTerminology {
  /** The invoice payment-box heading (§I). */
  readonly howToPay: string
  /** The delivery document's replacement for the payment box (§I). */
  readonly receivedBy: string
  /** The quotation's total line (§H). */
  readonly estimatedTotal: string
}

export interface TerminologyTable {
  readonly locale: LocaleId
  /** The language its strings are written in — independent of region (§S). */
  readonly language: 'en' | 'fr' | 'es' | 'ar'
  readonly direction: 'ltr' | 'rtl'
  readonly reviewStatus: ReviewStatus
  /** Who signed it off, once approved. Empty while it is a draft. */
  readonly reviewedBy?: string
  readonly types: Readonly<Record<DocumentType, TypeTerminology>>
  readonly shared: SharedTerminology
  /**
   * Regional words the extractors must accept as the same internal type (§D.5,
   * §N). "make a delivery note for Okoro" creates a waybill-typed document.
   */
  readonly synonyms: Readonly<Record<DocumentType, readonly string[]>>
}

/** Nothing unreviewed reaches a user. Enforced at the Phase 1 resolver boundary. */
export const isReleasable = (table: TerminologyTable): boolean =>
  table.reviewStatus === 'approved'
