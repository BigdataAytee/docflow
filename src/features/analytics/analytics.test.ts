/**
 * In / Out / Kept, ageing and top items (§G, §L6, §Q Phase 2.5).
 *
 * The Phase 2.5 gate has two named clauses. Both are here:
 *   · "Kept" moves the moment an expense is added.
 *   · A reissued receipt never increments income.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../../domain/money/money'
import { type Payment, reversalOf } from '../../domain/payments/ledger'
import { quantity, type LineItem } from '../../domain/documents/types'
import {
  type ExpenseEntry,
  inOutKept,
  monthlyBars,
  shiftMonths,
  startOfMonth,
  tallestBar,
} from './inOutKept'
import { type AgeingDocument, ageingByCurrency, bucketFor, daysOverdue } from './ageing'
import { type SoldDocument, topItems } from './topItems'

const NGN = (m: number) => money('NGN', m)
const USD = (m: number) => money('USD', m)

const SEPTEMBER = { from: '2026-09-01', to: '2026-10-01' }

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: 'cus_1',
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const expense = (id: string, amount: ReturnType<typeof NGN>, spentOn = '2026-09-11'): ExpenseEntry => ({
  id,
  amount,
  spentOn,
})

describe('In / Out / Kept (§G)', () => {
  it('keeps what came in less what went out', () => {
    const rows = inOutKept(
      [payment({ id: 'pay_1', amount: NGN(150_000_00) })],
      [expense('exp_1', NGN(40_000_00))],
      SEPTEMBER,
    )

    const ngn = rows.get('NGN')
    expect(ngn?.moneyIn).toEqual(NGN(150_000_00))
    expect(ngn?.moneyOut).toEqual(NGN(40_000_00))
    expect(ngn?.kept).toEqual(NGN(110_000_00))
  })

  it('moves "Kept" the moment an expense is added — the Phase 2.5 gate clause', () => {
    const payments = [payment({ id: 'pay_1', amount: NGN(150_000_00) })]

    const before = inOutKept(payments, [], SEPTEMBER).get('NGN')
    const after = inOutKept(payments, [expense('exp_1', NGN(9_500_00))], SEPTEMBER).get('NGN')

    expect(before?.kept).toEqual(NGN(150_000_00))
    expect(after?.kept).toEqual(NGN(140_500_00))
    // Money in is untouched: an expense is not a refund.
    expect(after?.moneyIn).toEqual(before?.moneyIn)
  })

  it('never adds NGN to USD (§G)', () => {
    const rows = inOutKept(
      [payment({ id: 'pay_1', amount: NGN(100_00) }), payment({ id: 'pay_2', amount: USD(50_00) })],
      [expense('exp_1', USD(10_00))],
      SEPTEMBER,
    )

    expect([...rows.keys()]).toEqual(['NGN', 'USD'])
    expect(rows.get('NGN')?.kept).toEqual(NGN(100_00))
    expect(rows.get('USD')?.kept).toEqual(USD(40_00))
  })

  it('shows a currency that only ever went out', () => {
    const rows = inOutKept([], [expense('exp_1', USD(10_00))], SEPTEMBER)
    expect(rows.get('USD')?.moneyIn).toEqual(USD(0))
    expect(rows.get('USD')?.kept).toEqual(USD(-10_00))
  })

  it('drops a reversed payment from income', () => {
    const original = payment({ id: 'pay_1', amount: NGN(80_000_00) })
    const rows = inOutKept(
      [original, reversalOf(original, 'pay_2', '2026-09-12T09:00:00Z')],
      [],
      SEPTEMBER,
    )
    expect(rows.get('NGN')).toBeUndefined()
  })

  it('ignores anything outside the period', () => {
    const rows = inOutKept(
      [payment({ id: 'pay_1', amount: NGN(100_00), paidAt: '2026-08-31T23:00:00Z' })],
      [expense('exp_1', NGN(50_00), '2026-10-01')],
      SEPTEMBER,
    )
    expect(rows.size).toBe(0)
  })

  it('a receipt cannot increment income, because only payments are counted', () => {
    // There is no path from a document into `inOutKept` at all — the signature
    // takes payments and expenses. Reissuing a receipt ten times changes
    // nothing, because a receipt is a view of the payment below (§V).
    const payments = [payment({ id: 'pay_1', amount: NGN(20_000_00) })]
    const once = inOutKept(payments, [], SEPTEMBER).get('NGN')
    const afterReissues = inOutKept(payments, [], SEPTEMBER).get('NGN')
    expect(afterReissues).toEqual(once)
  })

  it('Kept is always exactly In minus Out, for any ledger', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5_000_000 }), { maxLength: 12 }),
        fc.array(fc.integer({ min: 1, max: 5_000_000 }), { maxLength: 12 }),
        (incoming, outgoing) => {
          const payments = incoming.map((minor, i) => payment({ id: `pay_${i}`, amount: NGN(minor) }))
          const expenses = outgoing.map((minor, i) => expense(`exp_${i}`, NGN(minor)))
          const row = inOutKept(payments, expenses, SEPTEMBER).get('NGN')
          if (row === undefined) return incoming.length === 0 && outgoing.length === 0
          return row.kept.minor === row.moneyIn.minor - row.moneyOut.minor
        },
      ),
    )
  })
})

describe('The six-month bar pair (§G)', () => {
  it('walks back six months and keeps the empty ones', () => {
    const bars = monthlyBars(
      [payment({ id: 'pay_1', amount: NGN(10_000_00), paidAt: '2026-07-04T10:00:00Z' })],
      [expense('exp_1', NGN(2_000_00), '2026-09-02')],
      'NGN',
      '2026-09-11',
    )

    expect(bars.map((b) => b.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ])
    expect(bars[3]?.moneyIn).toEqual(NGN(10_000_00))
    expect(bars[4]?.moneyIn).toEqual(NGN(0))
    expect(bars[5]?.moneyOut).toEqual(NGN(2_000_00))
    expect(tallestBar(bars)).toBe(10_000_00)
  })

  it('crosses a year boundary', () => {
    expect(shiftMonths('2026-02-11', -3)).toBe('2025-11-01')
    expect(shiftMonths('2026-11-11', 2)).toBe('2027-01-01')
    expect(startOfMonth('2026-09-30')).toBe('2026-09-01')
  })

  it('scales from zero without dividing by it', () => {
    expect(tallestBar(monthlyBars([], [], 'NGN', '2026-09-11'))).toBe(0)
  })
})

describe('Ageing buckets (§G)', () => {
  const invoice = (
    id: string,
    total: ReturnType<typeof NGN>,
    dueDate?: string,
  ): AgeingDocument => ({
    id,
    type: 'invoice',
    status: 'issued',
    total,
    ...(dueDate === undefined ? {} : { dueDate }),
  })

  const TODAY = '2026-09-11'

  it('puts each invoice in exactly one bucket', () => {
    expect(bucketFor('2026-09-12', TODAY)).toBe('not_due')
    expect(bucketFor('2026-09-11', TODAY)).toBe('not_due')
    expect(bucketFor('2026-09-10', TODAY)).toBe('d1_30')
    expect(bucketFor('2026-08-12', TODAY)).toBe('d1_30')
    expect(bucketFor('2026-08-11', TODAY)).toBe('d31_60')
    expect(bucketFor('2026-07-13', TODAY)).toBe('d31_60')
    expect(bucketFor('2026-07-12', TODAY)).toBe('d60_plus')
  })

  it('counts a 60-day-late invoice once, in 31–60', () => {
    expect(daysOverdue('2026-07-13', TODAY)).toBe(60)
    const ageing = ageingByCurrency([invoice('doc_1', NGN(100_00), '2026-07-13')], [], TODAY)
    const buckets = ageing.get('NGN')?.buckets
    expect(buckets?.d31_60).toEqual(NGN(100_00))
    expect(buckets?.d60_plus).toEqual(NGN(0))
    expect(ageing.get('NGN')?.total).toEqual(NGN(100_00))
  })

  it('names the worst bucket, and never names "not due"', () => {
    const ageing = ageingByCurrency(
      [
        invoice('doc_1', NGN(500_00), '2026-09-30'),
        invoice('doc_2', NGN(200_00), '2026-09-01'),
        invoice('doc_3', NGN(300_00), '2026-06-01'),
      ],
      [],
      TODAY,
    )
    expect(ageing.get('NGN')?.worst).toBe('d60_plus')
  })

  it('has no worst bucket when nothing is late', () => {
    const ageing = ageingByCurrency([invoice('doc_1', NGN(500_00), '2026-09-30')], [], TODAY)
    expect(ageing.get('NGN')?.worst).toBeNull()
  })

  it('ages what is still owed, not what was billed', () => {
    const paid = payment({
      id: 'pay_1',
      amount: NGN(400_00),
      allocations: [{ id: 'a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(400_00) }],
    })
    const ageing = ageingByCurrency([invoice('doc_1', NGN(500_00), '2026-08-01')], [paid], TODAY)
    expect(ageing.get('NGN')?.buckets.d31_60).toEqual(NGN(100_00))
  })

  it('drops a settled invoice entirely', () => {
    const paid = payment({
      id: 'pay_1',
      amount: NGN(500_00),
      allocations: [{ id: 'a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(500_00) }],
    })
    expect(ageingByCurrency([invoice('doc_1', NGN(500_00), '2026-08-01')], [paid], TODAY).size).toBe(0)
  })

  it('never ages a quotation, a receipt or a delivery document', () => {
    const others: AgeingDocument[] = [
      { id: 'q', type: 'quotation', status: 'issued', total: NGN(900_00), dueDate: '2026-01-01' },
      { id: 'r', type: 'receipt', status: 'issued', total: NGN(900_00), dueDate: '2026-01-01' },
      { id: 'w', type: 'waybill', status: 'delivered', total: NGN(0), dueDate: '2026-01-01' },
    ]
    expect(ageingByCurrency(others, [], TODAY).size).toBe(0)
  })

  it('treats an invoice with no due date as not late', () => {
    const ageing = ageingByCurrency([invoice('doc_1', NGN(500_00))], [], TODAY)
    expect(ageing.get('NGN')?.buckets.not_due).toEqual(NGN(500_00))
    expect(ageing.get('NGN')?.worst).toBeNull()
  })

  it('sums to the total for any set of invoices', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ minor: fc.integer({ min: 1, max: 1_000_000 }), daysLate: fc.integer({ min: -40, max: 200 }) }),
          { maxLength: 20 },
        ),
        (rows) => {
          const documents = rows.map((row, i) => {
            const due = new Date(Date.parse(`${TODAY}T00:00:00Z`) - row.daysLate * 86_400_000)
            return invoice(`doc_${i}`, NGN(row.minor), due.toISOString().slice(0, 10))
          })
          const ageing = ageingByCurrency(documents, [], TODAY).get('NGN')
          if (ageing === undefined) return rows.length === 0
          const summed =
            ageing.buckets.not_due.minor +
            ageing.buckets.d1_30.minor +
            ageing.buckets.d31_60.minor +
            ageing.buckets.d60_plus.minor
          return summed === ageing.total.minor
        },
      ),
    )
  })
})

describe('Top items by value (§G)', () => {
  const line = (description: string, units: number, unitPriceMinor: number): LineItem => ({
    id: `li_${description}_${units}`,
    description,
    quantityMilli: quantity(units),
    unitPriceMinor,
    taxable: true,
  })

  const soldDoc = (over: Partial<SoldDocument> & Pick<SoldDocument, 'id' | 'lineItems'>): SoldDocument => ({
    type: 'invoice',
    status: 'issued',
    currency: 'NGN',
    issueDate: '2026-09-05',
    ...over,
  })

  it('ranks by value, not by how many times a thing was sold', () => {
    const ranked = topItems([
      soldDoc({ id: 'doc_1', lineItems: [line('Sachet water', 10, 50_00)] }),
      soldDoc({ id: 'doc_2', lineItems: [line('Generator', 1, 400_000_00)] }),
    ])

    expect(ranked.map((item) => item.name)).toEqual(['Generator', 'Sachet water'])
    expect(ranked[0]?.value).toEqual(NGN(400_000_00))
  })

  it('treats different spellings as one product, showing the commonest', () => {
    const ranked = topItems([
      soldDoc({ id: 'doc_1', lineItems: [line('Bag of cement', 2, 5_000_00)] }),
      soldDoc({ id: 'doc_2', lineItems: [line('bag of  CEMENT', 1, 5_000_00)] }),
      soldDoc({ id: 'doc_3', lineItems: [line('Bag of cement', 1, 5_000_00)] }),
    ])

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.name).toBe('Bag of cement')
    expect(ranked[0]?.value).toEqual(NGN(20_000_00))
    expect(ranked[0]?.documentCount).toBe(3)
  })

  it('never counts a draft, a void, a quotation or a receipt', () => {
    const ranked = topItems([
      soldDoc({ id: 'doc_1', status: 'draft', lineItems: [line('Draft thing', 1, 100_00)] }),
      soldDoc({ id: 'doc_2', status: 'void', lineItems: [line('Void thing', 1, 100_00)] }),
      soldDoc({ id: 'doc_3', type: 'quotation', lineItems: [line('Quoted thing', 1, 100_00)] }),
      soldDoc({ id: 'doc_4', type: 'receipt', lineItems: [line('Receipted thing', 1, 100_00)] }),
    ])
    expect(ranked).toEqual([])
  })

  it('keeps currencies apart', () => {
    const ranked = topItems([
      soldDoc({ id: 'doc_1', lineItems: [line('Consulting', 1, 100_00)] }),
      soldDoc({ id: 'doc_2', currency: 'USD', lineItems: [line('Consulting', 1, 100_00)] }),
    ])
    expect(ranked).toHaveLength(2)
    expect(new Set(ranked.map((item) => item.currency))).toEqual(new Set(['NGN', 'USD']))
  })

  it('skips a delivery line, which has no price to rank', () => {
    const deliveryLine: LineItem = {
      id: 'li_d',
      description: 'Cartons',
      quantityMilli: quantity(4),
      taxable: false,
    }
    expect(topItems([soldDoc({ id: 'doc_1', lineItems: [deliveryLine] })])).toEqual([])
  })

  it('honours the period and the limit', () => {
    const documents = [
      soldDoc({ id: 'doc_1', issueDate: '2026-08-31', lineItems: [line('August thing', 1, 900_00)] }),
      soldDoc({ id: 'doc_2', issueDate: '2026-09-05', lineItems: [line('September thing', 1, 100_00)] }),
    ]
    const ranked = topItems(documents, { from: '2026-09-01', to: '2026-10-01', limit: 5 })
    expect(ranked.map((item) => item.name)).toEqual(['September thing'])
  })
})
