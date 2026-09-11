/**
 * English terminology tables — the §D launch variants.
 *
 * Regional English variants are LABEL TABLES, not separate translations (§D).
 * A trader in Lagos sees "Waybill" and a plumber in Manchester "Delivery note"
 * without either of them touching a setting.
 *
 * Review status: EN-NG is the home market and the demo company's locale.
 * All four await the §Q Phase-0 native-speaker / in-market sign-off.
 */

import type { TerminologyTable, TypeTerminology } from '../types'

const MONEY_STEPS = ['Details', 'Items', 'Totals', 'Design', 'Review'] as const
const DELIVERY_STEPS = ['Deliver to', 'Goods', 'Dispatch', 'Design', 'Review'] as const

const invoice = (over: Partial<TypeTerminology> = {}): TypeTerminology => ({
  label: 'Invoice',
  pluralLabel: 'Invoices',
  printedTitle: 'INVOICE',
  partyLabel: 'Bill to',
  signatureCaption: 'AUTHORISED SIGNATURE',
  steps: MONEY_STEPS,
  numberingPrefix: 'INV',
  ...over,
})

const receipt = (over: Partial<TypeTerminology> = {}): TypeTerminology => ({
  label: 'Receipt',
  pluralLabel: 'Receipts',
  printedTitle: 'RECEIPT',
  partyLabel: 'Received from',
  signatureCaption: 'ISSUED BY',
  steps: MONEY_STEPS,
  numberingPrefix: 'REC',
  ...over,
})

const SHARED = {
  howToPay: 'HOW TO PAY',
  receivedBy: 'RECEIVED BY',
  estimatedTotal: 'Estimated total',
} as const

const SYNONYMS_BASE = {
  invoice: ['invoice', 'bill', 'tax invoice'],
  quotation: ['quotation', 'quote', 'estimate', 'proforma'],
  receipt: ['receipt', 'payment receipt'],
  waybill: ['waybill', 'delivery note', 'packing slip', 'dispatch note', 'delivery docket'],
} as const

/** EN-NG — the home market. Ogun State, Lagos, Ifo. */
export const EN_NG: TerminologyTable = {
  locale: 'EN-NG',
  language: 'en',
  direction: 'ltr',
  reviewStatus: 'draft',
  types: {
    invoice: invoice(),
    quotation: {
      label: 'Quotation',
      pluralLabel: 'Quotations',
      printedTitle: 'QUOTATION',
      partyLabel: 'Prepared for',
      signatureCaption: 'PREPARED BY',
      steps: MONEY_STEPS,
      numberingPrefix: 'QUO',
    },
    receipt: receipt(),
    waybill: {
      label: 'Waybill',
      pluralLabel: 'Waybills',
      printedTitle: 'WAYBILL',
      partyLabel: 'Deliver to',
      signatureCaption: 'DISPATCHED BY',
      steps: DELIVERY_STEPS,
      numberingPrefix: 'WAY',
    },
  },
  shared: SHARED,
  synonyms: SYNONYMS_BASE,
}

/** EN-GH — Ghana. Same vocabulary as EN-NG at launch scope. */
export const EN_GH: TerminologyTable = { ...EN_NG, locale: 'EN-GH' }

/** EN-GB — also the EN-IE / EN-ZA / EN-IN starting point (§D). */
export const EN_GB: TerminologyTable = {
  ...EN_NG,
  locale: 'EN-GB',
  types: {
    ...EN_NG.types,
    waybill: {
      label: 'Delivery note',
      pluralLabel: 'Delivery notes',
      printedTitle: 'DELIVERY NOTE',
      partyLabel: 'Deliver to',
      signatureCaption: 'DISPATCHED BY',
      steps: DELIVERY_STEPS,
      numberingPrefix: 'DN',
    },
  },
}

/** EN-US — also the EN-CA starting point. */
export const EN_US: TerminologyTable = {
  ...EN_NG,
  locale: 'EN-US',
  types: {
    ...EN_NG.types,
    quotation: {
      label: 'Quote',
      pluralLabel: 'Quotes',
      // §D: "printed title: Estimate optional per region".
      printedTitle: 'ESTIMATE',
      partyLabel: 'Prepared for',
      signatureCaption: 'PREPARED BY',
      steps: MONEY_STEPS,
      numberingPrefix: 'QUO',
    },
    waybill: {
      label: 'Packing slip',
      pluralLabel: 'Packing slips',
      printedTitle: 'PACKING SLIP',
      partyLabel: 'Ship to',
      signatureCaption: 'SHIPPED BY',
      steps: ['Ship to', 'Goods', 'Dispatch', 'Design', 'Review'],
      numberingPrefix: 'PS',
    },
  },
}
