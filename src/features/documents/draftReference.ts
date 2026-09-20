/**
 * What a draft is called, everywhere (§G, §M).
 *
 * A draft has no issued reference — §M mints one at issue and freezes it — so
 * every surface that lists documents had to answer "what do I put in the
 * number column" on its own. Five of them did, and they did not agree:
 *
 *  · the builder's number card said `INV-0005-0P`, the number this draft
 *    would actually be given;
 *  · the list page, the customer's history, the search index and the
 *    document's own preview all said `INV-…`.
 *
 * Two answers for one document. Somebody moving between the list and the
 * builder saw different things and had to work out which was real — and the
 * ellipsis is machinery showing through either way: it is not something
 * anybody can read back over a phone.
 *
 * ONE ANSWER NOW, computed here and read by all five. It is still only an
 * OFFER: nothing is stored, and the sequence is worked out again at issue,
 * which is later and therefore more nearly right. Typing over it is what
 * makes an override, and an override is what gets shown once it exists.
 *
 * AND IT STILL LOOKS LIKE A DRAFT. `provisional` travels beside the text so
 * each surface can mute it. A real-looking number sitting unmarked in a
 * column of real ones would be the opposite mistake to the one being fixed:
 * a draft should look like a draft everywhere, not like nothing in one place
 * and something final in another.
 */

import { numberingPrefix } from '../../domain/locale/profile'
import type { LocaleProfile } from '../../domain/locale/profile'
import type { DocumentType } from '../../domain/documents/types'
import { suggestedReference } from './reference'

/** The little a document has to carry to be numbered. */
export interface NumberableDocument {
  readonly type: DocumentType
  readonly issuedReference?: string | null
  /** §G's pencil, on a draft that has one. */
  readonly referenceOverride?: string | undefined
  readonly status?: string
}

export interface NumberingContext {
  /** Every document, so the offer steps over what is already taken (§M). */
  readonly documents: readonly NumberableDocument[]
  /** The company's own prefixes, where it set any (§M). */
  readonly prefixes: Readonly<Partial<Record<DocumentType, string>>> | undefined
  readonly profile: LocaleProfile
  readonly deviceId: string
}

/** The prefix this company uses for a type, falling back to the locale (§D). */
export const prefixFor = (
  context: Pick<NumberingContext, 'prefixes' | 'profile'>,
  type: DocumentType,
): string => context.prefixes?.[type] ?? numberingPrefix(context.profile, type)

/**
 * The number a new document of this type would be offered.
 *
 * Computed from what is already ISSUED, so it steps over a voided one rather
 * than into it — §M refuses a duplicate at the database, which is correct and
 * happens at the worst possible moment, with a customer waiting.
 */
export const offeredReference = (context: NumberingContext, type: DocumentType): string =>
  suggestedReference({
    prefix: prefixFor(context, type),
    references: context.documents
      .filter((document) => document.type === type)
      .map((document) => document.issuedReference),
    deviceId: context.deviceId,
  })

export interface ShownReference {
  readonly text: string
  /** True while this is an offer rather than a frozen fact. */
  readonly provisional: boolean
}

/**
 * What to print in a number column for one document.
 *
 * Issued first, always: a frozen reference outranks everything, including an
 * override that was only ever an instruction for an issue that has happened
 * (Rule #5). Then the owner's own typed number, then the offer.
 */
export function shownReference(
  context: NumberingContext,
  document: NumberableDocument,
): ShownReference {
  if (document.issuedReference !== undefined && document.issuedReference !== null) {
    return { text: document.issuedReference, provisional: false }
  }
  if (document.referenceOverride !== undefined && document.referenceOverride !== '') {
    // Typed by hand and not yet issued: theirs, but still not a fact.
    return { text: document.referenceOverride, provisional: true }
  }
  return { text: offeredReference(context, document.type), provisional: true }
}
