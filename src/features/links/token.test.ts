/**
 * Public-link tokens (§P).
 *
 * These matter more than most: getting them wrong is a leaked customer
 * document, not a broken screen.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  LINK_LIFETIME_DAYS,
  LinkError,
  type StoredToken,
  checkToken,
  expiryFrom,
  hashToken,
  linkFor,
  linkKindFor,
  mintToken,
} from './token'

const NOW = new Date('2026-09-12T10:00:00Z')
const later = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

describe('A token is random, not derived (§P)', () => {
  it('never repeats', async () => {
    const minted = await Promise.all(Array.from({ length: 200 }, () => mintToken(NOW)))
    expect(new Set(minted.map((m) => m.token)).size).toBe(200)
  })

  it('carries enough entropy that guessing is not a strategy', async () => {
    const { token } = await mintToken(NOW)
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[0-9A-Z]{32}$/)
  })

  it('uses no character that reads as a digit down a phone line', async () => {
    // The same alphabet as the offline reference tag: no I, L, O or U.
    const { token } = await mintToken(NOW)
    expect(token).not.toMatch(/[ILOU]/)
  })

  it('is not derived from anything the caller passed in', async () => {
    // Same instant, same everything: still different tokens. A token derived
    // from a document id or a timestamp would be guessable.
    const [a, b] = await Promise.all([mintToken(NOW), mintToken(NOW)])
    expect(a.token).not.toBe(b.token)
  })
})

describe('Only the hash is ever stored (§P)', () => {
  it('stores something that is not the token', async () => {
    const { token, tokenHash } = await mintToken(NOW)
    expect(tokenHash).not.toBe(token)
    expect(tokenHash).not.toContain(token)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives the same token the same hash, on any platform', async () => {
    expect(await hashToken('ABC123')).toBe(await hashToken('ABC123'))
  })

  it('is a known SHA-256, so a server in another language agrees', async () => {
    // The edge function that checks these is Phase 5 and will not be written
    // in TypeScript. Pinning real vectors means a token minted here and a
    // hash computed there cannot quietly disagree.
    //   printf 'abc' | sha256sum
    expect(await hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await hashToken('docflow')).toBe(
      '938942b9798e15cb0e2e4836be1fb6d925d6b951d0d08e82b9a76cf266651a36',
    )
  })

  it('gives one changed character a completely different hash', async () => {
    expect(await hashToken('docflow')).not.toBe(await hashToken('docflo'))
  })

  it('cannot be turned back into a token', async () => {
    const { token, tokenHash } = await mintToken(NOW)
    // The only way to check one is to hash the candidate — which is what
    // `checkToken` does, and why a leaked row cannot open a link.
    expect(await hashToken(tokenHash)).not.toBe(token)
  })
})

describe('A link dies on use or after 14 days (§P)', () => {
  const stored = (over: Partial<StoredToken> = {}): StoredToken => ({
    documentId: 'doc_1',
    tokenHash: '',
    expiresAt: expiryFrom(NOW),
    ...over,
  })

  const withToken = async (token: string, over: Partial<StoredToken> = {}) =>
    stored({ tokenHash: await hashToken(token), ...over })

  it('opens with the right token, inside the window', async () => {
    expect(await checkToken(await withToken('GOODTOKEN'), 'GOODTOKEN', NOW)).toBeNull()
  })

  it('expires after exactly fourteen days', async () => {
    const row = await withToken('GOODTOKEN')
    expect(await checkToken(row, 'GOODTOKEN', later(LINK_LIFETIME_DAYS - 1))).toBeNull()
    expect(await checkToken(row, 'GOODTOKEN', later(LINK_LIFETIME_DAYS))).toBe('expired')
    expect(await checkToken(row, 'GOODTOKEN', later(LINK_LIFETIME_DAYS + 1))).toBe('expired')
  })

  it('cannot be used twice — a used link never alters evidence (§P)', async () => {
    const row = await withToken('GOODTOKEN', { consumedAt: '2026-09-13T09:00:00Z' })
    expect(await checkToken(row, 'GOODTOKEN', NOW)).toBe('used')
  })

  it('refuses a wrong token', async () => {
    expect(await checkToken(await withToken('GOODTOKEN'), 'WRONGTOKEN', NOW)).toBe('wrong')
  })

  it('gives a token for a document nobody shared the same answer as a wrong one', async () => {
    // Telling them apart would confirm that a document exists behind a
    // guessed id, which is the whole reason the answers are identical.
    expect(await checkToken(null, 'ANYTOKEN', NOW)).toBe('wrong')
  })

  it('never opens for any token but the one minted', async () => {
    const { token, tokenHash } = await mintToken(NOW)
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 40 }), async (guess) => {
        if (guess === token) return true
        return (await checkToken(stored({ tokenHash }), guess, NOW)) === 'wrong'
      }),
    )
  })
})

describe('The link itself (§P)', () => {
  it('carries the kind as well as the token', async () => {
    // One token, one thing it may do: an accept link cannot be replayed
    // against the signing endpoint.
    expect(linkFor('https://app.docflow.ng', 'accept', 'TOKEN1')).toBe(
      'https://app.docflow.ng/accept/TOKEN1',
    )
    expect(linkFor('https://app.docflow.ng/', 'sign', 'TOKEN1')).toBe(
      'https://app.docflow.ng/sign/TOKEN1',
    )
  })

  it('refuses plain http — a customer document never travels in the clear', () => {
    expect(() => linkFor('http://app.docflow.ng', 'accept', 'TOKEN1')).toThrow(LinkError)
    expect(() => linkFor('http://localhost.evil.example', 'accept', 'TOKEN1')).toThrow(LinkError)
  })

  it('allows the loopback address, which browsers treat as secure', () => {
    // Without it the action cannot be tried in development, and an action
    // nobody can try is an action nobody has checked.
    expect(linkFor('http://localhost:4173', 'accept', 'TOKEN1')).toBe(
      'http://localhost:4173/accept/TOKEN1',
    )
    expect(linkFor('http://127.0.0.1:5173', 'sign', 'TOKEN1')).toBe(
      'http://127.0.0.1:5173/sign/TOKEN1',
    )
  })

  it('refuses anything this app did not mint', () => {
    expect(() => linkFor('https://app.docflow.ng', 'accept', '../../admin')).toThrow(LinkError)
    expect(() => linkFor('https://app.docflow.ng', 'accept', 'token with spaces')).toThrow(LinkError)
    expect(() => linkFor('https://app.docflow.ng', 'accept', '')).toThrow(LinkError)
  })

  it('refuses a link pointing nowhere', () => {
    expect(() => linkFor('   ', 'accept', 'TOKEN1')).toThrow(LinkError)
  })
})

describe('Which documents a link makes sense for (§G)', () => {
  it('offers acceptance on an offer that has been made', () => {
    expect(linkKindFor('quotation', 'issued')).toBe('accept')
    expect(linkKindFor('quotation', 'sent')).toBe('accept')
  })

  it('offers nothing on an offer already answered', () => {
    for (const status of ['draft', 'accepted', 'rejected', 'void']) {
      expect(linkKindFor('quotation', status)).toBeNull()
    }
  })

  it('offers signing on a delivery that is out', () => {
    expect(linkKindFor('waybill', 'dispatched')).toBe('sign')
    expect(linkKindFor('waybill', 'in_transit')).toBe('sign')
  })

  it('offers nothing on a delivery already signed for (§P)', () => {
    // Its evidence is sealed; a link that could alter it is the thing §P
    // exists to prevent.
    expect(linkKindFor('waybill', 'delivered')).toBeNull()
  })

  it('offers nothing on an invoice or a receipt', () => {
    for (const type of ['invoice', 'receipt']) {
      expect(linkKindFor(type, 'issued')).toBeNull()
    }
  })
})
