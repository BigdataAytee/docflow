/**
 * One sale, one figure (§V, §I, §K, Rule #5).
 *
 * A cash sale of ₦100,000 printed three different totals at once:
 *
 *  · the receipt's goods table said "Subtotal ₦100,000 / Tax ₦7,500 /
 *    Invoice total ₦107,500",
 *  · the evidence block beneath it on the SAME sheet said "Invoice total
 *    ₦100,000",
 *  · and the bill raised for the remainder printed ₦107,500 while the ledger
 *    recorded it at ₦100,000 and chased ₦60,000.
 *
 * The cause was one line: compose applied the company's default tax rate to a
 * receipt. Every test agreed with every figure, because no test had a company
 * with a default rate and a receipt in the same fixture — which is why the
 * fixture below has both, and why it is the point of the file.
 *
 * §V settles it: a receipt is evidence that money arrived, not a calculation.
 * The goods are context; the printed total is the payment.
 */

import { describe, expect, it } from 'vitest'

import type { Company, Customer, DocumentRecord } from '../data/repositories'
import { quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { stringsFor } from '../domain/locale/data/strings'
import { money } from '../domain/money/money'
import { percentToPpm } from '../domain/money/money'
import {
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
} from '../features/documents/composition'
import { invoiceForCashSale, saleTotal } from '../features/payments/cashSale'
import { composeDocument } from './compose'

const profile = { locale: 'EN-NG' } as const
const strings = stringsFor('en')

/**
 * A BUSINESS THAT CHARGES VAT, which is the fixture nothing had.
 *
 * 7.5% is Nigeria's rate and the one the app defaults a company to. With it
 * absent, a receipt that wrongly computes tax computes 0% of it and looks
 * exactly like a receipt that computes none.
 */
const company: Company = {
  id: 'co',
  name: 'Adeola Hardware',
  localeRegion: 'NG',
  localeLanguage: 'en',
  currency: 'NGN',
  numberingPrefixes: {},
  bankFields: {},
  enabledPaymentMethods: ['bank_transfer'],
  taxRatePpm: percentToPpm(7.5),
}

const customer: Customer = {
  id: 'cu',
  companyId: 'co',
  kind: 'company',
  name: 'Mama Bisi Provisions',
  labels: [],
}

const goods = [
  {
    id: 'l1',
    description: 'Cement, 20 bags',
    quantityMilli: quantity(20),
    unitPriceMinor: 5_000_00,
    // TAXABLE, as the Items step adds them. The rule has to hold for a line
    // that says it is in the tax base, or it is not a rule about receipts.
    taxable: true,
  },
]

const receipt = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'doc_rec',
  companyId: 'co',
  type: 'receipt',
  status: 'issued',
  customerId: 'cu',
  currency: 'NGN',
  issueDate: '2026-09-18',
  lineItems: goods,
  issuedReference: 'REC-0006',
  frozenLabels: freezeLabels(profile, 'receipt'),
  paymentId: 'pay_1',
  // §V: the receipt's own total IS the payment.
  totalMinor: 40_000_00,
  linkedInvoiceId: 'doc_inv',
  invoiceTotalMinor: 100_000_00,
  paidBeforeMinor: 0,
  balanceAfterMinor: 60_000_00,
  ...over,
})

const compose = (row: DocumentRecord) => {
  const design = designOf(row, company)
  return composeDocument(
    composableOf({
      draft: draftOf(row),
      design,
      company,
      customer,
      profile,
      reference: row.issuedReference,
      status: row.status,
      frozenLabels: row.frozenLabels,
      replaces: null,
      today: '2026-09-18',
      ...(row.type === 'receipt'
        ? { payment: { amount: money('NGN', row.totalMinor), at: '2026-09-18' } }
        : {}),
    }),
    { ...composeOptionsOf({ company, design, strings, assets: [] }), profile },
  )
}

describe('A receipt computes no tax (§V, §I)', () => {
  /**
   * THE ONE THIS IS FOR. The goods table read ₦107,500 while the evidence
   * block on the same sheet read ₦100,000.
   */
  it('prints the goods at what they came to, with nothing added', () => {
    const page = compose(receipt())
    expect(page.totals?.tax, 'a receipt added tax to money already received').toEqual(
      money('NGN', 0),
    )
    expect(page.totals?.payable).toEqual(money('NGN', 100_000_00))
  })

  /** And the two figures on one sheet agree, which is the whole complaint. */
  it('agrees with the invoice total in its own evidence block', () => {
    const page = compose(receipt())
    expect(page.totals?.payable).toEqual(page.receiptEvidence?.invoiceTotal)
  })

  /** The headline stays the PAYMENT, not the goods and not the tax (§V). */
  it('still headlines the payment', () => {
    expect(compose(receipt()).headline?.amount).toEqual(money('NGN', 40_000_00))
  })

  /**
   * AND EVERY OTHER TYPE STILL DOES CHARGE IT. A rule that switched tax off
   * everywhere would be a much worse bug than the one it replaced.
   */
  it('leaves an invoice taxed', () => {
    const {
      paymentId: _p,
      linkedInvoiceId: _l,
      invoiceTotalMinor: _t,
      paidBeforeMinor: _b,
      balanceAfterMinor: _a,
      ...asInvoice
    } = receipt()
    const page = compose({
      ...asInvoice,
      id: 'doc_inv2',
      type: 'invoice',
      frozenLabels: freezeLabels(profile, 'invoice'),
      totalMinor: 107_500_00,
    })
    expect(page.totals?.tax).toEqual(money('NGN', 7_500_00))
    expect(page.totals?.payable).toEqual(money('NGN', 107_500_00))
  })
})

describe('The bill for a short-paid cash sale prints what it recorded', () => {
  /**
   * The customer handed over part of ₦100,000 at the counter. Billing them
   * ₦107,500 for the sale they were standing in front of would be the app
   * inventing a charge, and would make this bill disagree with the receipt
   * that names it.
   */
  it('carries no rate and no taxable line', () => {
    const billed = invoiceForCashSale({
      receipt: { currency: 'NGN', customerId: 'cu', lineItems: goods, paidAmountMinor: 40_000_00 },
      receiptId: 'doc_rec',
      today: '2026-09-18',
    })
    expect(billed.invoice.taxRatePpm).toBe(0)
    expect(billed.invoice.lineItems.every((line) => !line.taxable)).toBe(true)
  })

  /**
   * AND IT PRINTS THE FIGURE IT WAS RECORDED AT, through the real chain. A
   * stored rate of zero is what stops the page reaching for the company's
   * default next year (Rule #5).
   */
  it('prints the sale, not the sale plus tax', () => {
    const billed = invoiceForCashSale({
      receipt: { currency: 'NGN', customerId: 'cu', lineItems: goods, paidAmountMinor: 40_000_00 },
      receiptId: 'doc_rec',
      today: '2026-09-18',
    })
    const page = compose({
      id: 'doc_inv',
      companyId: 'co',
      type: 'invoice',
      status: 'issued',
      customerId: 'cu',
      currency: 'NGN',
      issueDate: '2026-09-18',
      dueDate: '2026-09-18',
      lineItems: billed.invoice.lineItems,
      issuedReference: 'INV-0006',
      frozenLabels: freezeLabels(profile, 'invoice'),
      totalMinor: billed.split.total.minor,
      taxRatePpm: 0,
    })
    expect(page.totals?.payable, 'the bill asks for more than it recorded').toEqual(
      money('NGN', 100_000_00),
    )
    expect(page.totals?.payable.minor).toBe(saleTotal('NGN', goods).minor)
  })
})
