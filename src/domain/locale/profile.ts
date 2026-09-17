/**
 * The locale profile (§D) and the ONE lookup every surface resolves through.
 *
 * Rule #5 — one word everywhere. The tile, the list hero, the builder title,
 * the review screen, the PDF heading, the WhatsApp text and the analytics
 * labels all read the same resolution. No surface may carry its own string;
 * `docflow/no-hardcoded-type-name` fails the build on any that tries, and
 * `resolve.test.ts` asserts that rule still bites.
 */

import type { DocumentType } from '../documents/types'
import type { FrozenLabels } from '../documents/types'
import type { LocaleId, TerminologyTable, TypeTerminology } from './types'
import { DEFAULT_LOCALE, TERMINOLOGY_TABLES } from './data/terminology'

/**
 * A company's chosen profile. Region and language are independent (§S): a
 * French-speaking business in Lagos gets FR strings with NGN banking.
 *
 * THE LOCALE IS THE WHOLE PROFILE, and that is the point.
 *
 * This carried `labelOverrides` — a per-type custom name the owner typed into
 * Settings — and it has been removed at the owner's instruction: "it should
 * be an automatic thing the app is able to decide by itself." It already
 * could. `Africa/Lagos` resolves to NG, NG reads EN-NG, and EN-NG calls a
 * delivery a Waybill; a device in London resolves to GB and gets Delivery
 * note. Four text boxes asking somebody to type the word themselves were
 * asking them to do the one job the table exists to do.
 */
export interface LocaleProfile {
  /** Which terminology table to read (§D). The only thing that decides a word. */
  readonly locale: LocaleId
}

export class LocaleError extends Error {}

export const defaultProfile = (): LocaleProfile => ({ locale: DEFAULT_LOCALE })

export function tableFor(profile: LocaleProfile): TerminologyTable {
  const table = TERMINOLOGY_TABLES[profile.locale]
  if (table === undefined) {
    throw new LocaleError(`No terminology table for locale "${profile.locale}".`)
  }
  return table
}

/**
 * The single lookup. Everything else in this file is a named view of it, so a
 * surface cannot accidentally resolve a label a different way.
 */
export function resolve(profile: LocaleProfile, type: DocumentType): TypeTerminology {
  return tableFor(profile).types[type]
}

/** The name on a tile, a list hero, a builder header, a chip, the share text. */
export const label = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).label

/** The name inside a sentence — "New invoice". Cased by the locale, not here. */
export const labelInSentence = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).labelInSentence

/** The plural standing alone — a list hero's heading, a tile. */
export const pluralLabel = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).pluralLabel

/** The plural inside a sentence — "4 invoices". Cased by the locale, not here. */
export const pluralInSentence = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).pluralInSentence

/** The heading printed on the PDF. */
export const printedTitle = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).printedTitle

/** Bill to / Deliver to / Received from / Prepared for (§G step 1). */
export const partyLabel = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).partyLabel

/** AUTHORISED SIGNATURE / PREPARED BY / ISSUED BY / DISPATCHED BY (§I). */
export const signatureCaption = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).signatureCaption

/** The five builder step names, in order (§G). */
export const steps = (profile: LocaleProfile, type: DocumentType): readonly string[] =>
  resolve(profile, type).steps

/** The suggested prefix. A configured prefix always wins (§D). */
export const numberingPrefix = (profile: LocaleProfile, type: DocumentType): string =>
  resolve(profile, type).numberingPrefix

/** Headings shared across types — the payment box, the delivery rule. */
export const shared = (profile: LocaleProfile) => tableFor(profile).shared

export const direction = (profile: LocaleProfile): 'ltr' | 'rtl' =>
  tableFor(profile).direction

/**
 * Snapshot the labels into a document at issue (§D.2, §M). After this, a region
 * change, a sync or a later edit never rewrites them — a shared PDF does not
 * silently change language.
 */
export function freezeLabels(profile: LocaleProfile, type: DocumentType): FrozenLabels {
  const t = resolve(profile, type)
  return Object.freeze({
    printedTitle: t.printedTitle,
    partyLabel: t.partyLabel,
    signatureCaption: t.signatureCaption,
    language: tableFor(profile).language,
  })
}

/**
 * What a document is called *right now*, on any surface. An issued document
 * answers from its frozen snapshot; a draft follows the live profile.
 */
export function displayLabels(
  profile: LocaleProfile,
  type: DocumentType,
  frozen: FrozenLabels | null,
): FrozenLabels {
  return frozen ?? freezeLabels(profile, type)
}

/**
 * §D.3 — "Searching 'waybill' or 'delivery note' finds the same documents."
 * The index carries the internal type, the current label, and the frozen label
 * of an issued document, so a region change never loses a document.
 */
export function searchTerms(
  profile: LocaleProfile,
  type: DocumentType,
  frozen: FrozenLabels | null,
): string[] {
  const live = resolve(profile, type)
  const terms = new Set<string>([
    type,
    live.label,
    live.pluralLabel,
    live.printedTitle,
    ...tableFor(profile).synonyms[type],
  ])
  if (frozen !== null) terms.add(frozen.printedTitle)
  return [...terms].map((t) => t.toLocaleLowerCase())
}
