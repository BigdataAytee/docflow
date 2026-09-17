/**
 * The sample documents have to agree with themselves (§H, §I, Rule #3).
 *
 * These twenty exist to be LOOKED AT, which is exactly why a wrong figure in
 * them is expensive: every judgement about a layout is made against numbers
 * that are assumed to be right, and two of them disagreed in the open. The
 * saved invoice said "₦1,143,575.00 left" underneath a page that printed
 * ₦1,220,110.63 payable, and two more claimed to be paid with no payment in
 * the ledger behind them.
 *
 * Nothing caught either. `showcase.ts` totalled the lines by hand — in
 * floating point, which Rule #3 forbids — and stopped at the subtotal, and it
 * wrote `paid` into a status column that has no such value. A fixture can say
 * whatever it likes; this is the file that makes it say the truth.
 */

import { describe, expect, it } from 'vitest'

import { showcaseState } from './showcase'
import { DOCUMENT_STATUSES, type DocumentType, carriesMoney } from '../domain/documents/types'
import { computeTotals } from '../domain/money/totals'
import { invoiceOutstanding } from '../domain/payments/ledger'
import { money } from '../domain/money/money'

const state = showcaseState('co_1')
const documents = state.documents ?? []
const payments = state.payments ?? []
const issued = documents.filter((doc) => doc.status !== 'draft')

describe('Twenty documents, and every figure on them derived', () => {
  it('builds five of each type', () => {
    for (const type of ['invoice', 'quotation', 'receipt', 'waybill'] as const) {
      expect(documents.filter((doc) => doc.type === type), type).toHaveLength(5)
    }
  })

  /**
   * THE ONE THIS IS FOR.
   *
   * `totalMinor` is what the saved-document screen reads and what the balance
   * is measured against; the page prints what `computeTotals` returns. They
   * were two different numbers, differing by exactly the tax.
   */
  it.each(issued.filter((doc) => carriesMoney(doc.type)).map((doc) => [doc.id] as const))(
    '%s stores the total its own lines add up to',
    (id) => {
      const doc = documents.find((d) => d.id === id)!
      const totals = computeTotals({
        type: doc.type,
        currency: doc.currency,
        lines: doc.lineItems,
        ...(doc.taxRatePpm === undefined ? {} : { taxRate: doc.taxRatePpm }),
      })
      expect(doc.totalMinor, `${id}: stored total is not the payable`).toBe(totals.payable.minor)
    },
  )

  /** A delivery carries no money at all (§V), so there is no total to store. */
  it('stores nothing on a delivery', () => {
    for (const doc of documents.filter((d) => d.type === 'waybill')) {
      expect(doc.totalMinor, doc.id).toBe(0)
    }
  })

  /**
   * A draft stores nothing either, because `createDraft` writes 0 and the
   * figure is recomputed from the lines each time it is opened. A sample that
   * stored one carried a total that could not be reproduced from what was on
   * the document — it was computed at a rate the draft had never frozen.
   */
  it('stores no total on a draft, the way createDraft does not', () => {
    for (const doc of documents.filter((d) => d.status === 'draft')) {
      expect(doc.totalMinor, `${doc.id}: a draft stored a total`).toBe(0)
    }
  })

  /**
   * The tax rate is frozen onto each issued sample (Rule #5).
   *
   * Without it the page would read the company's CURRENT default at print
   * time, so the stored total and the printed one would agree only for as
   * long as nobody changed the setting.
   */
  it('freezes the rate on every issued sample that carries money', () => {
    for (const doc of issued.filter((d) => carriesMoney(d.type))) {
      expect(doc.taxRatePpm, `${doc.id}: no frozen rate`).toBeGreaterThan(0)
    }
  })

  it('freezes no rate on a draft, which reads the company default', () => {
    for (const doc of documents.filter((d) => d.status === 'draft')) {
      expect(doc.taxRatePpm, doc.id).toBeUndefined()
    }
  })
})

describe('Stored status means the stored column, not a derived state', () => {
  /**
   * `partially_paid` and `paid` are `PaymentState`, computed from the ledger
   * at read time and never stored (Rule #3). Two invoices carried them in the
   * status column, which is a value `DOCUMENT_STATUSES` does not list.
   */
  it.each(documents.map((doc) => [doc.id, doc.type, doc.status] as const))(
    '%s (%s) is in a status that type can actually be',
    (_id, type, status) => {
      expect(DOCUMENT_STATUSES[type as DocumentType] as readonly string[]).toContain(status)
    },
  )
})

describe('The ledger is what makes an invoice paid', () => {
  const outstanding = (id: string) => {
    const doc = documents.find((d) => d.id === id)!
    return invoiceOutstanding(id, money(doc.currency, doc.totalMinor), payments).minor
  }

  /** One settled, one part paid — arrived at, not asserted. */
  it('settles doc_invoice_4 completely', () => {
    expect(outstanding('doc_invoice_4')).toBe(0)
  })

  it('leaves doc_invoice_3 part paid — some in, some still owing', () => {
    const doc = documents.find((d) => d.id === 'doc_invoice_3')!
    const left = outstanding('doc_invoice_3')
    expect(left, 'nothing has been paid').toBeLessThan(doc.totalMinor)
    expect(left, 'it is fully settled, not part paid').toBeGreaterThan(0)
  })

  it('leaves the rest owing in full', () => {
    for (const id of ['doc_invoice_1', 'doc_invoice_2']) {
      const doc = documents.find((d) => d.id === id)!
      expect(outstanding(id), id).toBe(doc.totalMinor)
    }
  })

  /**
   * A payment that is recorded but not ALLOCATED leaves the invoice showing
   * its full balance — the customer's money is in, and the document it was
   * for does not know. That is the shape this whole describe exists to keep.
   */
  it('allocates every invoice payment to the invoice it is for', () => {
    for (const payment of payments.filter((p) => p.id.startsWith('pay_inv_'))) {
      expect(payment.allocations, `${payment.id} allocates nothing`).not.toHaveLength(0)
      const allocated = payment.allocations.reduce((n, a) => n + a.amount.minor, 0)
      expect(allocated, `${payment.id} allocates a different sum than it received`).toBe(
        payment.amount.minor,
      )
    }
  })

  /** A receipt is evidence of a payment, so the payment has to exist (§G). */
  it('gives every issued receipt a payment behind it', () => {
    for (const doc of issued.filter((d) => d.type === 'receipt')) {
      const payment = payments.find((p) => p.id === doc.paymentId)
      expect(payment, `${doc.id}: no payment behind the receipt`).toBeDefined()
      expect(payment?.amount.minor, `${doc.id}: the receipt is for a different sum`).toBe(
        doc.totalMinor,
      )
    }
  })
})
