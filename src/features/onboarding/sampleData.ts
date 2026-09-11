/**
 * The sample document offered on first run (§R, §L8).
 *
 * "First task: create any of the four (under their local names), or view a
 * sample — sample records are visually labelled and excluded from balances,
 * counts and analytics; the prototype's seeded money never enters a real
 * account."
 *
 * Every record here carries `isSample: true`, which is what `realOnly` filters
 * on. The figures are deliberately modest and obviously illustrative rather
 * than a number someone might mistake for their own.
 */

import type { DocumentType, LineItem } from '../../domain/documents/types'
import { quantity } from '../../domain/documents/types'
import { type Money, money } from '../../domain/money/money'

/** A fixed id, so a sample can never collide with or masquerade as real work. */
export const SAMPLE_DOCUMENT_ID = 'sample:document'
export const SAMPLE_CUSTOMER_ID = 'sample:customer'

export interface SampleCustomer {
  readonly id: string
  readonly companyId: string
  readonly kind: 'company'
  readonly name: string
  readonly address: string
  readonly labels: readonly string[]
  readonly isSample: true
}

export interface SampleDocument {
  readonly id: string
  readonly companyId: string
  readonly type: DocumentType
  readonly status: 'issued'
  readonly currency: string
  readonly reference: string
  readonly issueDate: string
  readonly dueDate: string
  readonly customerId: string
  readonly customerName: string
  readonly lineItems: readonly LineItem[]
  readonly total: Money
  readonly isSample: true
}

/**
 * The demo customer. Named as an example rather than as a plausible business,
 * so nobody reads it as a contact they forgot making.
 */
export function sampleCustomer(companyId: string): SampleCustomer {
  return {
    id: SAMPLE_CUSTOMER_ID,
    companyId,
    kind: 'company',
    name: 'Example Customer Ltd',
    address: '12 Example Road',
    labels: [],
    isSample: true,
  }
}

/**
 * The sample document. An invoice by default because it is the type that shows
 * the most of the layout — totals, a payment box and a signature — but any
 * type can be asked for, under its own local name.
 */
export function sampleDocument(
  companyId: string,
  type: DocumentType = 'invoice',
  currency = 'NGN',
): SampleDocument {
  const showsMoney = type !== 'waybill'
  const lineItems: LineItem[] = [
    {
      id: 'sample:line-1',
      description: 'Cement (50kg)',
      quantityMilli: quantity(10),
      ...(showsMoney ? { unitPriceMinor: 500_000 } : {}),
      taxable: true,
    },
    {
      id: 'sample:line-2',
      description: 'Sharp sand (tonne)',
      quantityMilli: quantity(2),
      ...(showsMoney ? { unitPriceMinor: 1_250_000 } : {}),
      taxable: true,
    },
  ]

  return {
    id: SAMPLE_DOCUMENT_ID,
    companyId,
    type,
    status: 'issued',
    currency,
    // No real prefix and no sequence number, so a sample can never be mistaken
    // for part of the user's numbering — or collide with it.
    reference: 'SAMPLE',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    customerId: SAMPLE_CUSTOMER_ID,
    customerName: 'Example Customer Ltd',
    lineItems,
    total: money(currency, showsMoney ? 7_500_000 : 0),
    isSample: true,
  }
}

/** Everything seeded for the first-run sample, as one set. */
export function sampleRecords(companyId: string, type: DocumentType = 'invoice') {
  return {
    customer: sampleCustomer(companyId),
    document: sampleDocument(companyId, type),
  }
}
