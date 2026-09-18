/**
 * Billing the remainder of a part-paid invoice (§G, §K, Rule #3, Rule #5).
 *
 * The owner's complaint: after a part payment the screen says "₦50,000 paid of
 * ₦145,000 · ₦95,000 left" and there is nothing to press. Asking for the rest
 * meant a new invoice, the right customer, and the balance retyped by hand
 * from the screen behind them.
 */

import { describe, expect, it } from 'vitest'

import { BillBalanceError, balanceInvoiceDraft, billBalanceKeyFor } from './billBalance'
import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'doc_inv',
  type: 'invoice',
  status: 'issued',
  currency: 'NGN',
  customerId: 'cus_1',
  issuedReference: 'INV-0042',
  ...over,
})

const draft = (over: Record<string, unknown> = {}) =>
  balanceInvoiceDraft({
    invoice: invoice(over),
    outstanding: money('NGN', 95_000_00),
    today: '2026-09-18',
    description: 'Balance of INV-0042',
    ...(over['outstanding'] === undefined
      ? {}
      : { outstanding: over['outstanding'] as ReturnType<typeof money> }),
  })

describe('The draft that asks for what is left', () => {
  /** THE ONE THIS IS FOR: the amount is the outstanding figure, exactly. */
  it('bills exactly the outstanding amount, as one line', () => {
    const made = draft()
    expect(made.lineItems).toHaveLength(1)
    expect(made.lineItems[0]?.unitPriceMinor).toBe(95_000_00)
    expect(made.lineItems[0]?.quantityMilli).toBe(quantity(1))
  })

  /**
   * NOT A COPY OF THE ORIGINAL'S ITEMS. Those were already billed; re-listing
   * them reads as a second request for the whole job rather than for what is
   * left of it.
   */
  it('names the invoice it follows rather than relisting the goods', () => {
    expect(draft().lineItems[0]?.description).toBe('Balance of INV-0042')
  })

  /**
   * NOT TAXED AGAIN. The tax was computed and charged on the original, and the
   * balance is a portion of a total that already includes it — taxing the
   * remainder would charge the same goods twice.
   */
  it('does not tax the remainder a second time', () => {
    expect(draft().lineItems[0]?.taxable).toBe(false)
  })

  it('keeps the customer and the currency', () => {
    const made = draft()
    expect(made.customerId).toBe('cus_1')
    expect(made.currency).toBe('NGN')
  })

  it('is dated today, not the original’s date', () => {
    expect(draft().issueDate).toBe('2026-09-18')
  })

  /** Both documents name each other, so neither reads as a separate charge. */
  it('links back to the invoice it follows', () => {
    expect(draft().billsBalanceOfId).toBe('doc_inv')
  })
})

describe('What it refuses, because each would say something untrue', () => {
  it('refuses a settled invoice — there is no remainder', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice(),
        outstanding: money('NGN', 0),
        today: '2026-09-18',
        description: 'x',
      }),
    ).toThrow(BillBalanceError)
  })

  it('refuses a draft, which has asked for nothing yet', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice({ status: 'draft' }),
        outstanding: money('NGN', 95_000_00),
        today: '2026-09-18',
        description: 'x',
      }),
    ).toThrow(BillBalanceError)
  })

  it('refuses a cancelled invoice, which is not owed', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice({ status: 'void' }),
        outstanding: money('NGN', 95_000_00),
        today: '2026-09-18',
        description: 'x',
      }),
    ).toThrow(BillBalanceError)
  })

  /** A quotation has not been billed; a delivery carries no money at all (§V). */
  it.each(['quotation', 'receipt', 'waybill'])('refuses a %s', (type) => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice({ type }),
        outstanding: money('NGN', 95_000_00),
        today: '2026-09-18',
        description: 'x',
      }),
    ).toThrow(BillBalanceError)
  })

  /** Money is never mixed across currencies (Rule #3). */
  it('refuses a balance in another currency', () => {
    expect(() =>
      balanceInvoiceDraft({
        invoice: invoice(),
        outstanding: money('GHS', 95_000_00),
        today: '2026-09-18',
        description: 'x',
      }),
    ).toThrow(BillBalanceError)
  })
})

describe('It moves no money', () => {
  /**
   * The draft is a fresh REQUEST for the same debt. Nothing here allocates,
   * settles or reverses anything — which is what keeps the original invoice's
   * own balance, the customer balance and Home's Outstanding all correct while
   * a follow-up exists.
   */
  it('carries no payment and no total of its own', () => {
    const made = draft() as unknown as Record<string, unknown>
    expect(made['paymentId']).toBeUndefined()
    // Zero like every other draft: a total is what ISSUING computes (Rule #5).
    expect(made['totalMinor']).toBe(0)
    expect(made['issuedReference']).toBeUndefined()
  })

  /**
   * Two taps make ONE draft; a later follow-up at a different balance makes
   * its own. Keyed on the invoice alone, the second would silently return the
   * first and the owner would think the app had ignored them.
   */
  it('keys on the invoice AND the balance', () => {
    expect(billBalanceKeyFor('doc_inv', 95_000_00)).toBe(billBalanceKeyFor('doc_inv', 95_000_00))
    expect(billBalanceKeyFor('doc_inv', 95_000_00)).not.toBe(
      billBalanceKeyFor('doc_inv', 40_000_00),
    )
  })
})
