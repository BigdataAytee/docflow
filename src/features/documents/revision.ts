/**
 * Duplicate as Rev 2 (§G, §E, §M).
 *
 * §G lists it among a quotation's four actions. It is the answer to the most
 * ordinary thing that happens to a quotation: the customer says it is too
 * expensive, or it expired, or they want two more of something. The offer
 * changes, and the offer they already hold must not.
 *
 * Rules, each of which would be a bug the other way round:
 *
 *  · **The original is never altered** (§G, Rule #5). Nothing is written back
 *    — no "superseded" flag, no status change. The link lives on the NEW
 *    document as `supersedesId`, and "this one was replaced" is DERIVED by
 *    looking for a document carrying its id (Rule #3). The same shape as
 *    `convertedFromId`, for the same reason.
 *  · **Quotations only.** An invoice is a demand for money; correcting one is
 *    void, credit note or reissue (Rule #5), and a second invoice for the
 *    same work would be a second debt. A receipt is evidence of a payment. A
 *    delivery note's evidence seals. A quotation is the one document whose
 *    whole purpose is to be negotiated.
 *  · **The revision number counts the CHAIN, not the document duplicated.**
 *    Rev 2 revised again is Rev 3, not Rev 2 again — revising from the middle
 *    of a chain still produces the next number, because what a customer needs
 *    to know is which offer is the latest.
 *  · **A retried duplicate never duplicates** (§M). The key is derived from
 *    (root, revision number), so the same gesture twice is one document; and
 *    once a revision exists the UI offers to open it.
 *
 * What comes across is the work — party, lines, address, the signature — and
 * never the frozen reference, the frozen labels, or the status. Nor the
 * validity date: see `reviseDocument`.
 */

import type { DocumentType } from '../../domain/documents/types'
import type { LineItem } from '../../domain/documents/types'
import type { DocumentDraft } from './builder'

/** A token, not a sentence. The words are the catalogue's (§S, Rule #4). */
export class RevisionError extends Error {
  constructor(
    readonly field: 'not_revisable_type' | 'not_issued' | 'void',
    message: string,
  ) {
    super(message)
    this.name = 'RevisionError'
  }
}

/** What this module needs of a document. */
export interface RevisableDocument {
  readonly id: string
  readonly type: DocumentType
  readonly status: string
  readonly currency: string
  readonly customerId?: string
  readonly lineItems: readonly LineItem[]
  readonly issuedReference?: string | null
  readonly signatureAssetId?: string
  readonly deliveryAddress?: string
  /** The document this one revises, when it is itself a revision. */
  readonly supersedesId?: string
}

export type RevisionBlocker = 'not_revisable_type' | 'not_issued' | 'void'

/**
 * Why this document cannot be revised, or null.
 *
 * A draft is excluded on purpose and is not a limitation: a draft is still
 * editable, so the answer is to change it rather than to make a second one.
 * A void quotation is excluded too — an offer that was withdrawn is not a
 * basis to negotiate from, and a fresh one is the honest move.
 */
export function reasonsRevisionIsBlocked(document: RevisableDocument): RevisionBlocker | null {
  if (document.type !== 'quotation') return 'not_revisable_type'
  if (document.status === 'void') return 'void'
  if (document.status === 'draft') return 'not_issued'
  return null
}

export const canRevise = (document: RevisableDocument): boolean =>
  reasonsRevisionIsBlocked(document) === null

/**
 * The first document in this chain — the one everything else revises.
 *
 * Walks back through `supersedesId`. Guarded against a cycle: a malformed
 * chain arriving from sync must not hang the screen rendering it.
 */
export function rootOf<T extends RevisableDocument>(
  documents: readonly T[],
  document: T,
): T {
  const seen = new Set<string>([document.id])
  let current = document
  for (;;) {
    const previous =
      current.supersedesId === undefined
        ? undefined
        : documents.find((row) => row.id === current.supersedesId)
    if (previous === undefined || seen.has(previous.id)) return current
    seen.add(previous.id)
    current = previous
  }
}

/** Every document in the chain this one belongs to, oldest first. */
export function chainOf<T extends RevisableDocument>(
  documents: readonly T[],
  document: T,
): T[] {
  const root = rootOf(documents, document)
  const chain: T[] = [root]
  for (;;) {
    const current = chain[chain.length - 1]
    if (current === undefined) break
    const next = documents.find(
      (row) => row.supersedesId === current.id && !chain.some((seen) => seen.id === row.id),
    )
    if (next === undefined) break
    chain.push(next)
  }
  return chain
}

/**
 * Which revision this document is. The original is 1, so the first duplicate
 * is the "Rev 2" §G names.
 */
export function revisionNumberOf<T extends RevisableDocument>(
  documents: readonly T[],
  document: T,
): number {
  return chainOf(documents, document).findIndex((row) => row.id === document.id) + 1
}

/** The revision that replaced this one, or null. Derived, never stored (§G). */
export function supersededBy<T extends RevisableDocument>(
  documents: readonly T[],
  documentId: string,
): T | null {
  return documents.find((row) => row.supersedesId === documentId) ?? null
}

/**
 * The idempotency handle for one revision.
 *
 * Derived from (root, number) rather than generated, so two taps of the same
 * gesture are one document (§M) — and so a DELIBERATE second revision, which
 * is a different number, is still possible.
 */
export const revisionKeyFor = (rootId: string, revisionNumber: number): string =>
  `rev:${rootId}:${revisionNumber}`

export interface RevisedDraft {
  readonly draft: DocumentDraft
  /** The document this revises — the one the customer already holds. */
  readonly supersedesId: string
  /** 2 for the first duplicate, counting the whole chain. */
  readonly revisionNumber: number
  readonly idempotencyKey: string
  /** Always false. §G: originals are never altered. */
  readonly altersOriginal: false
}

export interface ReviseOptions {
  /** Every document, so the chain can be read. */
  readonly documents: readonly RevisableDocument[]
  /** Today, for the new offer's own date. Never the original's. */
  readonly on: string
}

export function reviseDocument(
  source: RevisableDocument,
  options: ReviseOptions,
): RevisedDraft {
  const blocked = reasonsRevisionIsBlocked(source)
  if (blocked !== null) {
    throw new RevisionError(blocked, `Document ${source.id} cannot be revised.`)
  }

  const chain = chainOf(options.documents, source)
  const root = chain[0] ?? source
  // The chain's length, not the source's position: revising from the middle
  // still produces the next offer, because "which is latest" is what the
  // customer needs to be able to tell.
  const revisionNumber = chain.length + 1

  return {
    draft: {
      type: source.type,
      currency: source.currency,
      lineItems: source.lineItems.map((line) => ({ ...line })),
      issueDate: options.on,
      ...(source.customerId === undefined ? {} : { customerId: source.customerId }),
      ...(source.deliveryAddress === undefined
        ? {}
        : { deliveryAddress: source.deliveryAddress }),
      // The signature comes across: it is the same business making the same
      // offer again, and asking for it a second time would be a new required
      // field on a duplicate (Rule #1).
      ...(source.signatureAssetId === undefined
        ? {}
        : { signatureAssetId: source.signatureAssetId }),
      // `validUntil` deliberately does NOT come across. Copying it would
      // hand the owner a new offer that is already expired — the single most
      // likely reason they are making one. The builder asks, in one tap.
    },
    supersedesId: source.id,
    revisionNumber,
    idempotencyKey: revisionKeyFor(root.id, revisionNumber),
    altersOriginal: false,
  }
}
