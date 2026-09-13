/**
 * The decisions the public-link endpoint makes (§P, §Q Phase 5).
 *
 * Kept apart from the Deno entry point for one reason: the app's own test
 * suite imports this file and pins it against `src/features/links/token.ts`,
 * so the two implementations of "is this token good" cannot drift. They are
 * separate implementations because they run in separate runtimes — this one
 * has service-role access and the client has none — and the one nobody
 * watches is the one that would drift.
 *
 * Nothing here touches the network, a database or a Deno global, so it is
 * plain TypeScript that both runtimes can read.
 *
 * The rules it encodes, all §P:
 *
 *  · A token is checked on READ and again on WRITE.
 *  · A wrong token, an unknown document and a hash mismatch produce ONE
 *    answer. Anything finer confirms that a document exists behind a guess.
 *  · What comes back is a MINIMAL view: what the customer needs to answer,
 *    in the document's frozen language, and not one field more. No customer
 *    list, no totals on a delivery, no company data.
 *  · A used or expired link is dead, and the answer says so without saying
 *    what it was for.
 */

/** Everything the endpoint can refuse with. The page turns these into words. */
export type Refusal = 'wrong' | 'expired' | 'used' | 'not_answerable' | 'rate_limited'

export const LINK_LIFETIME_DAYS = 14

/** SHA-256, hex — pinned by test against the client's own implementation. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The row in `document_signing_tokens`. */
export interface TokenRow {
  readonly document_id: string
  readonly token_hash: string
  readonly expires_at: string
  readonly consumed_at: string | null
}

/**
 * Is this token good? The same answer for a token that matches nothing and a
 * token whose hash is wrong — see the note above.
 */
export async function checkRow(
  row: TokenRow | null,
  token: string,
  now: Date,
): Promise<Refusal | null> {
  if (row === null) return 'wrong'
  if ((await hashToken(token)) !== row.token_hash) return 'wrong'
  if (row.consumed_at !== null) return 'used'
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired'
  return null
}

/** The stored document, as the function reads it. More than it may send. */
export interface DocumentRow {
  readonly id: string
  readonly type: string
  readonly status: string
  readonly issued_reference: string | null
  readonly frozen_labels: {
    printedTitle: string
    partyLabel: string
    signatureCaption: string
    language: string
  } | null
  readonly currency: string
  readonly total_minor: number
  readonly line_items: readonly {
    description: string
    quantityMilli: number
    unitPriceMinor?: number
  }[]
  readonly issue_date: string | null
  readonly valid_until: string | null
  readonly delivery_address: string | null
  readonly customer_name: string | null
  readonly business_name: string | null
}

/** What actually crosses the wire to a stranger's phone. */
export interface PublicView {
  readonly kind: 'accept' | 'sign'
  readonly reference: string
  readonly title: string
  readonly partyLabel: string
  /** §P: "rendered in the document's frozen language". */
  readonly language: string
  readonly businessName: string
  readonly customerName: string
  readonly issueDate: string | null
  readonly validUntil: string | null
  readonly deliveryAddress: string | null
  readonly lines: readonly {
    description: string
    quantityMilli: number
    unitPriceMinor?: number
  }[]
  /** Absent on a delivery: §V, a delivery document shows no money anywhere. */
  readonly total?: { currency: string; minor: number }
}

/** Which action this document is open to, or null — the same table §G names. */
export function kindFor(type: string, status: string): 'accept' | 'sign' | null {
  if (type === 'quotation' && ['issued', 'sent'].includes(status)) return 'accept'
  if (type === 'waybill' && ['dispatched', 'in_transit'].includes(status)) return 'sign'
  return null
}

/**
 * The view, or a refusal.
 *
 * `not_answerable` covers a document whose moment has passed — a quotation
 * already answered, a delivery already signed for. The link was real; there
 * is simply nothing left to do, and saying so is kinder than "wrong" and
 * leaks nothing a holder of the token does not already know.
 */
export function viewFor(document: DocumentRow): PublicView | Refusal {
  const kind = kindFor(document.type, document.status)
  if (kind === null) return 'not_answerable'

  const carriesMoney = document.type !== 'waybill'
  return {
    kind,
    reference: document.issued_reference ?? '',
    title: document.frozen_labels?.printedTitle ?? '',
    partyLabel: document.frozen_labels?.partyLabel ?? '',
    language: document.frozen_labels?.language ?? 'en',
    businessName: document.business_name ?? '',
    customerName: document.customer_name ?? '',
    issueDate: document.issue_date,
    validUntil: document.valid_until,
    deliveryAddress: document.delivery_address,
    // Descriptions and quantities only. A price on a delivery line would put
    // money on a document §V says carries none.
    lines: document.line_items.map((line) => ({
      description: line.description,
      quantityMilli: line.quantityMilli,
      ...(carriesMoney && line.unitPriceMinor !== undefined
        ? { unitPriceMinor: line.unitPriceMinor }
        : {}),
    })),
    ...(carriesMoney ? { total: { currency: document.currency, minor: document.total_minor } } : {}),
  }
}

export type Answer = 'accepted' | 'rejected'

export interface WriteRequest {
  readonly answer?: Answer
  readonly signerName?: string
  readonly signerRole?: string
  /** A data URL the page produced. Stored as an asset before it is referenced. */
  readonly signatureDataUrl?: string
}

export interface WritePlan {
  readonly documentId: string
  readonly status: string
  readonly signerName?: string
  readonly signerRole?: string
  readonly signedAt?: string
  readonly needsSignatureAsset: boolean
}

/**
 * What a submitted answer does to the document.
 *
 * §Q: a quotation is "Accept/Reject, optional signature, timestamped"; a
 * delivery is "view + sign → atomic delivered + timestamp". The write and the
 * token's consumption are applied in one transaction by the caller.
 */
export function planFor(
  document: DocumentRow,
  request: WriteRequest,
  at: string,
): WritePlan | Refusal {
  const kind = kindFor(document.type, document.status)
  if (kind === null) return 'not_answerable'

  if (kind === 'accept') {
    if (request.answer !== 'accepted' && request.answer !== 'rejected') return 'not_answerable'
    return {
      documentId: document.id,
      status: request.answer,
      // §Q: the signature is OPTIONAL on an acceptance.
      needsSignatureAsset: request.signatureDataUrl !== undefined,
      ...(request.signerName === undefined || request.signerName.trim() === ''
        ? {}
        : { signerName: request.signerName.trim() }),
      signedAt: at,
    }
  }

  // A delivery. A mark with nobody behind it is not evidence (§P), and
  // neither is a name with no mark — both are required here, unlike above.
  const signerName = request.signerName?.trim() ?? ''
  if (signerName === '' || request.signatureDataUrl === undefined) return 'not_answerable'

  return {
    documentId: document.id,
    status: 'delivered',
    signerName,
    ...(request.signerRole === undefined || request.signerRole.trim() === ''
      ? {}
      : { signerRole: request.signerRole.trim() }),
    signedAt: at,
    needsSignatureAsset: true,
  }
}

/**
 * A very small fixed-window limiter (§P: "rate limiting on auth and public
 * endpoints").
 *
 * Per token, not per IP: a customer on a shared mobile network must not be
 * locked out by a stranger, and the token is the thing being guessed at.
 */
export const RATE_LIMIT = { attempts: 20, windowMs: 60_000 } as const

export function isRateLimited(
  attempts: readonly number[],
  now: number,
  limit: { attempts: number; windowMs: number } = RATE_LIMIT,
): boolean {
  return attempts.filter((at) => now - at < limit.windowMs).length >= limit.attempts
}
