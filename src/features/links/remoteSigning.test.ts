/**
 * Signing a delivery through a public link (§G, §P).
 */

import { describe, expect, it } from 'vitest'

import { DeliverySignError, type SignableDocument } from '../delivery/sign'
import { type StoredToken, expiryFrom, hashToken } from './token'
import {
  RemoteSigningError,
  consumeToken,
  openForSigning,
  signThroughLink,
} from './remoteSigning'

const NOW = new Date('2026-09-12T10:00:00Z')
const AT = '2026-09-12T10:05:00Z'
const TOKEN = 'GOODTOKEN'

const waybill = (status = 'dispatched'): SignableDocument => ({
  id: 'doc_way',
  type: 'waybill',
  status,
})

const row = async (over: Partial<StoredToken> = {}): Promise<StoredToken> => ({
  documentId: 'doc_way',
  tokenHash: await hashToken(TOKEN),
  expiresAt: expiryFrom(NOW),
  ...over,
})

const sign = async (over: Partial<Parameters<typeof signThroughLink>[0]> = {}) =>
  signThroughLink({
    stored: await row(),
    token: TOKEN,
    document: waybill(),
    signerName: 'Bisi Adeyemi',
    signatureAssetId: 'ast_1',
    at: AT,
    ...over,
  })

describe('The page checks before it shows anything (§P)', () => {
  it('opens for a good token', async () => {
    expect(await openForSigning(await row(), TOKEN, NOW)).toBeNull()
  })

  it('refuses a wrong one, an expired one and a used one', async () => {
    expect(await openForSigning(await row(), 'WRONG', NOW)).toBe('wrong')
    expect(await openForSigning(await row({ expiresAt: '2026-09-01T00:00:00Z' }), TOKEN, NOW)).toBe(
      'expired',
    )
    expect(await openForSigning(await row({ consumedAt: AT }), TOKEN, NOW)).toBe('used')
  })

  it('says nothing about a document nobody shared', async () => {
    expect(await openForSigning(null, TOKEN, NOW)).toBe('wrong')
  })
})

describe('The token is checked again at the moment of signing (§P)', () => {
  it('refuses a token that expired while the page sat open', async () => {
    // The customer left the tab open overnight. Whatever was true when it
    // loaded, this is the answer that counts.
    const stale = await row({ expiresAt: '2026-09-12T10:01:00Z' })
    expect(await openForSigning(stale, TOKEN, NOW)).toBeNull()
    await expect(sign({ stored: stale })).rejects.toThrow(RemoteSigningError)
  })

  it('refuses a token somebody else already signed with', async () => {
    // The driver signed on their own phone first. Trusting the first check
    // would put two signatures on one delivery, the second silently winning.
    await expect(sign({ stored: await row({ consumedAt: '2026-09-12T10:02:00Z' }) })).rejects.toThrow(
      RemoteSigningError,
    )
  })

  it('refuses a wrong token even when a real one exists', async () => {
    await expect(sign({ token: 'WRONGTOKEN' })).rejects.toThrow(RemoteSigningError)
  })

  it('refuses a token matching no document at all', async () => {
    await expect(sign({ stored: null })).rejects.toThrow(RemoteSigningError)
  })

  it('carries the refusal, so the page can say which in the frozen language', async () => {
    try {
      await sign({ stored: await row({ consumedAt: AT }) })
      expect.unreachable()
    } catch (cause) {
      expect((cause as RemoteSigningError).refusal).toBe('used')
    }
  })
})

describe('Signing and invalidating are one outcome (§P, §Q)', () => {
  it('produces the evidence and the dead token together', async () => {
    const result = await sign()
    expect(result.isAtomic).toBe(true)
    expect(result.evidence.status).toBe('delivered')
    expect(result.consumed.consumedAt).toBe(AT)
  })

  it('kills the link at the same instant the evidence is dated', async () => {
    // A link that outlived its own signature would still open, and the page
    // it opens can alter delivery evidence.
    const result = await sign()
    expect(result.consumed.consumedAt).toBe(result.evidence.signedAt)
  })

  it('cannot be taken apart afterwards', async () => {
    const result = await sign()
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.consumed)).toBe(true)
  })

  it('leaves the original row alone rather than editing it in place', async () => {
    const stored = await row()
    const result = await sign({ stored })
    expect(stored.consumedAt).toBeUndefined()
    expect(result.consumed.tokenHash).toBe(stored.tokenHash)
  })
})

describe('The remote path and the phone in the owner hand agree (§P)', () => {
  it('produces exactly what the on-device path produces', async () => {
    const result = await sign({ signerRole: 'Storekeeper' })
    expect(result.evidence).toEqual({
      documentId: 'doc_way',
      signerName: 'Bisi Adeyemi',
      signerRole: 'Storekeeper',
      signedAt: AT,
      signatureAssetId: 'ast_1',
      status: 'delivered',
      isAtomic: true,
    })
  })

  it('refuses a delivery already signed for, through the link as well', async () => {
    // §P: "delivered/signed links cannot be reused to alter evidence." The
    // seal is `signDelivery`'s, reached from outside.
    await expect(sign({ document: waybill('delivered') })).rejects.toThrow(DeliverySignError)
  })

  it('refuses a delivery that never went out', async () => {
    await expect(sign({ document: waybill('issued') })).rejects.toThrow(DeliverySignError)
  })

  it('refuses a mark with nobody behind it', async () => {
    await expect(sign({ signerName: '  ' })).rejects.toThrow(DeliverySignError)
  })

  it('works for a delivery that is on the way, not only one just dispatched', async () => {
    expect((await sign({ document: waybill('in_transit') })).evidence.status).toBe('delivered')
  })
})

describe('Consuming a token', () => {
  it('marks it used without touching anything else', async () => {
    const stored = await row()
    expect(consumeToken(stored, AT)).toEqual({ ...stored, consumedAt: AT })
  })
})
