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
 * The cause was not the tax. The PAGE computed one total and the DOMAIN
 * computed another, so every figure was somebody's honest answer to a
 * different question. A cash sale is still a sale: a trader who knocked
 * something off at the counter needs it to print, and one who charged VAT
 * needs that to print too — a receipt that quietly dropped either would be a
 * worse lie than the disagreement.
 *
 * So the fix is ONE COMPUTATION feeding every figure, and these are the
 * places it has to reach. No fixture had a company with a default rate and a
 * receipt at the same time, which is why nothing caught it, and why the one
 * below has both.
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

describe('A cash sale is still a sale (§G, §J)', () => {
  /** The tax a trader charged has to print. */
  it('prints the tax it charged', () => {
    const page = compose(receipt())
    expect(page.totals?.tax).toEqual(money('NGN', 7_500_00))
    expect(page.totals?.payable).toEqual(money('NGN', 107_500_00))
  })

  /**
   * THE ONE THIS IS FOR, and it is the AGREEMENT rather than the arithmetic:
   * the goods table read ₦107,500 while the evidence block on the same sheet
   * read ₦100,000.
   */
  it('agrees with the invoice total in its own evidence block', () => {
    const page = compose(receipt({ invoiceTotalMinor: 107_500_00, balanceAfterMinor: 67_500_00 }))
    expect(page.totals?.payable, 'one sheet printed two totals for one sale').toEqual(
      page.receiptEvidence?.invoiceTotal,
    )
  })

  /** And the domain answers the same question the page does. */
  it('computes the same total the page prints', () => {
    const page = compose(receipt())
    expect(saleTotal('NGN', goods, { taxRate: percentToPpm(7.5) })).toEqual(page.totals?.payable)
  })

  /** The headline stays the PAYMENT, not the goods and not the tax (§V). */
  it('still headlines the payment', () => {
    expect(compose(receipt()).headline?.amount).toEqual(money('NGN', 40_000_00))
  })

  /** An invoice is untouched by any of this. */
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
  const RATES = { taxRate: percentToPpm(7.5) }

  const bill = () =>
    invoiceForCashSale({
      receipt: { currency: 'NGN', customerId: 'cu', lineItems: goods, paidAmountMinor: 40_000_00 },
      receiptId: 'doc_rec',
      today: '2026-09-18',
      rates: RATES,
    })

  /**
   * IT CARRIES THE RATES IT WAS COMPUTED AT (Rule #5, §K). Without them the
   * page reads whatever Settings says on the day it is re-rendered, so a bill
   * raised today could ask for a different figure next year — beside a
   * receipt frozen at today's.
   */
  it('stores the rates the sale was computed at', () => {
    expect(bill().invoice.taxRatePpm).toBe(percentToPpm(7.5))
    expect(bill().invoice.lineItems.every((line) => line.taxable)).toBe(true)
  })

  /** The bill, the receipt and the split all say the same thing. */
  it('is raised for the taxed total, and leaves the right balance', () => {
    const billed = bill()
    expect(billed.split.total).toEqual(money('NGN', 107_500_00))
    expect(billed.split.paid).toEqual(money('NGN', 40_000_00))
    expect(billed.split.balance).toEqual(money('NGN', 67_500_00))
  })

  /**
   * AND IT PRINTS THE FIGURE IT WAS RECORDED AT, through the real chain —
   * the assertion the three-figure bug would have failed.
   */
  it('prints what it recorded', () => {
    const billed = bill()
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
      taxRatePpm: percentToPpm(7.5),
    })
    expect(page.totals?.payable, 'the bill asks for a figure it did not record').toEqual(
      money('NGN', billed.split.total.minor),
    )
  })
})
