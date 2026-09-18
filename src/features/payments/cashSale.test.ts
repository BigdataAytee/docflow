/**
 * A cash sale that was not paid in full (§G, §K, §V).
 *
 * Somebody sells ₦100,000 of goods over the counter and is handed ₦40,000.
 * The receipt can say what happened; a receipt is not a claim on anybody. If
 * the app stops there the ₦60,000 still owed appears in no balance, no
 * Outstanding, no ageing report and nothing to chase — real in the yard,
 * invisible in the ledger.
 *
 * These are the arithmetic and the shape of the bill. The wiring that writes
 * them is guarded where a person can reach it, in `routes.test.tsx`.
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'
import {
  CashSaleError,
  cashSaleSplit,
  invoiceForCashSale,
  invoiceForCashSaleKeyFor,
  saleTotal,
} from './cashSale'

const NGN = (minor: number) => money('NGN', minor)

const line = (description: string, units: number, priceMinor: number) => ({
  id: `l:${description}`,
  description,
  quantityMilli: quantity(units),
  unitPriceMinor: priceMinor,
  taxable: false,
})

const receipt = (over: Partial<Parameters<typeof invoiceForCashSale>[0]['receipt']> = {}) => ({
  currency: 'NGN',
  customerId: 'cus_1',
  lineItems: [line('Cement, 20 bags', 20, 5_000_00)],
  ...over,
})

describe('What the goods came to, and what was handed over', () => {
  it('sums the sale from its own lines, never from the payment (§V)', () => {
    expect(saleTotal('NGN', [line('Cement', 20, 5_000_00), line('Sand', 2, 38_000_00)])).toEqual(
      NGN(176_000_00),
    )
  })

  it('splits a part payment into paid and still owed', () => {
    const split = cashSaleSplit({ total: NGN(100_000_00), paidMinor: 40_000_00 })
    expect(split.paid).toEqual(NGN(40_000_00))
    expect(split.balance).toEqual(NGN(60_000_00))
    expect(split.paidInFull).toBe(false)
  })

  /** The common case, and it must stay the cheap one. */
  it('reads paid in full when nothing is left', () => {
    expect(cashSaleSplit({ total: NGN(100_000_00), paidMinor: 100_000_00 }).paidInFull).toBe(true)
  })

  /**
   * Handing over more than the goods came to is customer credit (§K), not a
   * negative debt — so no invoice is created for a balance nobody owes.
   */
  it('never reports a negative balance', () => {
    const split = cashSaleSplit({ total: NGN(100_000_00), paidMinor: 150_000_00 })
    expect(split.balance).toEqual(NGN(0))
    expect(split.paidInFull).toBe(true)
  })
})

describe('The bill a short-paid sale becomes', () => {
  /**
   * IN FULL, never for the remainder. Billing ₦60,000 would quietly rewrite
   * the sale to match what was left over: the customer's history would show a
   * purchase they never made, and the ₦40,000 they handed over would be
   * allocated to nothing.
   */
  it('bills the whole sale, not the remainder', () => {
    const billed = invoiceForCashSale({
      receipt: receipt({ paidAmountMinor: 40_000_00 }),
      receiptId: 'doc_rec',
      today: '2026-09-18',
    })
    expect(billed.invoice.type).toBe('invoice')
    expect(saleTotal('NGN', billed.invoice.lineItems)).toEqual(NGN(100_000_00))
    expect(billed.split.balance).toEqual(NGN(60_000_00))
  })

  it('carries the sale’s own goods, with their own line ids', () => {
    const billed = invoiceForCashSale({
      receipt: receipt({ paidAmountMinor: 40_000_00 }),
      receiptId: 'doc_rec',
      today: '2026-09-18',
    })
    expect(billed.invoice.lineItems.map((row) => row.description)).toEqual(['Cement, 20 bags'])
    // Not the receipt's ids: two documents claiming the same rows is a shape
    // §E's line-item json cannot express and sync would have to guess at.
    expect(billed.invoice.lineItems[0]?.id).not.toBe('l:Cement, 20 bags')
  })

  /** Due today: the goods have gone, so the debt is already owed. */
  it('is due the day it is written', () => {
    const billed = invoiceForCashSale({
      receipt: receipt({ paidAmountMinor: 40_000_00 }),
      receiptId: 'doc_rec',
      today: '2026-09-18',
    })
    expect(billed.invoice.issueDate).toBe('2026-09-18')
    expect(billed.invoice.dueDate).toBe('2026-09-18')
  })

  /**
   * ONE KEY PER RECEIPT, so saving twice finds the invoice the first save
   * made rather than billing the customer again (§M). Arithmetic, not a check
   * that could race.
   */
  it('mints the same key however many times it is asked', () => {
    expect(invoiceForCashSaleKeyFor('doc_rec')).toBe(invoiceForCashSaleKeyFor('doc_rec'))
    expect(invoiceForCashSaleKeyFor('doc_rec')).not.toBe(invoiceForCashSaleKeyFor('doc_other'))
    expect(
      invoiceForCashSale({
        receipt: receipt({ paidAmountMinor: 40_000_00 }),
        receiptId: 'doc_rec',
        today: '2026-09-18',
      }).idempotencyKey,
    ).toBe(invoiceForCashSaleKeyFor('doc_rec'))
  })
})

describe('What it refuses, and why', () => {
  /** Paid in full is the common case: no bill, no second document, no tap. */
  it('refuses to bill a sale that was paid in full', () => {
    expect(() =>
      invoiceForCashSale({
        receipt: receipt({ paidAmountMinor: 100_000_00 }),
        receiptId: 'doc_rec',
        today: '2026-09-18',
      }),
    ).toThrow(CashSaleError)
  })

  /** A debt needs somebody to owe it. */
  it('refuses without a customer', () => {
    expect(() =>
      invoiceForCashSale({
        receipt: { currency: 'NGN', lineItems: receipt().lineItems, paidAmountMinor: 40_000_00 },
        receiptId: 'doc_rec',
        today: '2026-09-18',
      }),
    ).toThrow(CashSaleError)
  })

  /** And something to have been sold. */
  it('refuses with no goods', () => {
    expect(() =>
      invoiceForCashSale({
        receipt: receipt({ lineItems: [], paidAmountMinor: 40_000_00 }),
        receiptId: 'doc_rec',
        today: '2026-09-18',
      }),
    ).toThrow(CashSaleError)
  })

  /**
   * The reason is a CODE, not prose. Rule #4's lint rule refuses an English
   * error message naming a document type, and an error a screen has to show
   * has to come from the catalogue anyway.
   */
  it('names its reason without naming a type in English', () => {
    try {
      invoiceForCashSale({
        receipt: receipt({ paidAmountMinor: 100_000_00 }),
        receiptId: 'doc_rec',
        today: '2026-09-18',
      })
      expect.unreachable()
    } catch (cause) {
      expect(cause).toBeInstanceOf(CashSaleError)
      expect((cause as CashSaleError).reason).toBe('overpaid')
    }
  })
})
