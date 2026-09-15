/**
 * Cancelling a document (Rule #5, §G, §M).
 *
 * The two rules that matter are both about money: an invoice with money
 * against it is never voided, and voiding a receipt never un-receives cash.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import type { CreditNote, Payment } from '../../domain/payments/ledger'
import { DOCUMENT_TYPES } from '../../domain/documents/types'
import { receivedByCurrency } from '../../domain/payments/ledger'
import { isEvidenceSealed } from '../../domain/documents/lifecycle'
import {
  VoidError,
  type VoidableDocument,
  alternativesFor,
  canVoid,
  paymentsAgainst,
  reasonsVoidIsBlocked,
  voidDocument,
} from './void'

const NGN = (m: number) => money('NGN', m)

const doc = (
  over: Partial<VoidableDocument> & Pick<VoidableDocument, 'type' | 'status'>,
): VoidableDocument => ({
  id: 'doc_1',
  currency: 'NGN',
  total: NGN(145_000_00),
  ...over,
})

const allocated = (minor: number, invoiceId = 'doc_1'): Payment => ({
  id: `pay_${minor}`,
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt: '2026-09-10T09:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [{ id: `a_${minor}`, paymentId: `pay_${minor}`, invoiceId, amount: NGN(minor) }],
})

const standalone = (minor: number): Payment => ({
  id: `pay_solo_${minor}`,
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt: '2026-09-10T09:00:00Z',
  method: 'cash',
  source: 'manual',
  allocations: [],
})

describe('What can be cancelled (§M lifecycle)', () => {
  it('cancels an issued invoice with nothing against it', () => {
    expect(canVoid(doc({ type: 'invoice', status: 'issued' }), [])).toBe(true)
  })

  it('refuses one already cancelled, by name', () => {
    expect(reasonsVoidIsBlocked(doc({ type: 'invoice', status: 'void' }), [])).toEqual([
      'already_void',
    ])
  })

  it('cancels a delivery still in transit', () => {
    expect(canVoid(doc({ type: 'waybill', status: 'in_transit' }), [])).toBe(true)
  })

  it('refuses a DELIVERED delivery — the evidence is sealed (§M, §P)', () => {
    // Somebody signed for these goods. `isEvidenceSealed` says so, and the
    // lifecycle gives `delivered` nowhere to go: cancelling it would erase a
    // signature, which §M puts alongside payment events as never overwritten.
    expect(isEvidenceSealed('waybill', 'delivered')).toBe(true)
    expect(reasonsVoidIsBlocked(doc({ type: 'waybill', status: 'delivered' }), [])).toEqual([
      'not_a_transition',
    ])
  })

  it('refuses one already cancelled, whatever its type', () => {
    expect(reasonsVoidIsBlocked(doc({ type: 'waybill', status: 'void' }), [])).toEqual([
      'already_void',
    ])
  })

  it('never contradicts the lifecycle, for any type and status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DOCUMENT_TYPES),
        fc.constantFrom('draft', 'issued', 'sent', 'accepted', 'rejected', 'dispatched', 'in_transit', 'delivered', 'void'),
        (type, status) => {
          const document = doc({ type, status })
          const blocked = reasonsVoidIsBlocked(document, [])
          // Either it can be voided, or there is a named reason it cannot.
          return canVoid(document, []) === (blocked.length === 0)
        },
      ),
    )
  })
})

describe('An invoice with money against it is never cancelled', () => {
  it('refuses, and says it is because money came in', () => {
    const blocked = reasonsVoidIsBlocked(doc({ type: 'invoice', status: 'issued' }), [
      allocated(50_000_00),
    ])
    expect(blocked).toEqual(['money_received'])
  })

  it('throws rather than quietly cancelling', () => {
    expect(() =>
      voidDocument({
        document: doc({ type: 'invoice', status: 'issued' }),
        payments: [allocated(50_000_00)],
        at: '2026-09-12T10:00:00Z',
      }),
    ).toThrow(VoidError)
  })

  it('ignores a payment allocated to some other invoice', () => {
    expect(
      canVoid(doc({ type: 'invoice', status: 'issued' }), [allocated(50_000_00, 'doc_other')]),
    ).toBe(true)
  })

  it('ignores an unallocated payment — that is customer credit, not this invoice', () => {
    expect(canVoid(doc({ type: 'invoice', status: 'issued' }), [standalone(50_000_00)])).toBe(true)
  })

  it('offers both ways out while something is still owed', () => {
    expect(
      alternativesFor(doc({ type: 'invoice', status: 'issued' }), [allocated(50_000_00)]),
    ).toEqual(['credit_the_balance', 'reverse_the_payment'])
  })

  it('stops offering to credit a fully settled invoice — there is no balance', () => {
    expect(
      alternativesFor(doc({ type: 'invoice', status: 'issued' }), [allocated(145_000_00)]),
    ).toEqual(['reverse_the_payment'])
  })

  it('counts existing credits when deciding whether a balance is left', () => {
    const notes: CreditNote[] = [{ id: 'crn_1', invoiceId: 'doc_1', amount: NGN(95_000_00) }]
    expect(
      alternativesFor(doc({ type: 'invoice', status: 'issued' }), [allocated(50_000_00)], notes),
    ).toEqual(['reverse_the_payment'])
  })

  it('offers nothing when the void was never about money', () => {
    expect(alternativesFor(doc({ type: 'invoice', status: 'issued' }), [])).toEqual([])
  })

  it('names the payments that would be left dangling', () => {
    const against = paymentsAgainst('doc_1', [allocated(50_000_00), allocated(10_000_00, 'other')])
    expect(against.map((payment) => payment.amount.minor)).toEqual([50_000_00])
  })
})

describe('Cancelling a receipt never un-receives the money (§V)', () => {
  it('is allowed even though a payment exists, because the payment is the ledger', () => {
    // A receipt's payment is not allocated TO the receipt; it belongs to the
    // ledger. Cancelling the paper cannot take the cash back.
    const receipt = doc({ type: 'receipt', status: 'issued', total: NGN(50_000_00) })
    expect(canVoid(receipt, [standalone(50_000_00)])).toBe(true)
  })

  it('says out loud that payments are left alone', () => {
    const decision = voidDocument({
      document: doc({ type: 'receipt', status: 'issued' }),
      payments: [standalone(50_000_00)],
      at: '2026-09-12T10:00:00Z',
    })
    expect(decision.leavesPaymentsAlone).toBe(true)
  })

  it('leaves recorded income exactly where it was', () => {
    const payments = [standalone(50_000_00)]
    const before = receivedByCurrency(payments, '2026-09-01', '2026-10-01')
    voidDocument({
      document: doc({ type: 'receipt', status: 'issued' }),
      payments,
      at: '2026-09-12T10:00:00Z',
    })
    // Nothing in `voidDocument` can touch the ledger: it returns a decision
    // about one status and takes payments only to read them.
    expect(receivedByCurrency(payments, '2026-09-01', '2026-10-01')).toEqual(before)
  })
})

describe('The decision itself', () => {
  /**
   * It used to demand a reason and then discard it: nothing stores a void
   * reason, §E has no column for one, and the call site persists the status
   * alone. A required field that exists only to be thrown away is Rule #1's
   * "no new required fields" broken for nothing, so the demand is gone and
   * this is the case that keeps it gone.
   */
  it('cancels without asking for a justification (Rule #1)', () => {
    expect(() =>
      voidDocument({
        document: doc({ type: 'invoice', status: 'issued' }),
        payments: [],
        at: '2026-09-12T10:00:00Z',
      }),
    ).not.toThrow()
  })

  /**
   * What actually protects the document is unchanged, and it is the real
   * reason this sheet exists: money that has arrived blocks the cancel
   * outright, whatever anybody types.
   */
  it('still refuses when money has come in (Rule #3)', () => {
    expect(() =>
      voidDocument({
        document: doc({ type: 'invoice', status: 'issued' }),
        payments: [allocated(50_000_00)],
        at: '2026-09-12T10:00:00Z',
      }),
    ).toThrow(VoidError)
  })

  it('moves only the status, and is frozen', () => {
    const decision = voidDocument({
      document: doc({ type: 'invoice', status: 'issued' }),
      payments: [],
      at: '2026-09-12T10:00:00Z',
    })
    expect(decision).toMatchObject({ documentId: 'doc_1', to: 'void' })
    // And no reason: nothing stores one, so the decision does not carry one.
    expect(decision).not.toHaveProperty('reason')
    // No reference, no labels, no totals: a void is not an edit (§M).
    expect(decision).not.toHaveProperty('issuedReference')
    expect(decision).not.toHaveProperty('frozenLabels')
    expect(decision).not.toHaveProperty('totalMinor')
    expect(Object.isFrozen(decision)).toBe(true)
  })
})
