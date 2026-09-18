/**
 * The sixteen designs are sixteen layouts (§H).
 *
 * This file exists because of what its absence allowed. `TemplateThumb` drew
 * sixteen distinct schematics and `DocumentPage` branched on `headerStyle`
 * exactly once — to halve one rule's opacity — so every design printed the
 * same page with a different typeface. Every test passed throughout: nothing
 * anywhere asserted that choosing a design changed anything.
 *
 * So the assertions here are deliberately about DIFFERENCE, not about pixels.
 * Pinning exact markup would freeze the designs and break on every tweak; what
 * has to stay true is that a person picking Prism does not get Classic.
 *
 * And the words must survive all sixteen: an arrangement that loses the title,
 * the reference or the party has rearranged the document into a lie, however
 * good it looks (Rule #5, §D.2).
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { DocumentPage } from './DocumentPage'
import { HEADER_STYLES } from './DocumentHeader'
import { TEMPLATES, templateById } from './templates'
import { composeDocument } from './compose'
import { paginate } from './paginate'
import { quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { stringsFor } from '../domain/locale/data/strings'

const PROFILE = { locale: 'EN-NG' } as const
const strings = stringsFor('en')

const model = composeDocument(
  {
    type: 'invoice',
    status: 'issued',
    currency: 'NGN',
    reference: 'INV-0042',
    issueDate: '2026-09-15',
    lineItems: [
      {
        id: 'l1',
        description: 'Galvanised roofing sheet',
        quantityMilli: quantity(24),
        unitPriceMinor: 18_500_00,
        taxable: true,
      },
    ],
    party: { name: 'Adeola Hardware', address: '14 Ogunlana Drive' },
    frozenLabels: freezeLabels(PROFILE, 'invoice'),
  },
  {
    profile: PROFILE,
    branding: { name: 'Sola Ventures', nameStyle: 'classic', logoSize: 'M', showLogo: true },
    columnLabels: {
      description: strings.items.description,
      quantity: strings.items.quantity,
      amount: strings.totals.payable,
      unit: strings.items.unit,
    },
    assetUrls: {},
    replacesLabel: () => '',
  },
)

const pages = paginate(model, { rowsPerPage: 18, footerRowCost: 4 })

const draw = (templateId: string) => {
  const view = render(
    <DocumentPage
      model={model}
      template={templateById(templateId)}
      page={pages[0]!}
      totalPages={pages.length}
      formatAmount={(minor) => `₦${(minor / 100).toFixed(2)}`}
      currency="NGN"
      accent="#2b3fd6"
    />,
  )
  const article = view.container.querySelector('article')
  if (article === null) throw new Error('No page rendered.')
  return { view, article }
}

describe('A receipt carries its evidence, and nothing else does (§I, §K)', () => {
  /**
   * §E line 190: "receipts show date paid, linked invoice, method +
   * reference". Those are the three facts that make a receipt a receipt, and
   * `compose` built them into a `receiptEvidence` that NO PAGE EVER READ — so
   * every printed receipt was missing all of them.
   *
   * Found by the declared-field sweep rather than by anybody looking.
   */
  const receiptModel = () =>
    composeDocument(
      {
        type: 'receipt',
        status: 'issued',
        currency: 'NGN',
        reference: 'RCP-0003',
        issueDate: '2026-09-11',
        paidAmount: { currency: 'NGN', minor: 50_000_00 },
        paidAt: '2026-09-11',
        paidMethod: 'Bank transfer',
        lineItems: [
          {
            id: 'l1',
            description: 'Part payment',
            quantityMilli: quantity(1),
            unitPriceMinor: 50_000_00,
            taxable: false,
          },
        ],
        party: { name: 'Adeola Hardware' },
        frozenLabels: freezeLabels(PROFILE, 'receipt'),
      },
      {
        profile: PROFILE,
        branding: { name: 'Sola Ventures', nameStyle: 'classic', logoSize: 'M', showLogo: true },
        columnLabels: {
          description: strings.items.description,
          quantity: strings.items.quantity,
          amount: strings.totals.payable,
          unit: strings.items.unit,
        },
        assetUrls: {},
        replacesLabel: () => '',
      },
    )

  it('prints the amount, the date paid and the method, in every design', () => {
    const model = receiptModel()
    const pages = paginate(model, { rowsPerPage: 18, footerRowCost: 4 })

    for (const template of TEMPLATES) {
      const view = render(
        <DocumentPage
          model={model}
          template={template}
          page={pages[0]!}
          totalPages={1}
          formatAmount={(minor) => `₦${(minor / 100).toFixed(2)}`}
          currency="NGN"
          accent="#2b3fd6"
        />,
      )
      const page = within(view.container.querySelector('article')!)

      // Scoped to the block: the amount is legitimately on the line row too,
      // and an unscoped query would pass on the row alone — which is the
      // document without its evidence, the very thing being tested for.
      const heading = page.getByText('Payment received')
      const block = within(heading.parentElement!)

      expect(block.getByText('₦50000.00'), `${template.name} lost the amount`).toBeInTheDocument()
      expect(
        block.getByText('11 Sep 2026'),
        `${template.name} lost the date paid`,
      ).toBeInTheDocument()
      expect(block.getByText('Bank transfer'), `${template.name} lost the method`).toBeInTheDocument()

      view.unmount()
    }
  })

  /** And it is a receipt's block alone — never on anything that is not one. */
  it.each(['invoice', 'quotation', 'waybill'] as const)(
    'never puts a payment-received block on a %s',
    (type) => {
      const model = composeDocument(
        {
          type,
          status: 'issued',
          currency: 'NGN',
          reference: 'REF-1',
          issueDate: '2026-09-11',
          // SET, not omitted: a document that carries payment facts must
          // still not print a receipt's block unless it is a receipt.
          paidAmount: { currency: 'NGN', minor: 50_000_00 },
          paidAt: '2026-09-11',
          paidMethod: 'Bank transfer',
          lineItems: [
            {
              id: 'l1',
              description: 'Cement',
              quantityMilli: quantity(1),
              unitPriceMinor: 50_000_00,
              taxable: true,
            },
          ],
          party: { name: 'Adeola Hardware' },
          frozenLabels: freezeLabels(PROFILE, type),
        },
        {
          profile: PROFILE,
          branding: { name: 'Sola Ventures', nameStyle: 'classic', logoSize: 'M', showLogo: true },
          columnLabels: {
            description: strings.items.description,
            quantity: strings.items.quantity,
            amount: strings.totals.payable,
            unit: strings.items.unit,
          },
          assetUrls: {},
          replacesLabel: () => '',
        },
      )

      expect(model.receiptEvidence).toBeNull()

      const pages = paginate(model, { rowsPerPage: 18, footerRowCost: 4 })
      render(
        <DocumentPage
          model={model}
          template={templateById('classic')}
          page={pages[0]!}
          totalPages={1}
          formatAmount={(minor) => `₦${(minor / 100).toFixed(2)}`}
          currency="NGN"
          accent="#2b3fd6"
        />,
      )
      expect(screen.queryByText('Payment received')).not.toBeInTheDocument()
    },
  )
})

describe('Every design is a design (§H)', () => {
  /**
   * The guard whose absence let sixteen designs become one. If a new design
   * is added with a header style nothing draws, this is what says so — before
   * the strip starts advertising a shape the page cannot produce.
   */
  it('draws every header style the templates declare', () => {
    for (const template of TEMPLATES) {
      expect(HEADER_STYLES, `${template.name} declares an undrawn header style`).toContain(
        template.headerStyle,
      )
    }
  })

  it('declares no header style that no template uses', () => {
    const used = new Set(TEMPLATES.map((template) => template.headerStyle))
    for (const style of HEADER_STYLES) {
      expect(used, `${style} is drawn but no design asks for it`).toContain(style)
    }
  })

  /**
   * The assertion that would have caught the original bug. Sixteen designs
   * that render identical markup are one design wearing sixteen names.
   */
  it('renders sixteen structurally different pages', () => {
    const shapes = new Map<string, string>()

    for (const template of TEMPLATES) {
      const { view, article } = draw(template.id)
      // Structure alone: the words are identical across all sixteen by
      // design, so comparing text would find no difference at all.
      const shape = article.innerHTML.replace(/>[^<]*</g, '><')
      shapes.set(template.name, shape)
      view.unmount()
    }

    expect(shapes.size).toBe(16)
    expect(new Set(shapes.values()).size, 'two designs render the same page').toBe(16)
  })

  /**
   * An arrangement is free to move the title anywhere it likes; it is not
   * free to lose it. A design that drops the reference has turned a document
   * into something a customer cannot identify.
   */
  it('keeps the title, the reference and the party in all sixteen', () => {
    for (const template of TEMPLATES) {
      const { view, article } = draw(template.id)
      const page = within(article)

      expect(page.getByText('INVOICE'), `${template.name} lost the title`).toBeInTheDocument()
      expect(page.getByText('INV-0042'), `${template.name} lost the reference`).toBeInTheDocument()
      expect(
        page.getByText('Adeola Hardware'),
        `${template.name} lost the party`,
      ).toBeInTheDocument()
      /*
       * TWICE now, by design: in the header, and under the signature as the
       * business the mark commits — which is what every legacy document does.
       * A signature over a bare rule says somebody signed and not on whose
       * behalf. `getAllByText` because `getByText` fails on more than one.
       */
      expect(
        page.getAllByText('Sola Ventures').length,
        `${template.name} lost the business name`,
      ).toBeGreaterThan(0)

      view.unmount()
    }
  })

  /**
   * §V, checked per design rather than once: a delivery carries no money
   * under ANY arrangement. A header that drew a total would be the one place
   * the rule could be broken by decoration.
   */
  /**
   * The control for the case below it.
   *
   * An absence test is worth exactly as much as the inputs' ability to
   * produce the thing being denied. So the SAME line, discount, VAT and
   * withholding go onto an invoice first: if money does not appear here, the
   * delivery proving it has none proves nothing at all.
   */
  it('prints money for those very inputs on an invoice', () => {
    const priced = composeDocument(
      {
        type: 'invoice',
        status: 'issued',
        currency: 'NGN',
        reference: 'INV-0042',
        issueDate: '2026-09-15',
        lineItems: [
          {
            id: 'l1',
            description: 'Cartons',
            quantityMilli: quantity(3),
            unitPriceMinor: 25_000_00,
            taxable: true,
          },
        ],
        discountRate: 75_000,
        taxRate: 75_000,
        whtRate: 50_000,
        party: { name: 'Adeola Hardware' },
        frozenLabels: freezeLabels(PROFILE, 'invoice'),
      },
      {
        profile: PROFILE,
        branding: { name: 'Sola Ventures', nameStyle: 'classic', logoSize: 'M', showLogo: true },
        columnLabels: {
          description: strings.items.description,
          quantity: strings.items.quantity,
          amount: strings.totals.payable,
          unit: strings.items.unit,
        },
        assetUrls: {},
        replacesLabel: () => '',
      },
    )

    // Every rate reached the model, so the delivery case below is a real test.
    expect(priced.totals).not.toBeNull()
    expect(priced.totals?.discount?.minor).toBeGreaterThan(0)
    expect(priced.totals?.tax.minor).toBeGreaterThan(0)
    expect(priced.totals?.wht.minor).toBeGreaterThan(0)
    expect(priced.totals?.payable.minor).toBeGreaterThan(0)
  })

  /**
   * ABSENCE, PROVED AGAINST EVERY RATE THAT COULD PRODUCE A NUMBER.
   *
   * A delivery with no rates set proves very little — nothing had a total to
   * print. So this one arrives carrying a priced line, a discount, VAT and
   * withholding: every input the money layer needs to produce a subtotal, a
   * tax row and a payable. If §V's "a delivery carries no money" is a
   * property of the TYPE rather than of the inputs, all sixteen designs still
   * show nothing.
   *
   * Per design rather than once, because "no money anywhere" drifts back one
   * component at a time, and a header is exactly where it would.
   */
  it('puts no money on a delivery document, whichever design is chosen', () => {
    const waybill = composeDocument(
      {
        type: 'waybill',
        status: 'issued',
        currency: 'NGN',
        reference: 'WB-0007',
        issueDate: '2026-09-15',
        // A PRICED, TAXABLE line, on purpose: if a delivery ever printed
        // money, this is the row that would make it do so.
        lineItems: [
          {
            id: 'l1',
            description: 'Cartons',
            quantityMilli: quantity(3),
            unitPriceMinor: 25_000_00,
            taxable: true,
          },
        ],
        // And every rate that turns a line into a total.
        discountRate: 75_000,
        taxRate: 75_000,
        whtRate: 50_000,
        party: { name: 'Adeola Hardware' },
        frozenLabels: freezeLabels(PROFILE, 'waybill'),
      },
      {
        profile: PROFILE,
        branding: { name: 'Sola Ventures', nameStyle: 'classic', logoSize: 'M', showLogo: true },
        columnLabels: {
          description: strings.items.description,
          quantity: strings.items.quantity,
          amount: strings.totals.payable,
          unit: strings.items.unit,
        },
        assetUrls: {},
        replacesLabel: () => '',
      },
    )
    const waybillPages = paginate(waybill, { rowsPerPage: 18, footerRowCost: 4 })

    for (const template of TEMPLATES) {
      const view = render(
        <DocumentPage
          model={waybill}
          template={template}
          page={waybillPages[0]!}
          totalPages={1}
          formatAmount={(minor) => `₦${(minor / 100).toFixed(2)}`}
          currency="NGN"
          accent="#2b3fd6"
        />,
      )
      const page = within(view.container.querySelector('article')!)
      // No currency anywhere, under any design.
      // The two rules a delivery ends with, per design — presence drifts the
      // same way absence does, and a delivery with no RECEIVED BY line is one
      // nobody can sign at a gate (§I).
      expect(
        page.getByText(waybill.receivedBy!.caption),
        `${template.name} lost the received-by rule`,
      ).toBeInTheDocument()
      expect(
        page.getByText(waybill.signature.caption),
        `${template.name} lost the dispatched-by caption`,
      ).toBeInTheDocument()

      expect(screen.queryByText(/₦/), `${template.name} printed money on a delivery`).toBeNull()
      // And none of the rows a total is built from.
      for (const word of [/subtotal/i, /payable/i, /VAT/, /withholding/i, /discount/i]) {
        expect(page.queryByText(word), `${template.name} printed ${word} on a delivery`).toBeNull()
      }
      view.unmount()
    }
  })
})

/**
 * SIXTEEN DESIGNS, SIXTEEN HEADERS (§H).
 *
 * `sidebar`, `frame` and `wave` shared ONE case block, differing only by a
 * ternary on the centring and the rule's thickness. Three of the sixteen drew
 * the same arrangement and were told apart by their background chrome alone —
 * which is a background, not a design.
 *
 * The existing checks could not see it: they assert each design renders the
 * title, the reference and the party, and three identical headers do that
 * perfectly. "Each one renders" was never the question §H asks.
 */
/**
 * Sidebar's column, and whether anything is in it (§H, §I).
 *
 * A THIRD OF THE PAGE WAS TINTED AND EMPTY. The chrome painted the column,
 * `contentInset` pushed the whole document clear of it, and nothing ever went
 * in — so the design called "Sidebar" was Classic squeezed into two thirds of
 * the paper with a coloured margin beside it.
 *
 * Nothing caught it. Every guard here asks whether a design RENDERS the name,
 * the title, the party — and it rendered all of them, in the two thirds. The
 * question none of them asked was whether the structure the design is named
 * for holds anything.
 */
describe('The sidebar column carries the business (§H)', () => {
  const column = (id: string) => {
    const { view, article } = draw(id)
    /* The column is the chrome's own box: positioned, and outside the header. */
    const node = article.querySelector<HTMLElement>('[data-sidebar-column]')
    const text = (node?.textContent ?? '').replace(/\s+/g, ' ').trim()
    view.unmount()
    return { found: node !== null, text }
  }

  it('puts the identity inside the column, not beside it', () => {
    const { found, text } = column('sidebar')
    expect(found, 'sidebar draws no column').toBe(true)
    /*
     * Asserted on the TEXT rather than on the element existing: an empty
     * column is exactly the defect, and `querySelector` is true for one.
     */
    expect(text, 'the sidebar column is empty').toContain('Sola Ventures')
  })

  /** And the header no longer repeats it — the column IS the identity. */
  it('does not print the business twice', () => {
    const { view, article } = draw('sidebar')
    const header = article.querySelector('header')
    expect(header?.textContent ?? '').not.toContain('Sola Ventures')
    view.unmount()
  })

  /** No other design grows one by accident. */
  it('belongs to sidebar alone', () => {
    for (const template of TEMPLATES) {
      if (template.id === 'sidebar') continue
      const { view, article } = draw(template.id)
      expect(
        article.querySelector('[data-sidebar-column]'),
        `${template.id} drew a sidebar column`,
      ).toBeNull()
      view.unmount()
    }
  })
})

describe('No two designs draw the same header', () => {
  /**
   * The HEADER's markup, with the words stripped out — SHAPE, not content.
   *
   * The `<header>` element specifically, not the whole article. The first
   * version of this compared the article and could never have worked:
   * `PageChrome` paints a different column, spine, wave or frame behind each
   * design, so two identical headers still produced different markup and the
   * mutation — wave copied verbatim from sidebar — passed. The chrome is a
   * background; this is about the arrangement in front of it.
   */
  const shapeOf = (id: string): string => {
    const { view, article } = draw(id)
    const header = article.querySelector('header')
    expect(header, `${id} draws no header element`).not.toBeNull()
    const html = ((header?.innerHTML ?? '').match(/<[^>]+>/g) ?? [])
      .join('')
      .replace(/\s+/g, ' ')
    view.unmount()
    return html
  }

  it('gives every one of the sixteen its own arrangement', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []

    for (const template of TEMPLATES) {
      const shape = shapeOf(template.id)
      const first = seen.get(shape)
      if (first !== undefined) clashes.push(`${template.id} draws the same header as ${first}`)
      else seen.set(shape, template.id)
    }

    expect(clashes, clashes.join('; ')).toEqual([])
    expect(seen.size, 'sixteen designs should produce sixteen shapes').toBe(TEMPLATES.length)
  })

  /**
   * And the three that used to share one are still distinct from each other
   * specifically — named, because a future tidy-up that folds them back
   * together would otherwise only show up as a count.
   */
  it('keeps Sidebar, Aria and Wave apart', () => {
    const shapes = ['sidebar', 'aria', 'wave'].map(shapeOf)
    expect(new Set(shapes).size).toBe(3)
  })
})
