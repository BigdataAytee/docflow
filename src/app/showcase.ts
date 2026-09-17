/**
 * A full set of documents to look at (§H, §I).
 *
 * Five of each type, ten line items each, so the four printed layouts and the
 * sixteen designs can be judged against a page that is actually FULL — a
 * single-line invoice tells you nothing about how a table breathes, where the
 * totals sit relative to the goods, or whether a long description wraps
 * without shoving the amount column off the paper.
 *
 * DEMO ONLY, and that is the point. This never runs in an account build:
 * `createBackend` takes the demo branch only when no Supabase project is
 * configured, so these cannot reach anybody's real records. §R is explicit
 * that a demo is never passed off as an account, and twenty invented invoices
 * in somebody's ledger would be exactly that.
 *
 * The money is realistic rather than round — 47,500 and 18,250 rather than
 * 1,000 — because round numbers hide alignment problems in a tabular-nums
 * column, and the whole reason for this file is to see the alignment.
 */

import type { MemoryState } from '../data/repositories/memory/store'
import type { DocumentRecord, LineItem } from '../data/repositories'
import { type DocumentType, quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { money } from '../domain/money/money'
import { regionProfile } from '../features/settings/region'

/** Goods a builder's merchant in Ifo would actually sell (§B). */
const CATALOGUE: readonly { name: string; unit: string; minor: number }[] = [
  { name: 'Dangote cement 50kg', unit: 'bags', minor: 780_000 },
  { name: 'Granite chippings 3/4"', unit: 'tonnes', minor: 4_250_000 },
  { name: 'Sharp sand', unit: 'trips', minor: 3_800_000 },
  { name: 'Iron rod 12mm × 12m', unit: 'lengths', minor: 1_145_000 },
  { name: 'Binding wire', unit: 'rolls', minor: 1_850_000 },
  { name: 'Roofing sheet 0.55mm aluminium', unit: 'sheets', minor: 1_475_000 },
  { name: 'PVC pipe 4" × 5.8m', unit: 'lengths', minor: 682_500 },
  { name: 'Emulsion paint white', unit: 'buckets', minor: 2_250_000 },
  { name: 'Plywood 18mm marine board', unit: 'sheets', minor: 1_820_000 },
  { name: 'Wheelbarrow heavy duty', unit: 'pieces', minor: 3_150_000 },
]

const CUSTOMERS: readonly { name: string; address: string; phone: string }[] = [
  { name: 'Okoro & Sons Ltd', address: '12 Market Road, Ifo, Ogun State', phone: '+2348030001111' },
  { name: 'Flour Mills of Nigeria FZE', address: 'Iganmu, Lagos', phone: '+2348030002222' },
  { name: 'Adeola Hardware', address: '14 Ogunlana Drive, Surulere, Lagos', phone: '+2348030003333' },
  { name: 'Bright Star Schools', address: '7 Awolowo Way, Ikeja, Lagos', phone: '+2348030004444' },
  { name: 'Taiwo Ventures', address: '141 Silverdale Avenue, Abeokuta', phone: '+2348030005555' },
]

/** Ten lines, varied so the table has something to cope with. */
function linesFor(type: DocumentType, seed: number): LineItem[] {
  return CATALOGUE.map((item, index) => {
    const qty = ((seed * 3 + index * 2) % 9) + 1
    return {
      id: `line_${seed}_${index}`,
      description: item.name,
      quantityMilli: quantity(qty),
      taxable: index % 4 !== 0,
      // A delivery carries no prices at all (§V), and no unit any more.
      ...(type === 'waybill' ? {} : { unitPriceMinor: item.minor }),
      ...(type === 'waybill' ? {} : { unit: item.unit }),
    }
  })
}

const STATUS: Readonly<Record<DocumentType, readonly string[]>> = {
  invoice: ['issued', 'issued', 'partially_paid', 'paid', 'draft'],
  quotation: ['issued', 'accepted', 'issued', 'rejected', 'draft'],
  receipt: ['issued', 'issued', 'issued', 'issued', 'draft'],
  waybill: ['issued', 'dispatched', 'delivered', 'dispatched', 'draft'],
}

const PREFIX: Readonly<Record<DocumentType, string>> = {
  invoice: 'INV',
  quotation: 'QUO',
  receipt: 'REC',
  waybill: 'WAY',
}

/**
 * Twenty documents, five per type, ten items each.
 *
 * Deterministic: the same set every time, so two screenshots taken a week
 * apart are comparable and a layout change is the only thing that can have
 * moved between them.
 */
export function showcaseState(companyId: string, region = 'NG'): Partial<MemoryState> {
  const profile = regionProfile(region)
  const types: readonly DocumentType[] = ['invoice', 'quotation', 'receipt', 'waybill']

  const customers = CUSTOMERS.map((who, index) => ({
    id: `cus_${index + 1}`,
    companyId,
    kind: 'company' as const,
    name: who.name,
    address: who.address,
    phone: who.phone,
    labels: [],
  }))

  const documents: DocumentRecord[] = []
  const payments: MemoryState['payments'] = []

  for (const type of types) {
    for (let n = 0; n < 5; n++) {
      const seed = n + 1
      const lineItems = linesFor(type, seed)
      const status = STATUS[type][n] ?? 'issued'
      const isDraft = status === 'draft'
      const id = `doc_${type}_${seed}`
      const total = lineItems.reduce(
        (sum, line) =>
          sum + (line.unitPriceMinor ?? 0) * (line.quantityMilli / 1000),
        0,
      )

      /* A receipt is evidence of a payment, so the payment exists first (§G). */
      const paymentId = type === 'receipt' && !isDraft ? `pay_${seed}` : undefined
      if (paymentId !== undefined) {
        payments.push({
          id: paymentId,
          customerId: customers[n % customers.length]?.id ?? 'cus_1',
          amount: money(profile.currency, total),
          paidAt: `2026-09-0${seed}`,
          method: seed % 2 === 0 ? 'Bank transfer' : 'Cash',
          source: 'manual',
          allocations: [],
        })
      }

      documents.push({
        id,
        companyId,
        type,
        status,
        customerId: customers[n % customers.length]?.id ?? 'cus_1',
        currency: profile.currency,
        lineItems,
        issueDate: `2026-09-0${seed}`,
        ...(type === 'invoice' ? { dueDate: `2026-09-${20 + seed}` } : {}),
        ...(type === 'quotation' ? { validUntil: `2026-10-0${seed}` } : {}),
        ...(type === 'waybill'
          ? {
              deliveryAddress: CUSTOMERS[n % CUSTOMERS.length]?.address ?? '',
              driverName: 'Musa Ibrahim',
              vehicleNumber: `LAG-${400 + seed}-XA`,
              dispatchDate: `2026-09-0${seed}`,
              expectedDate: `2026-09-0${seed + 1}`,
            }
          : {}),
        ...(paymentId === undefined ? {} : { paymentId, linkedInvoiceId: 'doc_invoice_1' }),
        issuedReference: isDraft ? null : `${PREFIX[type]}-000${seed}`,
        frozenLabels: isDraft ? null : freezeLabels(profile, type),
        totalMinor: type === 'waybill' ? 0 : total,
        // Every design gets used, so one set of screenshots covers the strip.
        ...(isDraft ? {} : { templateId: ['classic', 'modern', 'minimal', 'bold', 'elegant'][n] }),
      } as DocumentRecord)
    }
  }

  return { customers, documents, payments }
}
