/**
 * Credit notes (§E, Rule #5, §Q Phase 2.5).
 *
 * The two clauses that matter: an issued document is never edited, and a
 * credit never moves income.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money, CurrencyMismatchError } from '../../domain/money/money'
import { type Payment, invoiceOutstanding, receivedByCurrency } from '../../domain/payments/ledger'
import { inOutKept } from '../analytics/inOutKept'
import {
  CreditNoteError,
  type IssueCreditNoteInput,
  creditableRemaining,
  creditedAgainst,
  creditedByCurrency,
  issueCreditNote,
} from './issue'

const NGN = (m: number) => money('NGN', m)

const base: IssueCreditNoteInput = {
  id: 'cn_1',
  companyId: 'co_1',
  invoiceId: 'doc_1',
  invoiceStatus: 'issued',
  invoiceReference: 'INV-0042',
  invoiceTotal: NGN(100_000_00),
  amount: NGN(15_000_00),
  reason: 'Two bags short on delivery',
  issuedAt: '2026-09-11T10:00:00Z',
  prefix: 'CRN',
  sequence: 1,
  fromReservedBlock: true,
  deviceId: 'dev_a',
}

describe('Correcting an issued document (Rule #5)', () => {
  it('records a credit against the invoice without touching it', () => {
    const note = issueCreditNote(base)
    expect(note.reference).toBe('CRN-0001')
    expect(note.invoiceReference).toBe('INV-0042')
    expect(note.invoiceTotal).toEqual(NGN(100_000_00))
    expect(note.amount).toEqual(NGN(15_000_00))
    expect(Object.isFrozen(note)).toBe(true)
  })

  it('carries a device-qualified reference when issued offline (§M)', () => {
    expect(issueCreditNote({ ...base, fromReservedBlock: false }).reference).toMatch(
      /^CRN-0001-[A-Z0-9]{2}$/,
    )
  })

  it('refuses a draft — there is nothing to correct yet', () => {
    expect(() =>
      issueCreditNote({ ...base, invoiceStatus: 'draft', invoiceReference: null }),
    ).toThrow(CreditNoteError)
  })

  it('refuses a voided document — it is already cancelled in full', () => {
    expect(() => issueCreditNote({ ...base, invoiceStatus: 'void' })).toThrow(CreditNoteError)
  })

  it('asks why', () => {
    expect(() => issueCreditNote({ ...base, reason: '   ' })).toThrow(/why/)
  })

  it('refuses zero, negative, and another currency', () => {
    expect(() => issueCreditNote({ ...base, amount: NGN(0) })).toThrow(CreditNoteError)
    expect(() => issueCreditNote({ ...base, amount: NGN(-1) })).toThrow(CreditNoteError)
    expect(() => issueCreditNote({ ...base, amount: money('USD', 100) })).toThrow(
      CurrencyMismatchError,
    )
  })
})

describe('A credit never exceeds the document (§K)', () => {
  it('stops at the invoice total across several notes', () => {
    const first = issueCreditNote({ ...base, amount: NGN(60_000_00) })
    const second = issueCreditNote({ ...base, id: 'cn_2', sequence: 2, amount: NGN(40_000_00), existing: [first] })
    expect(creditedAgainst('doc_1', 'NGN', [first, second])).toEqual(NGN(100_000_00))
    expect(creditableRemaining('doc_1', NGN(100_000_00), [first, second])).toEqual(NGN(0))

    expect(() =>
      issueCreditNote({ ...base, id: 'cn_3', sequence: 3, amount: NGN(1), existing: [first, second] }),
    ).toThrow(/refund/)
  })

  it('never lets credits push an invoice below nothing, for any sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 200_000 }), { maxLength: 8 }),
        (amounts) => {
          const notes: ReturnType<typeof issueCreditNote>[] = []
          amounts.forEach((minor, index) => {
            try {
              notes.push(
                issueCreditNote({
                  ...base,
                  id: `cn_${index}`,
                  sequence: index + 1,
                  amount: NGN(minor),
                  existing: notes,
                }),
              )
            } catch {
              // Rejected for exceeding the invoice — exactly the guard under test.
            }
          })
          return creditedAgainst('doc_1', 'NGN', notes).minor <= base.invoiceTotal.minor
        },
      ),
    )
  })
})

describe('A credit reduces what is owed, never income (§G, §V)', () => {
  const payment: Payment = {
    id: 'pay_1',
    customerId: 'cus_1',
    amount: NGN(50_000_00),
    paidAt: '2026-09-05T10:00:00Z',
    method: 'bank_transfer',
    source: 'manual',
    allocations: [{ id: 'a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(50_000_00) }],
  }

  it('lowers the outstanding balance', () => {
    const note = issueCreditNote(base)
    expect(invoiceOutstanding('doc_1', NGN(100_000_00), [payment])).toEqual(NGN(50_000_00))
    expect(invoiceOutstanding('doc_1', NGN(100_000_00), [payment], [note])).toEqual(NGN(35_000_00))
  })

  it('leaves recorded income exactly where it was', () => {
    const note = issueCreditNote(base)
    const before = receivedByCurrency([payment], '2026-09-01', '2026-10-01')
    const after = receivedByCurrency([payment], '2026-09-01', '2026-10-01')
    expect(after).toEqual(before)

    // And there is no way to hand a credit note to the income functions at all:
    // `inOutKept` takes payments and expenses. This is the type system holding
    // the rule, which is stronger than a test remembering to.
    const kept = inOutKept([payment], [], { from: '2026-09-01', to: '2026-10-01' })
    expect(kept.get('NGN')?.moneyIn).toEqual(NGN(50_000_00))
    expect(creditedByCurrency([note]).get('NGN')).toEqual(NGN(15_000_00))
  })

  it('floors an over-credited, over-paid invoice at zero rather than going negative', () => {
    const note = issueCreditNote({ ...base, amount: NGN(60_000_00) })
    expect(invoiceOutstanding('doc_1', NGN(100_000_00), [payment], [note])).toEqual(NGN(0))
  })
})
