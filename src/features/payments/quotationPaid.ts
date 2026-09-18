/**
 * "They've paid" — a quotation becoming an invoice and a receipt (§G, §K).
 *
 * The journey the owner asked for: an accepted quotation, money arrives, and
 * one act turns it into a billed invoice and the evidence of the payment.
 * Reachable from the quotation itself and from the receipt flow's picker, and
 * the two must produce the SAME thing — one invoice, one receipt, links in
 * both directions — or the app has two opinions about one sale.
 *
 * THE INVOICE IS ALWAYS CREATED, and that is the load-bearing decision. A
 * receipt hanging off a quotation would be evidence of money against a
 * document that never billed anybody: the sale would never appear in what was
 * invoiced, the customer's balance would be computed from nothing, and a
 * quotation — which is an OFFER — would have a payment attached to it (§G).
 * So the offer becomes a bill first, in full, and the payment settles the bill.
 *
 * IN FULL even for a part payment. The invoice is what was agreed; how much
 * has arrived against it is the ledger's business, and the receipt prints the
 * remainder. Billing only what was paid would quietly rewrite the agreement
 * to match the cash, and lose the rest of the debt entirely.
 *
 * WHAT THIS MODULE DOES NOT DO: write anything. It returns the records and
 * the keys, and the caller commits them in order — payment first, then the
 * documents derived from it (§V). Nothing here can record money.
 */

import { type ConvertibleDocument, convertDocument } from '../documents/convert'
import type { DocumentDraft } from '../documents/builder'

export class QuotationPaidError extends Error {
  constructor(readonly reason: 'wrong_type' | 'not_accepted' | 'no_customer' | 'nothing_to_bill') {
    super(reason)
    this.name = 'QuotationPaidError'
  }
}

/**
 * The statuses that can be paid for.
 *
 * ACCEPTED ONLY. A quotation that was merely sent has not been agreed, and an
 * offer nobody accepted is not a debt — turning one into an invoice because
 * money appeared would bill somebody for a price they never said yes to. If
 * the money really did arrive against an unaccepted quote, accepting it is the
 * honest first step and is one tap away (§G).
 */
const PAYABLE_STATUSES: readonly string[] = ['accepted']

export const quotationIsPayable = (document: {
  readonly type: string
  readonly status: string
}): boolean => document.type === 'quotation' && PAYABLE_STATUSES.includes(document.status)

/**
 * The idempotency handle for the invoice a paid quotation produces (§M).
 *
 * Derived from the QUOTATION, so both entry points mint the same key and the
 * second one to run finds the invoice the first made rather than creating a
 * rival. That is the whole of "running either twice never creates a second
 * invoice": it is arithmetic, not a check that could race.
 */
export const invoiceFromQuotationKeyFor = (quotationId: string): string => `qpaid:${quotationId}`

export interface QuotationPayment {
  /** The invoice to create and issue, carrying the quotation's own work. */
  readonly invoice: DocumentDraft
  /** The link, on the NEW document. The quotation is never written to (§G). */
  readonly convertedFromId: string
  readonly idempotencyKey: string
}

/**
 * The invoice an accepted quotation becomes when it is paid.
 *
 * Built by the ORDINARY conversion, not a second path beside it: items,
 * prices, customer and the link in both directions are exactly what
 * "Convert to…" would produce, so a quotation billed this way and one billed
 * by hand are the same document. A separate implementation would be a second
 * set of rules to keep in step, and §G's conversion table is already the
 * place those rules live.
 */
export function invoiceForPaidQuotation(
  quotation: ConvertibleDocument & { readonly customerId?: string },
  today: string,
): QuotationPayment {
  if (quotation.type !== 'quotation') throw new QuotationPaidError('wrong_type')
  if (!quotationIsPayable(quotation)) throw new QuotationPaidError('not_accepted')
  if (quotation.customerId === undefined) throw new QuotationPaidError('no_customer')
  if (quotation.lineItems.length === 0) throw new QuotationPaidError('nothing_to_bill')

  const converted = convertDocument(quotation, { to: 'invoice', on: today })

  return {
    invoice: converted.draft,
    convertedFromId: converted.convertedFromId,
    /*
     * The QUOTATION's key, not the conversion's.
     *
     * `conversionKeyFor` is keyed on source and target, which is right for a
     * conversion somebody asked for on its own — but this act is "they have
     * paid", and doing it twice from two different screens must land on one
     * invoice. Keyed here so both entry points agree.
     */
    idempotencyKey: invoiceFromQuotationKeyFor(quotation.id),
  }
}
