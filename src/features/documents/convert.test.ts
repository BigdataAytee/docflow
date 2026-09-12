/**
 * Converting one document into another (§G, §E, §M).
 *
 * The four rules, one describe block each: only what makes sense, a receipt is
 * never in it, the original is never altered, and a retry never duplicates.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { DOCUMENT_TYPES, type DocumentType, quantity } from '../../domain/documents/types'
import {
  CONVERSIONS,
  ConvertError,
  type ConvertibleDocument,
  canConvert,
  conversionKeyFor,
  conversionsFor,
  conversionsOf,
  convertDocument,
  convertedFrom,
  convertedInto,
} from './convert'

const priced = (description: string, units: number, unitPriceMinor: number) => ({
  id: `li_${description}`,
  description,
  quantityMilli: quantity(units),
  unitPriceMinor,
  taxable: true,
})

const unpriced = (description: string, units: number) => ({
  id: `li_${description}`,
  description,
  quantityMilli: quantity(units),
  taxable: false,
})

const doc = (
  over: Partial<ConvertibleDocument> & Pick<ConvertibleDocument, 'type' | 'status'>,
): ConvertibleDocument => ({
  id: 'doc_1',
  currency: 'NGN',
  customerId: 'cus_1',
  lineItems: [priced('Bag of cement', 20, 5_000_00)],
  issueDate: '2026-09-01',
  ...over,
})

describe('Only what makes sense (§G)', () => {
  it('offers exactly the pairs §G names', () => {
    expect(CONVERSIONS.quotation).toEqual(['invoice', 'waybill'])
    expect(CONVERSIONS.invoice).toEqual(['waybill'])
    expect(CONVERSIONS.waybill).toEqual(['invoice'])
    expect(CONVERSIONS.receipt).toEqual([])
  })

  it('never offers a quotation as a target — an offer comes before the work', () => {
    for (const from of DOCUMENT_TYPES) {
      expect(CONVERSIONS[from]).not.toContain('quotation')
    }
  })

  it('offers nothing from a draft: edit the draft instead', () => {
    expect(conversionsFor(doc({ type: 'quotation', status: 'draft' }))).toEqual([])
  })

  it('offers nothing from a voided document', () => {
    expect(conversionsFor(doc({ type: 'quotation', status: 'void' }))).toEqual([])
    expect(conversionsFor(doc({ type: 'invoice', status: 'void' }))).toEqual([])
  })

  it('offers from an accepted quotation, and from a delivered delivery', () => {
    expect(conversionsFor(doc({ type: 'quotation', status: 'accepted' }))).toEqual([
      'invoice',
      'waybill',
    ])
    expect(conversionsFor(doc({ type: 'waybill', status: 'delivered' }))).toEqual(['invoice'])
  })

  it('refuses a pair it does not offer', () => {
    expect(() =>
      convertDocument(doc({ type: 'invoice', status: 'issued' }), {
        to: 'quotation',
        on: '2026-09-12',
      }),
    ).toThrow(ConvertError)
  })

  it('refuses to convert a document into its own type', () => {
    expect(() =>
      convertDocument(doc({ type: 'invoice', status: 'issued' }), {
        to: 'invoice',
        on: '2026-09-12',
      }),
    ).toThrow(/already what it is/)
  })

  it('refuses a status with nothing agreed to carry forward', () => {
    expect(() =>
      convertDocument(doc({ type: 'quotation', status: 'draft' }), {
        to: 'invoice',
        on: '2026-09-12',
      }),
    ).toThrow(/nothing agreed/)
  })

  it('agrees with canConvert for every pair and every status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DOCUMENT_TYPES),
        fc.constantFrom(...DOCUMENT_TYPES),
        fc.constantFrom('draft', 'issued', 'sent', 'accepted', 'delivered', 'void'),
        (from, to, status) => {
          const source = doc({ type: from, status })
          const allowed = canConvert(source, to)
          try {
            convertDocument(source, { to, on: '2026-09-12' })
            return allowed
          } catch {
            return !allowed
          }
        },
      ),
    )
  })
})

describe('A receipt is evidence of a payment (§K, §G)', () => {
  it('converts to nothing', () => {
    expect(conversionsFor(doc({ type: 'receipt', status: 'issued' }))).toEqual([])
  })

  it('is never a target, so nothing can invent money it was paid for', () => {
    for (const from of DOCUMENT_TYPES) {
      expect(CONVERSIONS[from]).not.toContain('receipt')
    }
  })
})

describe('What comes across, and what does not (§G, §I)', () => {
  it('carries the customer, the lines and the quantities', () => {
    const { draft } = convertDocument(doc({ type: 'quotation', status: 'accepted' }), {
      to: 'invoice',
      on: '2026-09-12',
    })
    expect(draft.type).toBe('invoice')
    expect(draft.customerId).toBe('cus_1')
    expect(draft.lineItems).toHaveLength(1)
    expect(draft.lineItems[0]?.quantityMilli).toBe(quantity(20))
  })

  it('dates the new document today, never backdating it to the original', () => {
    const { draft } = convertDocument(
      doc({ type: 'quotation', status: 'accepted', issueDate: '2026-01-05' }),
      { to: 'invoice', on: '2026-09-12' },
    )
    expect(draft.issueDate).toBe('2026-09-12')
  })

  it('drops every price on the way to a delivery, which carries no money', () => {
    const { draft, needsPrices } = convertDocument(
      doc({ type: 'invoice', status: 'issued' }),
      { to: 'waybill', on: '2026-09-12' },
    )
    expect(draft.lineItems[0]?.unitPriceMinor).toBeUndefined()
    // A delivery needs no prices, so nothing is owed to the owner here.
    expect(needsPrices).toBe(false)
  })

  it('asks for prices on the way back from a delivery (§G)', () => {
    const { draft, needsPrices } = convertDocument(
      doc({
        type: 'waybill',
        status: 'delivered',
        lineItems: [unpriced('Bag of cement', 20), unpriced('Sand', 2)],
      }),
      { to: 'invoice', on: '2026-09-12' },
    )
    expect(needsPrices).toBe(true)
    expect(draft.lineItems.every((line) => line.unitPriceMinor === undefined)).toBe(true)
  })

  it('carries the delivery address only to a delivery', () => {
    const source = doc({
      type: 'invoice',
      status: 'issued',
      deliveryAddress: '14 Adeola Odeku',
    })
    expect(
      convertDocument(source, { to: 'waybill', on: '2026-09-12' }).draft.deliveryAddress,
    ).toBe('14 Adeola Odeku')

    const back = convertDocument(
      doc({ type: 'waybill', status: 'delivered', deliveryAddress: '14 Adeola Odeku' }),
      { to: 'invoice', on: '2026-09-12' },
    )
    expect(back.draft.deliveryAddress).toBeUndefined()
  })

  it('never carries a stored total — totals recompute (Rule #3)', () => {
    const { draft } = convertDocument(doc({ type: 'quotation', status: 'accepted' }), {
      to: 'invoice',
      on: '2026-09-12',
    })
    expect(draft).not.toHaveProperty('totalMinor')
    expect(draft).not.toHaveProperty('total')
  })

  it('never carries a reference or frozen labels — the new one freezes its own', () => {
    const { draft } = convertDocument(doc({ type: 'quotation', status: 'accepted' }), {
      to: 'invoice',
      on: '2026-09-12',
    })
    expect(draft).not.toHaveProperty('issuedReference')
    expect(draft).not.toHaveProperty('frozenLabels')
  })
})

describe('The original is never altered; links persist (§G)', () => {
  it('puts the link on the NEW document', () => {
    const converted = convertDocument(doc({ type: 'quotation', status: 'accepted' }), {
      to: 'invoice',
      on: '2026-09-12',
    })
    expect(converted.convertedFromId).toBe('doc_1')
  })

  it('reads the forward link rather than writing it', () => {
    // The quotation is untouched; the invoice carries the link, and the
    // reverse direction is a search over the documents.
    const documents = [
      { id: 'doc_1', type: 'quotation' as DocumentType },
      { id: 'doc_2', type: 'invoice' as DocumentType, convertedFromId: 'doc_1' },
    ]
    expect(convertedInto(documents, 'doc_1', 'invoice')?.id).toBe('doc_2')
    expect(convertedInto(documents, 'doc_1', 'waybill')).toBeNull()
    expect(conversionsOf(documents, 'doc_1').map((row) => row.id)).toEqual(['doc_2'])
    expect(convertedFrom(documents, documents[1]!)?.id).toBe('doc_1')
    expect(convertedFrom(documents, documents[0]!)).toBeNull()
  })
})

describe('A retried conversion never duplicates (§M)', () => {
  it('derives the key from the source and the target', () => {
    expect(conversionKeyFor('doc_1', 'invoice')).toBe('conv:doc_1:invoice')
  })

  it('gives the same key however many times it is asked for', () => {
    const source = doc({ type: 'quotation', status: 'accepted' })
    const first = convertDocument(source, { to: 'invoice', on: '2026-09-12' })
    const second = convertDocument(source, { to: 'invoice', on: '2026-09-13' })
    expect(second.idempotencyKey).toBe(first.idempotencyKey)
  })

  it('keys the two targets of one quotation apart', () => {
    const source = doc({ type: 'quotation', status: 'accepted' })
    const invoice = convertDocument(source, { to: 'invoice', on: '2026-09-12' })
    const delivery = convertDocument(source, { to: 'waybill', on: '2026-09-12' })
    expect(invoice.idempotencyKey).not.toBe(delivery.idempotencyKey)
  })

  it('never collides two different conversions onto one key', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            // Ids without a colon, which is the key's own separator.
            fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/),
            fc.constantFrom(...DOCUMENT_TYPES),
          ),
          { maxLength: 20 },
        ),
        (pairs) => {
          const owners = new Map<string, string>()
          for (const [id, to] of pairs) {
            const key = conversionKeyFor(id, to)
            const owner = `${id}|${to}`
            const seen = owners.get(key)
            if (seen !== undefined && seen !== owner) return false
            owners.set(key, owner)
          }
          return true
        },
      ),
    )
  })
})
