/**
 * Signing a delivery through a public link (§G, §P, §Q Phase 5).
 *
 * §G gives a delivery a "copy signing link": the customer who takes the goods
 * signs on their own phone, without an account. §Q describes the whole act in
 * one line — "view + sign → atomic delivered + timestamp, token invalidated" —
 * and §P adds the rule that makes it safe: the token is "checked on read and
 * on sign".
 *
 * The page is Phase 5 (it needs a deployed edge function). These are the rules
 * it will run, built now because they are the part that has to be right:
 *
 *  · **Checked twice, not once.** A token that was valid when the page loaded
 *    can be expired or already used by the time somebody presses sign — the
 *    customer left the tab open, or the driver signed on their own phone
 *    first. Trusting the first check is a race that ends with two signatures
 *    on one delivery, and the second one silently winning.
 *  · **Signing and invalidating are ONE outcome.** §P: "delivered/signed
 *    links cannot be reused to alter evidence". If the signature landed and
 *    the token stayed live, the link would still open — and the page it opens
 *    can alter delivery evidence, which is the single thing §P forbids.
 *  · **The remote path and the on-device path agree by construction.** The
 *    evidence comes from `signDelivery`, the same function the phone in the
 *    owner's hand uses. Two implementations of "what signing means" would
 *    drift, and the one nobody watches would drift first.
 *  · **A refusal says nothing.** Wrong, expired and used are distinguished
 *    for the words shown, but a token that matches no document gets the same
 *    answer as a wrong one (`checkToken`) — never a hint that a document is
 *    there.
 */

import {
  type SignableDocument,
  type SignedDelivery,
  signDelivery,
} from '../delivery/sign'
import { type LinkRefusal, type StoredToken, checkToken } from './token'

export class RemoteSigningError extends Error {
  constructor(
    readonly refusal: LinkRefusal,
    message: string,
  ) {
    super(message)
    this.name = 'RemoteSigningError'
  }
}

/** §P: "invalidated after signing". The row as it looks once used. */
export function consumeToken(stored: StoredToken, at: string): StoredToken {
  return Object.freeze({ ...stored, consumedAt: at })
}

export interface RemoteSignInput {
  /** The row the server holds. Null when the token matches no document. */
  readonly stored: StoredToken | null
  /** The token out of the URL. */
  readonly token: string
  readonly document: SignableDocument
  readonly signerName: string
  readonly signerRole?: string
  readonly signatureAssetId: string
  readonly at: string
}

export interface RemoteSignature {
  /** Exactly what the on-device path produces — same function, same rules. */
  readonly evidence: SignedDelivery
  /** The same instant the evidence carries. A link dies as it is used. */
  readonly consumed: StoredToken
  /** §P: the evidence and the invalidation are one outcome, never two. */
  readonly isAtomic: true
}

/**
 * What the page may show, before anybody signs.
 *
 * Separate from signing on purpose: §P checks the token on READ as well, and
 * a page that renders a customer's document before checking has already
 * leaked it.
 */
export async function openForSigning(
  stored: StoredToken | null,
  token: string,
  now: Date = new Date(),
): Promise<LinkRefusal | null> {
  return checkToken(stored, token, now)
}

/**
 * Sign, through the link.
 *
 * Re-checks the token at the moment of signing — §P's second check — and
 * produces the evidence and the dead token together.
 */
export async function signThroughLink(input: RemoteSignInput): Promise<RemoteSignature> {
  const refusal = await checkToken(input.stored, input.token, new Date(input.at))
  if (refusal !== null || input.stored === null) {
    // The page may have been open for a day. Whatever was true when it
    // loaded, this is the answer that counts.
    throw new RemoteSigningError(refusal ?? 'wrong', 'This link cannot be used to sign (v6 §P).')
  }

  // The lifecycle, the sealed-evidence rule and the "a mark with nobody
  // behind it is not evidence" rule all come from the one place the owner's
  // own phone uses. A delivery already signed for is refused here too.
  const evidence = signDelivery({
    document: input.document,
    signerName: input.signerName,
    ...(input.signerRole === undefined ? {} : { signerRole: input.signerRole }),
    signatureAssetId: input.signatureAssetId,
    at: input.at,
  })

  return Object.freeze({
    evidence,
    consumed: consumeToken(input.stored, input.at),
    isAtomic: true,
  })
}
