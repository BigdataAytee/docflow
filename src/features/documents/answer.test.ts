/**
 * The customer's answer to a quotation (§G, §P).
 */

import { describe, expect, it } from 'vitest'

import { canTransition } from '../../domain/documents/lifecycle'
import {
  AnswerError,
  answerOn,
  type AnswerableDocument,
  answerQuotation,
  answersFor,
  canAnswer,
  reasonsAnswerIsBlocked,
} from './answer'

const quote = (status: string): AnswerableDocument => ({
  id: 'doc_1',
  type: 'quotation',
  status,
})

describe('An offer that has been made can be answered (§G)', () => {
  it('can be accepted or turned down once issued or sent', () => {
    for (const status of ['issued', 'sent']) {
      expect(answersFor(quote(status))).toEqual(['accepted', 'rejected'])
    }
  })

  it('cannot be answered while it is still a draft', () => {
    // Nobody has been offered anything yet.
    expect(reasonsAnswerIsBlocked(quote('draft'), 'accepted')).toBe('not_issued')
    expect(answersFor(quote('draft'))).toEqual([])
  })

  it('cannot be answered once withdrawn', () => {
    expect(reasonsAnswerIsBlocked(quote('void'), 'accepted')).toBe('void')
    expect(answersFor(quote('void'))).toEqual([])
  })

  it('is offered on no other type', () => {
    for (const type of ['invoice', 'receipt', 'waybill'] as const) {
      expect(reasonsAnswerIsBlocked({ id: 'd', type, status: 'issued' }, 'accepted')).toBe(
        'not_a_quotation',
      )
    }
  })
})

describe('An answer is final (§P, Rule #5)', () => {
  it('offers nothing more once an offer has been answered', () => {
    // The lifecycle lets an answered quotation go to `void` and nowhere else.
    // That is right rather than restrictive: an accepted offer may already
    // have become an invoice, and flipping it back to "turned down" would
    // erase that while the invoice it produced still stood.
    expect(answersFor(quote('accepted'))).toEqual([])
    expect(answersFor(quote('rejected'))).toEqual([])
  })

  it('says the offer is already answered, rather than refusing blankly', () => {
    expect(reasonsAnswerIsBlocked(quote('accepted'), 'rejected')).toBe('already_answered')
    expect(reasonsAnswerIsBlocked(quote('rejected'), 'accepted')).toBe('already_answered')
  })

  it('reads back the answer that was recorded', () => {
    expect(answerOn(quote('accepted'))).toBe('accepted')
    expect(answerOn(quote('rejected'))).toBe('rejected')
    expect(answerOn(quote('sent'))).toBeNull()
  })

  it('agrees with the table the server revalidates against (§P)', () => {
    // A rule invented here to be convenient would be rejected on sync.
    for (const answer of ['accepted', 'rejected'] as const) {
      expect(canTransition('quotation', 'accepted', answer)).toBe(false)
      expect(canTransition('quotation', 'rejected', answer)).toBe(false)
    }
  })
})

describe('An expired offer is answered as it stands (Rule #3)', () => {
  it('can still be accepted, because expiry is a date and not a status', () => {
    // `deriveQuotationState` calls it expired at read time; underneath it is
    // still `sent`. Whether to honour an old price is the owner's call.
    expect(canAnswer(quote('sent'), 'accepted')).toBe(true)
  })
})

describe('An answer moves the status and nothing else (Rule #5)', () => {
  it('says so in the value, not in a comment', () => {
    expect(answerQuotation(quote('sent'), 'accepted')).toEqual({
      documentId: 'doc_1',
      to: 'accepted',
      isStatusOnly: true,
    })
  })

  it('cannot be edited after the fact', () => {
    expect(Object.isFrozen(answerQuotation(quote('sent'), 'accepted'))).toBe(true)
  })

  it('throws rather than quietly answering something it should not', () => {
    expect(() => answerQuotation(quote('draft'), 'accepted')).toThrow(AnswerError)
    expect(() => answerQuotation({ id: 'd', type: 'invoice', status: 'issued' }, 'accepted'))
      .toThrow(AnswerError)
  })

  it('carries a token, so the sheet can say which refusal it was', () => {
    try {
      answerQuotation(quote('void'), 'accepted')
      expect.unreachable()
    } catch (cause) {
      expect((cause as AnswerError).field).toBe('void')
    }
  })
})
