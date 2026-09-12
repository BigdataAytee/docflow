/**
 * Signing for a delivery (§G, §P, §E).
 */

import { describe, expect, it } from 'vitest'

import {
  DeliverySignError,
  type SignableDocument,
  canSign,
  nextDeliveryStep,
  reasonsSigningIsBlocked,
  signDelivery,
} from './sign'

const waybill = (status: string): SignableDocument => ({ id: 'doc_1', type: 'waybill', status })

const sign = (over: Partial<Parameters<typeof signDelivery>[0]> = {}) =>
  signDelivery({
    document: waybill('dispatched'),
    signerName: 'Bisi Adeyemi',
    signatureAssetId: 'ast_1',
    at: '2026-09-12T14:30:00Z',
    ...over,
  })

describe('Only a delivery that is out can be signed for (§P)', () => {
  it('can be signed once it is on its way', () => {
    for (const status of ['dispatched', 'in_transit']) {
      expect(canSign(waybill(status))).toBe(true)
    }
  })

  it('cannot be signed before it has left', () => {
    // Something that never went out cannot have arrived. The lifecycle says
    // so, and this is the UI agreeing with it rather than working around it.
    expect(canSign(waybill('issued'))).toBe(false)
    expect(reasonsSigningIsBlocked(waybill('issued'))).toBe('not_out_yet')
  })

  it('cannot be signed while it is still a draft', () => {
    // Nothing has left the yard; there is nothing to have received.
    expect(reasonsSigningIsBlocked(waybill('draft'))).toBe('not_out_yet')
  })

  it('cannot be signed once cancelled', () => {
    expect(reasonsSigningIsBlocked(waybill('void'))).toBe('not_out_yet')
  })

  it('is not offered on a document that is not a delivery', () => {
    for (const type of ['invoice', 'quotation', 'receipt'] as const) {
      expect(reasonsSigningIsBlocked({ id: 'd', type, status: 'issued' })).toBe('not_a_delivery')
    }
  })
})

describe('The sign action is reachable, not just correct', () => {
  it('offers to send an issued delivery on its way', () => {
    // Without this step the lifecycle would be right and the button would
    // never appear: an issued delivery cannot jump to delivered.
    expect(nextDeliveryStep(waybill('issued'))).toBe('dispatched')
  })

  it('offers nothing once it is already out — sign it instead', () => {
    expect(nextDeliveryStep(waybill('dispatched'))).toBeNull()
    expect(nextDeliveryStep(waybill('in_transit'))).toBeNull()
  })

  it('offers nothing on a draft, a cancelled one, or a signed one', () => {
    for (const status of ['draft', 'void', 'delivered']) {
      expect(nextDeliveryStep(waybill(status))).toBeNull()
    }
  })

  it('offers nothing on a document that is not a delivery', () => {
    expect(nextDeliveryStep({ id: 'd', type: 'invoice', status: 'issued' })).toBeNull()
  })
})

describe('Evidence is captured once (§P, Rule #5)', () => {
  it('refuses a delivery already signed for', () => {
    expect(reasonsSigningIsBlocked(waybill('delivered'))).toBe('sealed')
    expect(canSign(waybill('delivered'))).toBe(false)
  })

  it('says "already signed" rather than "cannot reach delivered"', () => {
    // A delivered document is both; the useful sentence is the first one.
    expect(reasonsSigningIsBlocked(waybill('delivered'))).not.toBe('not_out_yet')
  })

  it('throws rather than quietly overwriting the first signature', () => {
    expect(() => sign({ document: waybill('delivered') })).toThrow(DeliverySignError)
    try {
      sign({ document: waybill('delivered') })
    } catch (cause) {
      expect((cause as DeliverySignError).field).toBe('sealed')
    }
  })
})

describe('Signed and delivered are one fact (§P)', () => {
  it('produces the evidence and the status together', () => {
    const decision = sign()
    expect(decision).toEqual({
      documentId: 'doc_1',
      signerName: 'Bisi Adeyemi',
      signedAt: '2026-09-12T14:30:00Z',
      signatureAssetId: 'ast_1',
      status: 'delivered',
      isAtomic: true,
    })
  })

  it('offers no arrangement that says delivered without saying by whom', () => {
    // There is no field to omit: the type requires the signer, the moment and
    // the mark alongside the status.
    const decision = sign()
    expect(decision.signerName).not.toBe('')
    expect(decision.signatureAssetId).not.toBe('')
    expect(decision.signedAt).not.toBe('')
  })

  it('cannot be edited after the fact', () => {
    const decision = sign()
    expect(Object.isFrozen(decision)).toBe(true)
  })
})

describe('A name without a mark is not a signature (§P)', () => {
  it('refuses an unnamed signer', () => {
    expect(() => sign({ signerName: '   ' })).toThrow(DeliverySignError)
  })

  it('refuses a name with no mark behind it', () => {
    expect(() => sign({ signatureAssetId: '' })).toThrow(DeliverySignError)
  })

  it('tells the two apart, so the sheet can say which is missing', () => {
    const field = (run: () => unknown) => {
      try {
        run()
        return null
      } catch (cause) {
        return (cause as DeliverySignError).field
      }
    }
    expect(field(() => sign({ signerName: '' }))).toBe('name')
    expect(field(() => sign({ signatureAssetId: '' }))).toBe('signature')
  })
})

describe('A role is recorded when there is one, and absent when there is not', () => {
  it('keeps the role', () => {
    expect(sign({ signerRole: 'Storekeeper' }).signerRole).toBe('Storekeeper')
  })

  it('accepts a delivery taken by someone with no title', () => {
    // §E has the column; Rule #1 says it is not a new required field.
    expect(sign().signerRole).toBeUndefined()
    expect(sign({ signerRole: '   ' }).signerRole).toBeUndefined()
  })

  it('trims what was typed, so a stray space is not a role', () => {
    expect(sign({ signerRole: '  Driver ' }).signerRole).toBe('Driver')
    expect(sign({ signerName: '  Bisi ' }).signerName).toBe('Bisi')
  })
})
