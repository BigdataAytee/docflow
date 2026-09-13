/**
 * Public-link tokens (§P, §G, §Q Phase 5).
 *
 * §G gives a quotation a "copy accept link" and a delivery a "copy signing
 * link". Both hang on the same mechanism, which §P specifies exactly:
 *
 *   "Public delivery/quotation links use per-document random tokens (hash
 *    stored server-side, separate from general document reads), checked on
 *    read and on sign, invalidated after signing or 14 days; wrong/expired
 *    tokens show a friendly message in the document's frozen language, never
 *    data; delivered/signed links cannot be reused to alter evidence."
 *
 * The page those links open is Phase 5 — it needs a deployed edge function,
 * because a customer is not signed in and RLS scopes every read to a company
 * (§P). This module is the half that does NOT need a server, and it is built
 * now because getting it wrong is a data leak rather than a bug:
 *
 *  · **The token is random, from the platform CSPRNG.** A token derived from
 *    a document id, a timestamp or `Math.random` is guessable, and guessing
 *    one hands a stranger a customer's document. 32 bytes, base32, no
 *    exceptions.
 *  · **Only the HASH is ever stored.** §P puts it in its own table with no
 *    client policy; this module makes sure the thing stored is not the thing
 *    in the URL, so a leaked database row cannot open a link.
 *  · **A link dies on use or after 14 days**, whichever comes first. §P's
 *    "delivered/signed links cannot be reused to alter evidence" is the same
 *    rule as the seal on delivery evidence, reached from outside.
 *  · **A wrong token is indistinguishable from an expired one.** Both get one
 *    unhelpful answer, because a message that says WHICH tells an attacker
 *    whether a token ever existed.
 */

export type LinkKind = 'accept' | 'sign'

/** §P: "invalidated after signing or 14 days". */
export const LINK_LIFETIME_DAYS = 14

/**
 * Crockford base32 without I, L, O and U — the same alphabet the offline
 * reference tag uses. A token gets read aloud down a phone line often enough
 * that characters which look like digits are a real cost.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
/** 32 bytes of entropy. Far past guessing; short enough to paste in a message. */
const TOKEN_BYTES = 32

export class LinkError extends Error {}

/**
 * A fresh token. The return value is the ONLY moment the secret exists in one
 * place — the caller sends it in a URL and stores the hash, never the reverse.
 */
export async function mintToken(now: Date = new Date()): Promise<{
  /** Goes in the URL. Never stored, never logged (§P). */
  readonly token: string
  /** Goes in the database. Cannot be turned back into the token. */
  readonly tokenHash: string
  readonly expiresAt: string
}> {
  const bytes = new Uint8Array(TOKEN_BYTES)
  // The platform CSPRNG, or nothing. There is no fallback on purpose: a
  // predictable token is worse than a missing feature, and a silent downgrade
  // to `Math.random` is exactly the kind of thing nobody notices in review.
  const source = globalThis.crypto
  if (source?.getRandomValues === undefined) {
    throw new LinkError('No secure random source. A guessable link is a leaked document (v6 §P).')
  }
  source.getRandomValues(bytes)

  let token = ''
  for (const byte of bytes) token += ALPHABET[byte % ALPHABET.length] ?? '0'

  return {
    token,
    tokenHash: await hashToken(token),
    expiresAt: expiryFrom(now),
  }
}

/** SHA-256, hex. One way, and the same answer on every platform. */
export async function hashToken(token: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    throw new LinkError('No hashing available; a token must never be stored as itself (v6 §P).')
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function expiryFrom(now: Date): string {
  const expires = new Date(now.getTime())
  expires.setUTCDate(expires.getUTCDate() + LINK_LIFETIME_DAYS)
  return expires.toISOString()
}

/** What the server holds for one document — §E `document_signing_tokens`. */
export interface StoredToken {
  readonly documentId: string
  readonly tokenHash: string
  readonly expiresAt: string
  /** Set the moment the link is used. §P: a used link cannot be reused. */
  readonly consumedAt?: string
}

/**
 * Why a link will not open, or null.
 *
 * `wrong` covers a token that matches nothing AND one whose hash does not
 * match — deliberately the same answer. Telling them apart would confirm to
 * whoever is trying that a document exists behind the id they guessed.
 */
export type LinkRefusal = 'wrong' | 'expired' | 'used'

export async function checkToken(
  stored: StoredToken | null,
  token: string,
  now: Date = new Date(),
): Promise<LinkRefusal | null> {
  if (stored === null) return 'wrong'
  if ((await hashToken(token)) !== stored.tokenHash) return 'wrong'
  // Order matters only for the words shown; both refuse.
  if (stored.consumedAt !== undefined) return 'used'
  if (new Date(stored.expiresAt).getTime() <= now.getTime()) return 'expired'
  return null
}

/**
 * The link itself.
 *
 * The path carries the KIND as well as the token, so an accept link cannot be
 * replayed against the signing endpoint: one token, one thing it may do.
 */
export function linkFor(baseUrl: string, kind: LinkKind, token: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base === '') throw new LinkError('A link needs somewhere to point.')
  // A customer document must never travel over plain http (§P). The one
  // exception is the loopback address, which browsers themselves treat as a
  // secure context — without it the action is untestable in development, and
  // an action nobody can try is an action nobody has checked.
  const loopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base)
  if (!/^https:\/\//i.test(base) && !loopback) {
    throw new LinkError('A public link must be https.')
  }
  if (!/^[0-9A-Z]+$/.test(token)) throw new LinkError('That is not a token this app minted.')
  return `${base}/${kind}/${token}`
}

/** Which documents a link of each kind makes sense for (§G). */
export function linkKindFor(type: string, status: string): LinkKind | null {
  if (type === 'quotation' && ['issued', 'sent'].includes(status)) return 'accept'
  // A delivery that has already been signed for has nothing left to sign.
  if (type === 'waybill' && ['dispatched', 'in_transit'].includes(status)) return 'sign'
  return null
}
