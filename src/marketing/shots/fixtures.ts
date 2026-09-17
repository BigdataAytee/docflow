/**
 * The records a store screenshot is taken of.
 *
 * These are **not** the §R first-run sample. That sample is deliberately
 * marked in the UI as a sample and excluded from balances — which is right
 * inside the app and wrong in a store listing, where a "SAMPLE" badge across
 * every screenshot describes a product nobody wants. Removing the badge while
 * keeping the sample records would be worse: the app would be depicting
 * records as ordinary that it labels as samples.
 *
 * So these are their own thing: ordinary demo records for a demo company,
 * created for the screenshot build and reachable nowhere else. They ship in
 * `dist-shots`, never in `dist` — asserted by a test, because "it is only in
 * the screenshot build" is a claim that rots.
 *
 * Every figure is plausible for the market and obviously modest. Nothing here
 * states a fact about DocFlow — no user counts, no ratings, no savings — for
 * the same reason the Offer markup carries no invented price.
 */

import { type MemoryState, emptyState } from '../../data/repositories'
import type { DocumentRecord } from '../../data/repositories/types'
import { quantity } from '../../domain/documents/types'
import { TERMINOLOGY_TABLES } from '../../domain/locale/data/terminology'
import { regionProfile } from '../../features/settings/region'

export const SHOT_COMPANY_ID = 'co_shots'

/** A believable trading name per market, and its customers. */
interface MarketFixture {
  readonly company: string
  readonly customers: readonly { id: string; name: string; address: string }[]
  /** Minor units, in the region's own currency. */
  readonly amounts: readonly number[]
}

const MARKETS: Readonly<Record<string, MarketFixture>> = {
  NG: {
    company: 'Dynamic Renaissance Ltd',
    customers: [
      { id: 'cu_1', name: 'Okoro & Sons', address: 'Ifo, Ogun State' },
      { id: 'cu_2', name: 'Adeyemi Hardware', address: 'Ikeja, Lagos' },
      { id: 'cu_3', name: 'Chukwu Building Supplies', address: 'Abeokuta' },
    ],
    amounts: [185_000_00, 42_500_00, 96_000_00],
  },
  GH: {
    company: 'Akoto Trading Ltd',
    customers: [
      { id: 'cu_1', name: 'Mensah & Partners', address: 'Osu, Accra' },
      { id: 'cu_2', name: 'Boateng Hardware', address: 'Kumasi' },
      { id: 'cu_3', name: 'Asante Supplies', address: 'Tema' },
    ],
    amounts: [4_250_00, 1_180_00, 2_640_00],
  },
  GB: {
    company: 'Northgate Joinery Ltd',
    customers: [
      { id: 'cu_1', name: 'Hartley & Co', address: 'Stockport' },
      { id: 'cu_2', name: 'Ferndale Builders', address: 'Manchester' },
      { id: 'cu_3', name: 'Brookside Interiors', address: 'Leeds' },
    ],
    amounts: [2_480_00, 615_00, 1_340_00],
  },
  US: {
    company: 'Westbrook Contracting LLC',
    customers: [
      { id: 'cu_1', name: 'Halvorsen & Daughters', address: 'Austin, TX' },
      { id: 'cu_2', name: 'Cedar Ridge Builders', address: 'Round Rock, TX' },
      { id: 'cu_3', name: 'Lakeview Interiors', address: 'San Marcos, TX' },
    ],
    amounts: [3_150_00, 780_00, 1_925_00],
  },
  FR: {
    company: 'Atelier Fontaine SARL',
    customers: [
      { id: 'cu_1', name: 'Maison Bertrand', address: 'Lyon' },
      { id: 'cu_2', name: 'Duval & Fils', address: 'Villeurbanne' },
      { id: 'cu_3', name: 'Constructions Morel', address: 'Saint-Étienne' },
    ],
    amounts: [2_940_00, 690_00, 1_480_00],
  },
  ES: {
    company: 'Talleres Herrera SL',
    customers: [
      { id: 'cu_1', name: 'Casa Jiménez', address: 'Sevilla' },
      { id: 'cu_2', name: 'Construcciones Vega', address: 'Dos Hermanas' },
      { id: 'cu_3', name: 'Muebles Ortega', address: 'Utrera' },
    ],
    amounts: [2_310_00, 540_00, 1_270_00],
  },
  AE: {
    company: 'Al Noor Trading LLC',
    customers: [
      { id: 'cu_1', name: 'Al Rashid Stores', address: 'Deira, Dubai' },
      { id: 'cu_2', name: 'Gulf Interiors', address: 'Sharjah' },
      { id: 'cu_3', name: 'Marina Fit-Out', address: 'Abu Dhabi' },
    ],
    amounts: [18_400_00, 4_250_00, 9_600_00],
  },
}

export class NoFixtureError extends Error {}

const line = (id: string, description: string, units: number, minor?: number) => ({
  id,
  description,
  quantityMilli: quantity(units),
  ...(minor === undefined ? {} : { unitPriceMinor: minor }),
  taxable: true,
})

/**
 * Issued documents, because a list of drafts is not what the app is for — and
 * because an issued document carries the reference and frozen labels a
 * screenshot should show (§M, Rule #5).
 */
function documents(companyId: string, currency: string, market: MarketFixture): DocumentRecord[] {
  const out: DocumentRecord[] = []
  const specs = [
    { type: 'invoice' as const, status: 'sent', prefix: 'INV' },
    { type: 'quotation' as const, status: 'sent', prefix: 'QUO' },
    { type: 'receipt' as const, status: 'issued', prefix: 'REC' },
    { type: 'waybill' as const, status: 'dispatched', prefix: 'WAY' },
  ]

  for (const spec of specs) {
    market.customers.forEach((customer, index) => {
      const amount = market.amounts[index] ?? 0
      const money = spec.type !== 'waybill'
      out.push({
        id: `${spec.type}_${index + 1}`,
        companyId,
        type: spec.type,
        status: spec.status,
        customerId: customer.id,
        currency,
        lineItems: [
          line('li_1', 'Hardwood panels', 4, money ? Math.round(amount / 6) : undefined),
          line('li_2', 'Fixings and fittings', 2, money ? Math.round(amount / 12) : undefined),
        ],
        issueDate: `2026-0${index + 3}-1${index + 2}`,
        issuedReference: `${spec.prefix}-00${index + 1}`,
        frozenLabels: null,
        totalMinor: money ? amount : 0,
        ...(spec.type === 'waybill'
          ? { deliveryAddress: customer.address, driverName: 'Musa', vehicleNumber: 'LAG-482' }
          : {}),
        ...(spec.type === 'receipt' ? { paymentId: `pay_${index + 1}` } : {}),
      })
    })
  }
  return out
}

/** The whole screenshot company, for one market. */
export function shotState(region: string, companyId = SHOT_COMPANY_ID): MemoryState {
  const market = MARKETS[region]
  if (market === undefined) {
    throw new NoFixtureError(
      `No screenshot fixture for region "${region}". A market gets records a local ` +
        'business would recognise, or it does not get a screenshot.',
    )
  }
  const profile = regionProfile(region)

  return {
    ...emptyState(),
    companies: [
      {
        id: companyId,
        name: market.company,
        localeRegion: region,
        // The market's own language, not English. A fixture that quietly said
        // 'en' for France would make the blocked-locale check look like the
        // only thing standing between here and a French screenshot, when in
        // fact there is no French UI to photograph.
        localeLanguage: TERMINOLOGY_TABLES[profile.locale]?.language ?? 'en',
        currency: profile.currency,
        numberingPrefixes: {},
        bankFields: {},
        enabledPaymentMethods: [],
        nameStyle: 'classic',
        logoSize: 'M',
      },
    ],
    customers: market.customers.map((customer) => ({
      id: customer.id,
      companyId,
      kind: 'company' as const,
      name: customer.name,
      address: customer.address,
      labels: [],
    })),
    documents: documents(companyId, profile.currency, market),
  }
}

export const SHOT_REGIONS_WITH_FIXTURES = Object.keys(MARKETS)
