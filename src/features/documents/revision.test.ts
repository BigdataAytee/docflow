/**
 * Duplicate as Rev 2 (§G, §E, §M).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { quantity } from '../../domain/documents/types'
import {
  RevisionError,
  type RevisableDocument,
  canRevise,
  chainOf,
  reasonsRevisionIsBlocked,
  revisionKeyFor,
  revisionNumberOf,
  reviseDocument,
  rootOf,
  supersededBy,
} from './revision'

const LINE = {
  id: 'li_1',
  description: 'Bag of cement',
  quantityMilli: quantity(20),
  unitPriceMinor: 5_000_00,
  taxable: true,
}

const quote = (over: Partial<RevisableDocument> = {}): RevisableDocument => ({
  id: 'doc_1',
  type: 'quotation',
  status: 'sent',
  currency: 'NGN',
  customerId: 'cus_1',
  lineItems: [LINE],
  issuedReference: 'QUO-0009',
  ...over,
})

const revise = (source = quote(), documents: RevisableDocument[] = [source]) =>
  reviseDocument(source, { documents, on: '2026-09-12' })

describe('Only a quotation is revised (§G, Rule #5)', () => {
  it('is offered on an issued, sent, accepted or rejected quotation', () => {
    for (const status of ['issued', 'sent', 'accepted', 'rejected']) {
      expect(canRevise(quote({ status }))).toBe(true)
    }
  })

  it('is not offered on any other type', () => {
    // An invoice is a demand for money: a second one is a second debt, and
    // Rule #5 says corrections are void, credit note or reissue. A receipt is
    // evidence of a payment. A delivery note's evidence seals.
    for (const type of ['invoice', 'receipt', 'waybill'] as const) {
      expect(reasonsRevisionIsBlocked(quote({ type }))).toBe('not_revisable_type')
    }
  })

  it('is not offered on a draft, which can simply be edited', () => {
    expect(reasonsRevisionIsBlocked(quote({ status: 'draft' }))).toBe('not_issued')
  })

  it('is not offered on a withdrawn offer', () => {
    expect(reasonsRevisionIsBlocked(quote({ status: 'void' }))).toBe('void')
  })

  it('throws rather than quietly revising something it should not', () => {
    expect(() => revise(quote({ type: 'invoice' }))).toThrow(RevisionError)
    expect(() => revise(quote({ status: 'draft' }))).toThrow(RevisionError)
  })
})

describe('The original is never altered (§G, Rule #5)', () => {
  it('says so in the value, not in a comment', () => {
    expect(revise().altersOriginal).toBe(false)
  })

  it('puts the link on the NEW document', () => {
    expect(revise().supersedesId).toBe('doc_1')
  })

  it('derives "this one was replaced" by reading (Rule #3)', () => {
    const original = quote()
    const rev2 = quote({ id: 'doc_2', supersedesId: 'doc_1' })
    expect(supersededBy([original, rev2], 'doc_1')?.id).toBe('doc_2')
    expect(supersededBy([original, rev2], 'doc_2')).toBeNull()
  })
})

describe('The revision number counts the chain (§G)', () => {
  const original = quote()
  const rev2 = quote({ id: 'doc_2', status: 'sent', supersedesId: 'doc_1' })
  const rev3 = quote({ id: 'doc_3', status: 'sent', supersedesId: 'doc_2' })
  const all = [original, rev2, rev3]

  it('makes the first duplicate Rev 2, which is what §G calls it', () => {
    expect(revise().revisionNumber).toBe(2)
  })

  it('numbers each document by where it sits in the chain', () => {
    expect(revisionNumberOf(all, original)).toBe(1)
    expect(revisionNumberOf(all, rev2)).toBe(2)
    expect(revisionNumberOf(all, rev3)).toBe(3)
  })

  it('gives the next number even when revising from the middle', () => {
    // Revising Rev 2 while Rev 3 exists produces Rev 4, not a second Rev 3:
    // what a customer needs to know is which offer is the latest.
    expect(reviseDocument(rev2, { documents: all, on: '2026-09-12' }).revisionNumber).toBe(4)
  })

  it('finds the first offer from anywhere in the chain', () => {
    for (const document of all) expect(rootOf(all, document).id).toBe('doc_1')
  })

  it('reads the chain oldest first', () => {
    expect(chainOf(all, rev3).map((row) => row.id)).toEqual(['doc_1', 'doc_2', 'doc_3'])
  })

  it('does not hang on a chain that points at itself', () => {
    // Malformed data arriving from sync must not lock up the screen that
    // renders it (§M).
    const loop = [
      quote({ id: 'a', supersedesId: 'b' }),
      quote({ id: 'b', supersedesId: 'a' }),
    ]
    expect(rootOf(loop, loop[0]!).id).toBeTruthy()
    expect(chainOf(loop, loop[0]!).length).toBeGreaterThan(0)
  })

  it('numbers a chain of any length without gaps or repeats', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (length) => {
        const chain: RevisableDocument[] = []
        for (let i = 0; i < length; i += 1) {
          chain.push(
            quote({
              id: `doc_${i}`,
              ...(i === 0 ? {} : { supersedesId: `doc_${i - 1}` }),
            }),
          )
        }
        const numbers = chain.map((row) => revisionNumberOf(chain, row))
        return numbers.every((n, i) => n === i + 1)
      }),
    )
  })
})

describe('A retried duplicate is one document (§M)', () => {
  it('derives the key from the root and the number', () => {
    expect(revisionKeyFor('doc_1', 2)).toBe('rev:doc_1:2')
  })

  it('gives the same gesture the same key twice', () => {
    expect(revise().idempotencyKey).toBe(revise().idempotencyKey)
  })

  it('keys every revision of one chain to the same root', () => {
    const original = quote()
    const rev2 = quote({ id: 'doc_2', supersedesId: 'doc_1' })
    const key = reviseDocument(rev2, { documents: [original, rev2], on: '2026-09-12' })
      .idempotencyKey
    expect(key).toBe('rev:doc_1:3')
  })

  it('gives a deliberate later revision a different key', () => {
    const original = quote()
    const rev2 = quote({ id: 'doc_2', supersedesId: 'doc_1' })
    expect(revise().idempotencyKey).not.toBe(
      reviseDocument(rev2, { documents: [original, rev2], on: '2026-09-12' }).idempotencyKey,
    )
  })
})

describe('What comes across is the work (§G)', () => {
  it('carries the party, the lines and the signature', () => {
    const { draft } = revise(quote({ signatureAssetId: 'ast_1' }))
    expect(draft.customerId).toBe('cus_1')
    expect(draft.lineItems).toEqual([LINE])
    // The same business making the same offer again: asking for the mark a
    // second time would be a new required field on a duplicate (Rule #1).
    expect(draft.signatureAssetId).toBe('ast_1')
    expect(draft.type).toBe('quotation')
  })

  it('copies the lines rather than sharing them with the original', () => {
    const source = quote()
    const { draft } = revise(source)
    expect(draft.lineItems[0]).not.toBe(source.lineItems[0])
    expect(draft.lineItems[0]).toEqual(source.lineItems[0])
  })

  it('carries no frozen reference — the new offer earns its own (§M)', () => {
    expect(revise()).not.toHaveProperty('issuedReference')
    expect(Object.keys(revise().draft)).not.toContain('issuedReference')
  })

  it('dates the new offer today, never the original day', () => {
    expect(revise().draft.issueDate).toBe('2026-09-12')
  })

  it('does NOT carry the validity date', () => {
    // An expired quotation is the commonest reason to make a Rev 2. Copying
    // the old date would hand back an offer that is already expired.
    const expired = { ...quote(), validUntil: '2026-01-01' } as RevisableDocument
    const { draft } = revise(expired)
    expect(draft.validUntil).toBeUndefined()
  })
})
