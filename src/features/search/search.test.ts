/**
 * The local search index (§G, §D.3, §L10).
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { freezeLabels } from '../../domain/locale/profile'
import { buildIndex, search } from './index'

const NG = { locale: 'EN-NG' }
const GB = { locale: 'EN-GB' }

const issuedAsWaybill = {
  id: 'w1',
  type: 'waybill' as const,
  reference: 'WAY-0042',
  customerName: 'Okoro & Sons',
  frozenLabels: freezeLabels(NG, 'waybill'),
}

describe('Both names find the same document (§D.3, §V)', () => {
  it('finds a waybill issued in Lagos by the word the company now uses in the UK', () => {
    // The company moved: its documents were issued as waybills, and it now
    // calls them delivery notes. Both words must reach the same record.
    const index = buildIndex(GB, { documents: [issuedAsWaybill] })

    expect(search(index, 'waybill').map((e) => e.id)).toEqual(['w1'])
    expect(search(index, 'delivery note').map((e) => e.id)).toEqual(['w1'])
  })

  it('finds it by the internal type too', () => {
    const index = buildIndex(GB, { documents: [issuedAsWaybill] })
    expect(search(index, 'waybill')).toHaveLength(1)
  })

  it('finds a draft by the current label only, since it has frozen none', () => {
    const draft = { ...issuedAsWaybill, id: 'w2', frozenLabels: null }
    const index = buildIndex(GB, { documents: [draft] })
    expect(search(index, 'delivery note').map((e) => e.id)).toEqual(['w2'])
  })

  it('accepts a regional synonym the extractors also accept (§D.5)', () => {
    const index = buildIndex(NG, { documents: [issuedAsWaybill] })
    expect(search(index, 'dispatch note')).toHaveLength(1)
  })
})

describe('One field across customers, numbers, amounts and item names (§G)', () => {
  const index = buildIndex(NG, {
    documents: [
      {
        id: 'i1',
        type: 'invoice',
        reference: 'INV-0007',
        customerName: 'Okoro & Sons',
        frozenLabels: null,
        total: money('NGN', 145_000_00),
        lineDescriptions: ['Cement', 'Sharp sand'],
      },
    ],
    customers: [{ id: 'c1', name: 'Adeola Ltd', phone: '+234 802 555 0101', address: '12 Balogun St' }],
    items: [{ id: 'it1', name: 'Cement' }],
  })

  it('finds a document by its reference, with or without the prefix', () => {
    expect(search(index, 'INV-0007').map((e) => e.id)).toContain('i1')
    expect(search(index, '0007').map((e) => e.id)).toContain('i1')
  })

  it('finds a document by its customer', () => {
    expect(search(index, 'okoro').map((e) => e.id)).toContain('i1')
  })

  it('finds a document by an amount typed either way', () => {
    expect(search(index, '145000').map((e) => e.id)).toContain('i1')
    expect(search(index, '145,000').map((e) => e.id)).toContain('i1')
  })

  it('finds a document by an item on it', () => {
    expect(search(index, 'sharp sand').map((e) => e.id)).toContain('i1')
  })

  it('finds a customer by phone number however it is punctuated', () => {
    expect(search(index, '8025550101').map((e) => e.id)).toContain('c1')
    expect(search(index, '+234 802').map((e) => e.id)).toContain('c1')
  })

  it('finds a customer by address', () => {
    expect(search(index, 'balogun').map((e) => e.id)).toContain('c1')
  })

  it('tells the three kinds apart, so results can be grouped', () => {
    const kinds = new Set(search(index, 'cement').map((e) => e.kind))
    expect(kinds).toEqual(new Set(['document', 'item']))
  })

  it('returns nothing for an empty query rather than everything', () => {
    // §G: "Typing replaces the body with results" — an empty field is not a
    // search, and returning the whole index would flash the entire account.
    expect(search(index, '')).toEqual([])
    expect(search(index, '   ')).toEqual([])
  })

  it('caps results so a large account cannot stall the field (§L10)', () => {
    const many = buildIndex(NG, {
      customers: Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` })),
    })
    expect(search(many, 'customer').length).toBeLessThanOrEqual(20)
  })
})
