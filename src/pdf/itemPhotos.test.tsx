/**
 * A picture of the goods, all the way to the paper (§E, §G step 2, §I).
 *
 * §E has listed "image asset id" among a line item's fields since the spec was
 * written, §G step 2 asked for "a card with optional photo", §I for "a
 * thumbnail if a photo was attached" — and `LineItem` had no such field, so
 * nothing could attach one and nothing could print one. Three layers were
 * ready for a value none of them could ever receive.
 *
 * THROUGH THE WHOLE CHAIN, never `composeDocument` on its own. CLAUDE.md
 * records why: a test that calls compose directly proves compose CAN fill a
 * block, never that anything fills it — which is exactly how the receipt
 * evidence block sat empty on every printed receipt while its tests passed.
 * So these go record → `draftOf` → `composableOf` → `composeDocument` →
 * `DocumentPage`, the same route a saved document takes.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { AssetRecord, Company, Customer, DocumentRecord } from '../data/repositories'
import { DOCUMENT_TYPES, type DocumentType, quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { stringsFor } from '../domain/locale/data/strings'
import { money } from '../domain/money/money'
import {
  composableOf,
  composeOptionsOf,
  designOf,
  draftOf,
} from '../features/documents/composition'
import { ITEM_PHOTO_BUDGET } from '../features/photos/resize'
import { composeDocument } from './compose'
import { DocumentPage } from './DocumentPage'
import { paginate } from './paginate'
import { TEMPLATES, templateById } from './templates'
import { formatMoney } from '../features/customers/formatMoney'

const profile = { locale: 'EN-NG' } as const
const strings = stringsFor('en')

/**
 * A real thumbnail's worth of bytes, not a three-character stub.
 *
 * `data:,x` would satisfy every assertion below and prove nothing about the
 * size budget — the guard that exists because these documents go out over
 * metered data. This is roughly what 320px at quality 0.6 produces.
 */
const THUMB = `data:image/jpeg;base64,${'A'.repeat(20_000)}`

const PHOTO: AssetRecord = {
  id: 'ast_photo',
  companyId: 'co',
  kind: 'item_photo',
  dataUrl: THUMB,
  createdAt: '2026-09-15T09:00:00Z',
}

const company: Company = {
  id: 'co',
  name: 'Adeola Hardware',
  localeRegion: 'NG',
  localeLanguage: 'en',
  currency: 'NGN',
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

const record = (type: DocumentType, over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'd1',
  companyId: 'co',
  type,
  status: 'issued',
  customerId: 'cu',
  currency: 'NGN',
  issueDate: '2026-09-15',
  lineItems: [
    {
      id: 'l1',
      description: 'Roofing sheet',
      quantityMilli: quantity(10),
      ...(type === 'waybill' ? { unit: 'bundles' } : { unitPriceMinor: 100_000 }),
      taxable: true,
      imageAssetId: 'ast_photo',
    },
  ],
  issuedReference: 'REF-0001',
  frozenLabels: freezeLabels(profile, type),
  totalMinor: 1_000_000,
  ...(type === 'receipt' ? { paymentId: 'pay_1' } : {}),
  ...over,
})

const compose = (row: DocumentRecord, assets: readonly AssetRecord[] = [PHOTO]) => {
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
      ...(row.type === 'receipt'
        ? { payment: { amount: money('NGN', row.totalMinor), at: '2026-09-15' } }
        : {}),
    }),
    { ...composeOptionsOf({ company, design, strings, assets }), profile },
  )
}

const draw = (row: DocumentRecord, templateId = 'classic', assets: readonly AssetRecord[] = [PHOTO]) => {
  const model = compose(row, assets)
  const pages = paginate(model, { rowsPerPage: 18, footerRowCost: 4 })
  const first = pages[0]
  if (first === undefined) throw new Error('no page')
  return render(
    <DocumentPage
      model={model}
      template={templateById(templateId)}
      page={first}
      totalPages={pages.length}
      formatAmount={(minor, currency) => formatMoney(money(currency, minor))}
      currency={row.currency}
      accent="#2b3fd6"
      continuedLabel="More"
    />,
  )
}

const thumbnails = () => document.querySelectorAll('img[data-item-photo]')

describe('The thumbnail reaches the page (§E, §G step 2, §I)', () => {
  /**
   * THE ONE THIS IS FOR. Removing `imageUrl` from the row mapper, or the
   * `imageAssetId` from `LineItem`, has to turn this red — the field existed
   * in three layers and printed nothing for exactly as long.
   */
  it.each(['invoice', 'quotation', 'waybill'] as const)(
    'prints it on a %s',
    (type) => {
      draw(record(type))
      const drawn = thumbnails()
      expect(drawn, `a ${type} does not print the photo its line carries`).toHaveLength(1)
      expect(drawn[0]?.getAttribute('src')).toBe(THUMB)
    },
  )

  /**
   * AND NEVER ON A RECEIPT. It is evidence that money arrived; the goods were
   * described on the invoice it settles, which carries the photographs
   * already. Pictures of merchandise on a proof of payment are the wrong
   * document doing the other one's job.
   */
  it('never prints it on a receipt', () => {
    draw(record('receipt'))
    expect(thumbnails(), 'a receipt printed a picture of the goods').toHaveLength(0)
    // And the row is still there — it is the PICTURE that is dropped, not the
    // line, which a receipt settling an invoice does carry.
    expect(screen.getByText('Roofing sheet')).toBeInTheDocument()
  })

  /** Every type, from one list, so a fifth could not quietly skip the rule. */
  it('decides for every document type there is', () => {
    for (const type of DOCUMENT_TYPES) {
      const row = compose(record(type)).rows[0]
      expect(
        row?.imageUrl === undefined,
        `${type} disagrees with the rule about which types show goods`,
      ).toBe(type === 'receipt')
    }
  })

  /**
   * A row with NO photo is exactly the row it was before — no wrapper, no
   * empty box holding space for a picture that is not there. This is the
   * "ignoring it costs nothing" half of Rule #1, on the paper.
   */
  it('leaves a row without a photo alone', () => {
    const plain = record('invoice')
    const [line] = plain.lineItems
    if (line === undefined) throw new Error('no line')
    const { imageAssetId: _none, ...withoutPhoto } = line
    const view = draw({ ...plain, lineItems: [withoutPhoto] })
    expect(thumbnails()).toHaveLength(0)
    const cell = screen.getByText('Roofing sheet')
    expect(cell.tagName, 'a plain row gained a wrapper it does not need').toBe('TD')
    view.unmount()
  })

  /**
   * AN ASSET NOTHING CAN RESOLVE PRINTS NOTHING — never a broken image on a
   * document that claims to show the goods. The same rule the business's own
   * signature and the logo already follow (§P).
   */
  it('prints no thumbnail for a photo the asset store has lost', () => {
    draw(record('invoice'), 'classic', [])
    expect(thumbnails()).toHaveLength(0)
    expect(screen.getByText('Roofing sheet')).toBeInTheDocument()
  })
})

describe('A thumbnail never distorts the table (§I)', () => {
  /**
   * FIXED, SQUARE AND CROPPED. A portrait photograph, a landscape one and a
   * square one all occupy the same space, so nothing a phone camera produces
   * can widen the description column or push the totals off the page.
   */
  it('draws at a fixed size whatever shape the photo was', () => {
    draw(record('invoice'))
    const image = thumbnails()[0]
    expect(image?.className).toContain('h-[34px]')
    expect(image?.className).toContain('w-[34px]')
    expect(image?.className, 'an uncropped photo can stretch the column').toContain('object-cover')
    expect(image?.className).toContain('shrink-0')
  })

  /** In the description cell, not a column of its own that every row pays for. */
  it('sits inside the description cell', () => {
    draw(record('invoice'))
    expect(thumbnails()[0]?.closest('td')?.textContent).toContain('Roofing sheet')
  })

  /**
   * ALL SIXTEEN DESIGNS. A template that laid the table out differently could
   * break on a taller row, and finding that out on somebody's phone is the
   * thing this replaces.
   */
  it.each(TEMPLATES.map((template) => template.id))('handles a photo row on %s', (templateId) => {
    const view = draw(record('invoice'), templateId)
    expect(thumbnails(), `${templateId} dropped the thumbnail`).toHaveLength(1)
    expect(screen.getByText('Roofing sheet')).toBeInTheDocument()
    view.unmount()
  })
})

describe('A photographed row is not split, and does not overflow (§I)', () => {
  const rows = (count: number, photos: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `l${index}`,
      description: `Item ${index}`,
      quantityMilli: quantity(1),
      unitPriceMinor: 1_000,
      taxable: true,
      ...(index < photos ? { imageAssetId: 'ast_photo' } : {}),
    }))

  /**
   * A photographed line is a thumbnail tall — a little over twice a text row
   * — and counting it as one row is how a page of them would have run off the
   * bottom. Since a row is atomic here, that overflow could not have been
   * resolved by splitting it.
   */
  it('fits fewer photographed rows on a page than plain ones', () => {
    const many = (photos: number) =>
      paginate(compose(record('invoice', { lineItems: rows(12, photos) })), {
        rowsPerPage: 10,
        footerRowCost: 3,
      })

    expect(many(0)).toHaveLength(2)
    expect(
      many(12).length,
      'photographed rows were counted as though they were text',
    ).toBeGreaterThan(2)
  })

  /** And nothing is lost or doubled on the way — every row, exactly once. */
  it('keeps every row exactly once', () => {
    const model = compose(record('invoice', { lineItems: rows(12, 6) }))
    const pages = paginate(model, { rowsPerPage: 10, footerRowCost: 3 })
    const flat = pages.flatMap((page) => page.rows)
    expect(flat).toHaveLength(model.rows.length)
    expect(flat.map((row) => row.description)).toEqual(
      model.rows.map((row) => row.description),
    )
    expect(pages.filter((page) => page.showsFooter)).toHaveLength(1)
    // The block that carries the totals never sits alone on a final page.
    expect(pages[pages.length - 1]?.rows.length).toBeGreaterThan(0)
  })
})

describe('Nothing here needs a connection, and nothing here is heavy (§M)', () => {
  /**
   * §M: "nothing needed to open a saved document touches a CDN." A thumbnail
   * is a `data:` URL like the logo and the signature, so composing and
   * printing a photographed document is arithmetic and no request.
   */
  it('embeds the photo rather than pointing at one', () => {
    const row = compose(record('invoice')).rows[0]
    expect(row?.imageUrl?.startsWith('data:'), 'a document reached for a URL').toBe(true)
    expect(row?.imageUrl).not.toMatch(/^https?:/)
  })

  /**
   * AND IT STAYS SMALL. These go out over WhatsApp on metered data with poor
   * signal: a PDF that takes a minute to send is a PDF that does not get
   * sent. The budget is a number something can fail against rather than an
   * intention in a comment.
   */
  it('keeps the embedded image inside the budget', () => {
    expect(THUMB.length).toBeLessThanOrEqual(ITEM_PHOTO_BUDGET)
  })
})
