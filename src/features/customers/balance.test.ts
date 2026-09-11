/**
 * Customer balances (§G). The §V clause these exist for: "A part payment
 * updates invoice, customer, Home and analytics once."
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import { reversalOf } from '../../domain/payments/ledger'
import {
  type BilledInvoice,
  customerBalances,
  hasOutstanding,
  paymentBehaviour,
  totalAcrossCurrencies,
} from './balance'

const NGN = (m: number) => money('NGN', m)
const CUST = 'cus_1'

const invoice = (over: Partial<BilledInvoice> & Pick<BilledInvoice, 'id' | 'total'>): BilledInvoice => ({
  customerId: CUST,
  status: 'issued',
  issueDate: '2026-09-01',
  ...over,
})

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: CUST,
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const allocation = (paymentId: string, invoiceId: string, minor: number) => ({
  id: `${paymentId}:${invoiceId}`,
  paymentId,
  invoiceId,
  amount: NGN(minor),
})

describe('A part payment moves the customer balance once (§L3, §V)', () => {
  const invoices = [invoice({ id: 'inv-1', total: NGN(145_000_00) })]
  const p = payment({
    id: 'p1',
    amount: NGN(50_000_00),
    allocations: [allocation('p1', 'inv-1', 50_000_00)],
  })

  it('shows billed, paid and owing that agree with each other', () => {
    const [balance] = customerBalances(CUST, invoices, [p])
    expect(balance?.billed).toEqual(NGN(145_000_00))
    expect(balance?.paid).toEqual(NGN(50_000_00))
    expect(balance?.owing).toEqual(NGN(95_000_00))
  })

  it('does not double-count when the same payment is read twice', () => {
    const once = customerBalances(CUST, invoices, [p])
    const twice = customerBalances(CUST, invoices, [p])
    expect(twice).toEqual(once)
  })

  it('drops a reversed payment back out of the balance', () => {
    const reversal = reversalOf(p, 'p1r', '2026-09-12T00:00:00Z')
    const [balance] = customerBalances(CUST, invoices, [p, reversal])
    expect(balance?.paid).toEqual(NGN(0))
    expect(balance?.owing).toEqual(NGN(145_000_00))
  })
})

describe('Currencies are never added together (§G, §V)', () => {
  it('returns one balance per currency', () => {
    const balances = customerBalances(
      CUST,
      [
        invoice({ id: 'inv-1', total: NGN(100_000_00) }),
        invoice({ id: 'inv-2', total: money('USD', 500_00) }),
      ],
      [],
    )
    expect(balances.map((b) => b.currency)).toEqual(['NGN', 'USD'])
    expect(balances.find((b) => b.currency === 'NGN')?.owing).toEqual(NGN(100_000_00))
    expect(balances.find((b) => b.currency === 'USD')?.owing).toEqual(money('USD', 500_00))
  })

  it('refuses to produce a combined total at all', () => {
    expect(() => totalAcrossCurrencies()).toThrow(/never added together/i)
  })
})

describe('What counts as billed', () => {
  it('excludes drafts and voided invoices', () => {
    const balances = customerBalances(
      CUST,
      [
        invoice({ id: 'inv-1', total: NGN(100_00), status: 'draft' }),
        invoice({ id: 'inv-2', total: NGN(200_00), status: 'void' }),
        invoice({ id: 'inv-3', total: NGN(300_00), status: 'issued' }),
      ],
      [],
    )
    expect(balances[0]?.billed).toEqual(NGN(300_00))
  })

  it('ignores another customer entirely', () => {
    const balances = customerBalances(
      CUST,
      [invoice({ id: 'inv-1', total: NGN(100_00), customerId: 'someone_else' })],
      [],
    )
    expect(balances).toEqual([])
    expect(hasOutstanding(balances)).toBe(false)
  })

  it('nets a credit note without moving paid', () => {
    const balances = customerBalances(
      CUST,
      [invoice({ id: 'inv-1', total: NGN(145_000_00) })],
      [],
      [{ id: 'cn1', invoiceId: 'inv-1', amount: NGN(45_000_00) }],
    )
    expect(balances[0]?.credited).toEqual(NGN(45_000_00))
    expect(balances[0]?.owing).toEqual(NGN(100_000_00))
    expect(balances[0]?.paid).toEqual(NGN(0))
  })

  it('keeps billed, paid, credited and owing consistent for any ledger', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5_000_000 }), { minLength: 1, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 5_000_000 }), { maxLength: 6 }),
        (totals, paids) => {
          const invoices = totals.map((t, i) => invoice({ id: `inv-${i}`, total: NGN(t) }))
          const payments = paids.map((amount, i) =>
            payment({
              id: `p${i}`,
              amount: NGN(amount),
              allocations:
                amount === 0 || totals[i] === undefined
                  ? []
                  : [allocation(`p${i}`, `inv-${i}`, Math.min(amount, totals[i]))],
            }),
          )
          const [b] = customerBalances(CUST, invoices, payments)
          if (b === undefined) return
          // The three figures on screen must always reconcile.
          expect(b.paid.minor + b.owing.minor + b.credited.minor).toBe(b.billed.minor)
          expect(b.owing.minor).toBeGreaterThanOrEqual(0)
          expect(b.progress).toBeGreaterThanOrEqual(0)
          expect(b.progress).toBeLessThanOrEqual(1)
        },
      ),
    )
  })
})

describe('"Pays on average N days late" (§G)', () => {
  const settled = (id: string, dueDate: string, paidAt: string, amount: number) => ({
    invoice: invoice({ id, total: NGN(amount), dueDate }),
    payment: payment({
      id: `p-${id}`,
      amount: NGN(amount),
      paidAt,
      allocations: [allocation(`p-${id}`, id, amount)],
    }),
  })

  it('averages days late across settled invoices', () => {
    const a = settled('inv-1', '2026-09-01', '2026-09-09T00:00:00Z', 1000) // 8 late
    const b = settled('inv-2', '2026-09-01', '2026-09-11T00:00:00Z', 1000) // 10 late
    const behaviour = paymentBehaviour(CUST, [a.invoice, b.invoice], [a.payment, b.payment])
    expect(behaviour).toEqual({ averageDaysLate: 9, sampleSize: 2 })
  })

  it('reports early payers as negative', () => {
    const a = settled('inv-1', '2026-09-10', '2026-09-08T00:00:00Z', 1000)
    const b = settled('inv-2', '2026-09-10', '2026-09-06T00:00:00Z', 1000)
    expect(paymentBehaviour(CUST, [a.invoice, b.invoice], [a.payment, b.payment])?.averageDaysLate).toBe(-3)
  })

  it('says nothing below the sample floor rather than dressing up one point', () => {
    const a = settled('inv-1', '2026-09-01', '2026-09-09T00:00:00Z', 1000)
    expect(paymentBehaviour(CUST, [a.invoice], [a.payment])).toBeNull()
  })

  it('ignores unpaid invoices — being owed money is not evidence of lateness', () => {
    const a = settled('inv-1', '2026-09-01', '2026-09-09T00:00:00Z', 1000)
    const b = settled('inv-2', '2026-09-01', '2026-09-11T00:00:00Z', 1000)
    const unpaid = invoice({ id: 'inv-3', total: NGN(999_00), dueDate: '2026-01-01' })
    const behaviour = paymentBehaviour(CUST, [a.invoice, b.invoice, unpaid], [a.payment, b.payment])
    expect(behaviour?.sampleSize).toBe(2)
  })

  it('ignores invoices with no due date', () => {
    const a = settled('inv-1', '2026-09-01', '2026-09-09T00:00:00Z', 1000)
    const noDue = invoice({ id: 'inv-2', total: NGN(1000) })
    expect(paymentBehaviour(CUST, [a.invoice, noDue], [a.payment])).toBeNull()
  })
})
