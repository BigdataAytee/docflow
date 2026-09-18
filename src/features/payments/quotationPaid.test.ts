/**
 * "They've paid" on an accepted quotation (§G, §K, §M).
 *
 * Two entry points — the quotation's own action and the receipt flow's picker
 * — must produce the same thing, or the app has two opinions about one sale.
 * These are the properties that make them one path rather than two that
 * resemble each other.
 */

import { describe, expect, it } from 'vitest'

import {
  QuotationPaidError,
  invoiceForPaidQuotation,
  invoiceFromQuotationKeyFor,
  quotationIsPayable,
} from './quotationPaid'
import { quantity } from '../../domain/documents/types'

const quotation = (over: Record<string, unknown> = {}) => ({
  id: 'doc_quote',
  type: 'quotation' as const,
  status: 'accepted',
  currency: 'NGN',
  customerId: 'cus_1',
  lineItems: [
    {
      id: 'l1',
      description: 'Roofing sheets',
      quantityMilli: quantity(10),
      unitPriceMinor: 1_850_000_00,
      taxable: true,
    },
  ],
  ...over,
})

describe('The invoice a paid quotation becomes', () => {
  /**
   * THE INVOICE IS ALWAYS CREATED. A receipt hanging off a quotation would be
   * evidence of money against a document that never billed anybody — the sale
   * would never appear in what was invoiced, and an OFFER would have a payment
   * attached to it (§G).
   */
  it('carries the quotation’s work onto an invoice', () => {
    const made = invoiceForPaidQuotation(quotation(), '2026-09-18')
    expect(made.invoice.type).toBe('invoice')
    expect(made.invoice.customerId).toBe('cus_1')
    expect(made.invoice.lineItems).toHaveLength(1)
    expect(made.invoice.lineItems[0]?.unitPriceMinor).toBe(1_850_000_00)
  })

  /** Both documents name each other — the link is on the NEW one (§G). */
  it('links back to the quotation it came from', () => {
    expect(invoiceForPaidQuotation(quotation(), '2026-09-18').convertedFromId).toBe('doc_quote')
  })

  it('is dated today, not the quotation’s day', () => {
    expect(invoiceForPaidQuotation(quotation(), '2026-09-18').invoice.issueDate).toBe('2026-09-18')
  })

  /**
   * IN FULL, even when only part of it has been paid. The invoice is what was
   * AGREED; how much has arrived against it is the ledger's business, and the
   * receipt prints the remainder. Billing only what was paid would quietly
   * rewrite the agreement to match the cash and lose the rest of the debt.
   */
  it('bills the whole quotation regardless of what was handed over', () => {
    const made = invoiceForPaidQuotation(quotation(), '2026-09-18')
    const billed = made.invoice.lineItems.reduce(
      (sum, line) => sum + (line.unitPriceMinor ?? 0) * (line.quantityMilli / 1000),
      0,
    )
    expect(billed).toBe(10 * 1_850_000_00)
  })
})

describe('Running it twice lands on one invoice (§M)', () => {
  /**
   * THE KEY IS THE QUOTATION'S, so both entry points mint the same one and the
   * second to run finds the invoice the first made rather than creating a
   * rival. Arithmetic, not a check that could race.
   */
  it('mints the same key from either entry point', () => {
    expect(invoiceForPaidQuotation(quotation(), '2026-09-18').idempotencyKey).toBe(
      invoiceFromQuotationKeyFor('doc_quote'),
    )
    expect(invoiceForPaidQuotation(quotation(), '2026-09-19').idempotencyKey).toBe(
      invoiceForPaidQuotation(quotation(), '2026-09-18').idempotencyKey,
    )
  })

  it('gives a different quotation a different key', () => {
    expect(invoiceFromQuotationKeyFor('doc_a')).not.toBe(invoiceFromQuotationKeyFor('doc_b'))
  })
})

describe('What it refuses, and why each would be untrue', () => {
  /**
   * ACCEPTED ONLY. An offer nobody accepted is not a debt; billing somebody
   * because money appeared would charge them a price they never said yes to.
   */
  it.each(['draft', 'issued', 'sent', 'rejected', 'void'])('refuses a %s quotation', (status) => {
    expect(quotationIsPayable({ type: 'quotation', status })).toBe(false)
    expect(() => invoiceForPaidQuotation(quotation({ status }), '2026-09-18')).toThrow(
      QuotationPaidError,
    )
  })

  it('accepts an accepted one', () => {
    expect(quotationIsPayable({ type: 'quotation', status: 'accepted' })).toBe(true)
  })

  it.each(['invoice', 'receipt', 'waybill'])('refuses a %s', (type) => {
    expect(quotationIsPayable({ type, status: 'accepted' })).toBe(false)
  })

  /** An invoice needs somebody to bill and something to bill them for. */
  it('refuses one with nobody to bill', () => {
    expect(() =>
      invoiceForPaidQuotation(quotation({ customerId: undefined }), '2026-09-18'),
    ).toThrow(QuotationPaidError)
  })

  it('refuses one with nothing on it', () => {
    expect(() => invoiceForPaidQuotation(quotation({ lineItems: [] }), '2026-09-18')).toThrow(
      QuotationPaidError,
    )
  })
})
