/**
 * The photo on a delivery (§G, §E, §P).
 */

import { describe, expect, it } from 'vitest'

import {
  DeliveryPhotoError,
  type PhotographableDocument,
  attachDeliveryPhoto,
  canAttachPhoto,
  reasonsPhotoIsBlocked,
} from './photo'

const waybill = (over: Partial<PhotographableDocument> = {}): PhotographableDocument => ({
  id: 'doc_way',
  type: 'waybill',
  status: 'dispatched',
  ...over,
})

describe('A photo can be taken right up to the moment of signing (§G)', () => {
  it('is offered once the delivery exists as a document', () => {
    for (const status of ['issued', 'dispatched', 'in_transit']) {
      expect(canAttachPhoto(waybill({ status }))).toBe(true)
    }
  })

  it('is not offered on a draft — there is nothing to be evidence of yet', () => {
    expect(reasonsPhotoIsBlocked(waybill({ status: 'draft' }))).toBe('not_issued')
  })

  it('is not offered on a withdrawn delivery', () => {
    expect(reasonsPhotoIsBlocked(waybill({ status: 'void' }))).toBe('void')
  })

  it('is offered on no other type', () => {
    for (const type of ['invoice', 'quotation', 'receipt'] as const) {
      expect(reasonsPhotoIsBlocked(waybill({ type }))).toBe('not_a_delivery')
    }
  })
})

describe('It is evidence, so it seals (§P)', () => {
  it('refuses a delivery already signed for', () => {
    // A photo added after the customer signed would change what the record
    // says happened, on a document they already hold a copy of.
    expect(reasonsPhotoIsBlocked(waybill({ status: 'delivered' }))).toBe('sealed')
    expect(canAttachPhoto(waybill({ status: 'delivered' }))).toBe(false)
  })

  it('throws rather than quietly attaching to a sealed record', () => {
    expect(() => attachDeliveryPhoto(waybill({ status: 'delivered' }), 'ast_1')).toThrow(
      DeliveryPhotoError,
    )
    try {
      attachDeliveryPhoto(waybill({ status: 'delivered' }), 'ast_1')
    } catch (cause) {
      expect((cause as DeliveryPhotoError).field).toBe('sealed')
    }
  })
})

describe('A photo is not a signature (§P)', () => {
  it('says so in the value, not in a comment', () => {
    // A stack of bags proves goods arrived somewhere; it does not say who
    // took them. `signDelivery` still needs a name and a mark.
    expect(attachDeliveryPhoto(waybill(), 'ast_1').isNotASignature).toBe(true)
  })

  it('produces nothing a signature could be read out of', () => {
    expect(Object.keys(attachDeliveryPhoto(waybill(), 'ast_1')).sort()).toEqual([
      'assetId',
      'documentId',
      'isNotASignature',
    ])
  })
})

describe('One photo, and the old asset survives (§E, §P)', () => {
  it('replaces the reference and names what it replaced', () => {
    const attached = attachDeliveryPhoto(waybill({ deliveryPhotoAssetId: 'ast_old' }), 'ast_new')
    expect(attached.assetId).toBe('ast_new')
    // Assets are append-only: the old one is untouched, only unreferenced.
    expect(attached.replaces).toBe('ast_old')
  })

  it('names nothing replaced when it is the first', () => {
    expect(attachDeliveryPhoto(waybill(), 'ast_1').replaces).toBeUndefined()
  })

  it('cannot be edited after the fact', () => {
    expect(Object.isFrozen(attachDeliveryPhoto(waybill(), 'ast_1'))).toBe(true)
  })

  it('refuses a photo that was never stored', () => {
    expect(() => attachDeliveryPhoto(waybill(), '')).toThrow(DeliveryPhotoError)
  })
})
