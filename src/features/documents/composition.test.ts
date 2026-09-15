/**
 * The shared composition (§H, §I, Rule #5).
 *
 * This module exists because two screens draw the same document — the
 * builder's live preview and the saved document — and a second composition
 * would be free to disagree with the one that prints. So the cases below are
 * mostly about AGREEMENT: the same record composes the same way whoever asks,
 * and the parts that fall back fall back predictably.
 */

import { describe, expect, it } from 'vitest'

import type { Company, Customer, DocumentRecord } from '../../data/repositories'
import { quantity } from '../../domain/documents/types'
import { freezeLabels } from '../../domain/locale/profile'
import { stringsFor } from '../../domain/locale/data/strings'
import { composeDocument } from '../../pdf/compose'
import {
  DEFAULT_BRAND_COLOUR,
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
  replacesOf,
  templateIdOf,
} from './composition'

const profile = { locale: 'EN-NG' } as const
const strings = stringsFor('en')

const company: Company = {
  id: 'co',
  name: 'Adeola Hardware',
  localeRegion: 'NG',
  localeLanguage: 'en',
  currency: 'NGN',
  labelOverrides: {},
  numberingPrefixes: {},
  bankFields: {},
  enabledPaymentMethods: ['bank_transfer'],
}

const customer: Customer = {
  id: 'cu',
  companyId: 'co',
  kind: 'company',
  name: 'Bello & Sons',
  labels: [],
}

const record = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'd1',
  companyId: 'co',
  type: 'invoice',
  status: 'issued',
  customerId: 'cu',
  currency: 'NGN',
  issueDate: '2026-09-15',
  lineItems: [
    {
      id: 'l1',
      description: 'Roofing sheet',
      quantityMilli: quantity(10),
      unitPriceMinor: 100_000,
      taxable: true,
    },
  ],
  issuedReference: 'INV-0001',
  frozenLabels: freezeLabels(profile, 'invoice'),
  totalMinor: 1_000_000,
  ...over,
})

const compose = (row: DocumentRecord, documents: readonly DocumentRecord[] = [row]) => {
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
      replaces: replacesOf(documents, row),
      today: '2026-09-15',
    }),
    { ...composeOptionsOf({ company, design, strings, assets: [] }), profile },
  )
}

describe('The design a document was given', () => {
  it('reads back what was stored', () => {
    const design = designOf(
      record({ templateId: 'aurora', showLogo: false, brandColour: '#0F6E56', discountRatePpm: 75_000 }),
      company,
    )
    expect(design).toEqual({
      templateId: 'aurora',
      showLogo: false,
      brandColour: '#0F6E56',
      discountPercent: 7.5,
    })
  })

  /**
   * Every document saved before the design columns existed carries none of
   * these. A null there has always meant "whatever the app defaults to", so
   * that is what it must resolve to — not a guess about what was chosen.
   */
  it('falls back for a record that predates the design columns', () => {
    expect(designOf(record(), company)).toEqual({
      templateId: 'classic',
      showLogo: true,
      brandColour: DEFAULT_BRAND_COLOUR,
      discountPercent: 0,
    })
  })

  it('prefers the company colour over the built-in default', () => {
    expect(designOf(record(), { ...company, brandColour: '#BA7517' }).brandColour).toBe('#BA7517')
  })

  /**
   * A build that no longer ships a design must still open the documents made
   * with it. Falling back beats throwing: the document is not the design.
   */
  it('falls back rather than throwing on a design this build does not have', () => {
    expect(templateIdOf('a-design-from-the-future')).toBe('classic')
  })
})

describe('The composed page', () => {
  it('carries the discount into the totals, exactly', () => {
    const model = compose(record({ discountRatePpm: 75_000 }))
    // 7.5% of ₦10,000.00 — integer minor units throughout (Rule #3).
    expect(model.totals?.discount?.minor).toBe(75_000)
    expect(model.totals?.payable.minor).toBe(925_000)
  })

  /**
   * The heart of it. The stored `totalMinor` froze at issue; a page composed
   * from the record has to arrive at the same number on its own, or the
   * document disagrees with itself.
   */
  it('reaches the total the document was issued with', () => {
    const row = record({ discountRatePpm: 75_000, totalMinor: 925_000 })
    expect(compose(row).totals?.payable.minor).toBe(row.totalMinor)
  })

  it('prints the frozen title, not the live one', () => {
    const frozen = { ...freezeLabels(profile, 'waybill'), printedTitle: 'DELIVERY NOTE' }
    expect(compose(record({ type: 'waybill', frozenLabels: frozen, totalMinor: 0 })).title).toBe(
      'DELIVERY NOTE',
    )
  })

  it('shows a provisional reference while the document is still a draft', () => {
    const draft = record({ status: 'draft', issuedReference: null, frozenLabels: null })
    expect(
      composableOf({
        draft: draftOf(draft),
        design: designOf(draft, company),
        company,
        customer,
        profile,
        reference: draft.issuedReference,
        status: draft.status,
        frozenLabels: draft.frozenLabels,
        replaces: null,
        today: '2026-09-15',
      }).reference,
    ).toMatch(/-…$/)
  })

  /** A delivery carries no money under any design (§V). */
  it('never puts money on a delivery document', () => {
    const model = compose(
      record({ type: 'waybill', discountRatePpm: 75_000, totalMinor: 0, lineItems: [] }),
    )
    expect(model.totals).toBeNull()
    expect(model.paymentBox).toBeNull()
  })
})

describe('A delivery table is headed GOODS (§G, §I)', () => {
  const waybillModel = () => {
    const row = record({
      type: 'waybill',
      totalMinor: 0,
      lineItems: [
        {
          id: 'l1',
          description: 'Cement 50kg',
          quantityMilli: quantity(10),
          unit: 'cartons',
          taxable: false,
        },
      ],
      frozenLabels: freezeLabels(profile, 'waybill'),
    })
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
        today: '2026-09-15',
      }),
      { ...composeOptionsOf({ company, design, strings, assets: [] }), profile },
    )
  }

  /**
   * Through the APP'S OWN composition, not a hand-built options object.
   *
   * `columnLabels.goods` falls back to `description` for callers that never
   * draw a delivery, and a test that supplied its own labels would prove
   * nothing about what ships. This goes through `composeOptionsOf`, which is
   * the path every screen and the PDF writer use.
   */
  it('heads the first column with the delivery word, not the money one', () => {
    const columns = waybillModel().columns
    expect(columns[0]?.label).toBe(strings.items.goods)
    expect(columns[0]?.label).not.toBe(strings.items.description)
  })

  it('keeps QTY and UNIT beside it, and no amount column', () => {
    const keys = waybillModel().columns.map((column) => column.key)
    expect(keys).toEqual(['description', 'quantity', 'unit'])
  })

  /** A money document is unaffected — its table still lists descriptions. */
  it('leaves an invoice headed with the money word', () => {
    const design = designOf(record(), company)
    const model = composeDocument(
      composableOf({
        draft: draftOf(record()),
        design,
        company,
        customer,
        profile,
        reference: 'INV-0042',
        status: 'issued',
        frozenLabels: freezeLabels(profile, 'invoice'),
        replaces: null,
        today: '2026-09-15',
      }),
      { ...composeOptionsOf({ company, design, strings, assets: [] }), profile },
    )
    expect(model.columns[0]?.label).toBe(strings.items.description)
  })
})

describe('What a document replaces', () => {
  const replaced = record({ id: 'q0', type: 'quotation', issuedReference: 'QUO-0001' })
  const revision = record({ id: 'q1', type: 'quotation', supersedesId: 'q0' })

  it('numbers a quotation chain, because §G calls those Rev 2', () => {
    expect(replacesOf([replaced, revision], revision)).toEqual({
      reference: 'QUO-0001',
      revisionNumber: 2,
    })
  })

  /** A reissued receipt replaces one cancelled receipt and says only that. */
  it('does not number a reissue', () => {
    const cancelled = record({ id: 'r0', type: 'receipt', issuedReference: 'RCP-0001' })
    const reissue = record({ id: 'r1', type: 'receipt', supersedesId: 'r0' })
    expect(replacesOf([cancelled, reissue], reissue)).toEqual({ reference: 'RCP-0001' })
  })

  it('is nothing at all for a document that replaces nothing', () => {
    expect(replacesOf([replaced], replaced)).toBeNull()
  })
})

describe('The draft a saved record reads as', () => {
  /**
   * A field the record holds and this drops is one the builder silently loses
   * on the next save — which is exactly how the delivery address, the driver,
   * the dispatch date and the signature went missing once already.
   */
  it('keeps every field the builder can edit', () => {
    const row = record({
      type: 'waybill',
      deliveryAddress: '14 Ogunlana Drive',
      driverName: 'Musa',
      vehicleNumber: 'LAG-441-KJA',
      dispatchDate: '2026-09-16',
      signatureAssetId: 'as_1',
      dueDate: '2026-09-30',
      validUntil: '2026-10-15',
      paymentId: 'pay_1',
      linkedInvoiceId: 'd0',
    })
    expect(draftOf(row)).toMatchObject({
      deliveryAddress: '14 Ogunlana Drive',
      driverName: 'Musa',
      vehicleNumber: 'LAG-441-KJA',
      dispatchDate: '2026-09-16',
      signatureAssetId: 'as_1',
      dueDate: '2026-09-30',
      validUntil: '2026-10-15',
      paymentId: 'pay_1',
      linkedInvoiceId: 'd0',
    })
  })

  /** Absent means absent — an explicit `undefined` key is not the same thing. */
  it('omits what the record does not carry', () => {
    expect(Object.keys(draftOf(record()))).not.toContain('driverName')
  })
})

describe('What is switched on reaches the printed page (§I, §J)', () => {
  const design = {
    templateId: 'classic' as const,
    showLogo: true,
    brandColour: '#2b3fd6',
    discountPercent: 0,
  }

  /**
   * §J: "everything switched on prints in invoice payment instructions".
   * `otherPaymentMethods` was on `ComposeOptions` with no caller supplying
   * one, so switching a method on in Settings changed nothing on a document.
   */
  it('passes every enabled method except bank transfer, which is the box itself', () => {
    const options = composeOptionsOf({
      company: { ...company, enabledPaymentMethods: ['bank_transfer', 'cash_on_delivery'] },
      design,
      strings,
      assets: [],
    })
    expect(options.otherPaymentMethods).toEqual(['Cash on delivery'])
  })

  it('names them in words, never as the stored token (§S)', () => {
    const options = composeOptionsOf({
      company: { ...company, enabledPaymentMethods: ['cash_on_delivery'] },
      design,
      strings,
      assets: [],
    })
    expect(options.otherPaymentMethods?.[0]).not.toContain('_')
  })

  it('passes none when only bank transfer is on', () => {
    const options = composeOptionsOf({ company, design, strings, assets: [] })
    expect(options.otherPaymentMethods).toEqual([])
  })

  /** The logo is named by the branding and resolved from the assets it owns. */
  it('carries the business address and the logo id into the branding', () => {
    const options = composeOptionsOf({
      company: { ...company, address: '14 Ogunlana Drive', logoAssetId: 'as_1' },
      design,
      strings,
      assets: [
        { id: 'as_1', companyId: 'co', kind: 'logo', dataUrl: 'data:image/png;base64,x', createdAt: '2026-09-15' },
      ],
    })
    expect(options.branding.address).toBe('14 Ogunlana Drive')
    expect(options.branding.logoAssetId).toBe('as_1')
    expect(options.assetUrls?.['as_1']).toBe('data:image/png;base64,x')
  })
})
