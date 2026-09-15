/**
 * The page renderer (§I).
 *
 * It knows nothing about document types — every per-type decision was made in
 * composeDocument — so these tests check that the model reaches the page
 * faithfully, especially the parts §V says must NOT appear.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { quantity } from '../domain/documents/types'
import { freezeLabels } from '../domain/locale/profile'
import { type ComposableDocument, composeDocument } from './compose'
import { paginate } from './paginate'
import { TEMPLATES, templateById } from './templates'
import { A4_ASPECT, DocumentPage } from './DocumentPage'

const branding = {
  name: 'Dynamic Renaissance Business Enterprises Ltd',
  nameStyle: 'classic' as const,
  logoSize: 'M' as const,
  showLogo: true,
}

const opts = {
  profile: { locale: 'EN-NG' },
  branding,
  columnLabels: { description: 'Description', quantity: 'Qty', unit: 'Unit', amount: 'Amount' },
  bankValues: {
    bank_name: 'Guaranty Trust Bank',
    account_number: '0123456789',
    account_name: 'Dynamic Renaissance Ltd',
  },
}

const fmt = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`

function draw(
  document: ComposableDocument,
  templateId = 'classic',
  rowsPerPage = 20,
  extraOptions: Partial<Parameters<typeof composeDocument>[1]> = {},
) {
  const model = composeDocument(document, { ...opts, ...extraOptions })
  const pages = paginate(model, { rowsPerPage, footerRowCost: 3 })
  const template = templateById(templateId)
  return {
    model,
    pages,
    render: (index = pages.length - 1) =>
      render(
        <DocumentPage
          model={model}
          template={template}
          page={pages[index]!}
          totalPages={pages.length}
          formatAmount={fmt}
          currency="NGN"
          accent="#2b3fd6"
          continuedLabel="continued…"
        />,
      ),
  }
}

const invoice: ComposableDocument = {
  type: 'invoice',
  status: 'issued',
  currency: 'NGN',
  reference: 'INV-0001',
  issueDate: '2026-09-11',
  dueDate: '2026-09-25',
  party: { name: 'Okoro & Sons', address: '12 Balogun St' },
  frozenLabels: null,
  lineItems: [
    { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
  ],
  taxRate: 75_000,
}

const delivery: ComposableDocument = {
  ...invoice,
  type: 'waybill',
  reference: 'WAY-0001',
  lineItems: [{ id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false }],
  taxRate: 0,
}

describe('A4 proportions (§G step 5, §I)', () => {
  it('renders at 210 × 297', () => {
    expect(A4_ASPECT).toBeCloseTo(210 / 297, 10)
    const { render: draw1 } = draw(invoice)
    draw1()
    expect(screen.getByRole('article')).toHaveStyle({ aspectRatio: String(A4_ASPECT) })
  })
})

describe('An invoice prints its payment box (§I, §J)', () => {
  it('shows the localised heading and every saved field', () => {
    draw(invoice).render()
    expect(screen.getByText('HOW TO PAY')).toBeInTheDocument()
    expect(screen.getByText('Guaranty Trust Bank')).toBeInTheDocument()
    expect(screen.getByText('0123456789')).toBeInTheDocument()
  })

  /**
   * §I: "online methods under a dashed divider labelled 'Other payment
   * methods', cash listed separately"; §J: "everything switched on prints in
   * invoice payment instructions".
   *
   * `otherMethods` reached the composed box and no page drew it, while no
   * caller supplied one either — so a method switched on in Settings printed
   * nowhere at all. Both halves are asserted here, because fixing one and
   * not the other leaves the owner exactly where they were.
   */
  it('lists the other methods under a divider, beneath the account', () => {
    draw(invoice, 'classic', 20, { otherPaymentMethods: ['Cash on delivery'] }).render()
    expect(screen.getByText('Other payment methods')).toBeInTheDocument()
    expect(screen.getByText('Cash on delivery')).toBeInTheDocument()
  })

  it('prints no divider when nothing else is switched on', () => {
    draw(invoice).render()
    expect(screen.queryByText('Other payment methods')).not.toBeInTheDocument()
  })

  /** A delivery has no payment box to hang them off (§V). */
  it('never lists them on a delivery document', () => {
    draw(delivery, 'classic', 20, { otherPaymentMethods: ['Cash on delivery'] }).render()
    expect(screen.queryByText('Other payment methods')).not.toBeInTheDocument()
    expect(screen.queryByText('Cash on delivery')).not.toBeInTheDocument()
  })

  it('prints the revision beside the reference (§G)', () => {
    draw(
      { ...invoice, type: 'quotation', replaces: { reference: 'QUO-0009', revisionNumber: 2 } },
      'classic',
      20,
      { replacesLabel: (r) => `Rev ${String(r.revisionNumber)} · replaces ${r.reference}` },
    ).render()
    expect(screen.getByText('Rev 2 · replaces QUO-0009')).toBeInTheDocument()
  })

  it('prints the captured signature above the rule (§I)', () => {
    const MARK = 'data:image/svg+xml,%3Csvg%2F%3E'
    draw({ ...invoice, signatureAssetId: 'ast_1' }, 'classic', 20, {
      assetUrls: { ast_1: MARK },
    }).render()
    expect(screen.getByRole('img', { name: 'AUTHORISED SIGNATURE' })).toHaveAttribute('src', MARK)
  })

  it('prints no mark at all when nobody signed', () => {
    draw(invoice).render()
    expect(screen.getByText('AUTHORISED SIGNATURE')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'AUTHORISED SIGNATURE' })).not.toBeInTheDocument()
  })

  it('carries the authorised-signature caption', () => {
    draw(invoice).render()
    expect(screen.getByText('AUTHORISED SIGNATURE')).toBeInTheDocument()
  })
})

describe('A delivery document shows no money, in every design (§V)', () => {
  it('prints no amount column, no totals and no payment box', () => {
    for (const template of TEMPLATES) {
      const { render: drawIt } = draw(delivery, template.id)
      const { unmount } = drawIt()

      expect(screen.queryByText('Amount'), template.name).not.toBeInTheDocument()
      expect(screen.queryByText('HOW TO PAY'), template.name).not.toBeInTheDocument()
      expect(screen.queryByText(/₦/), template.name).not.toBeInTheDocument()
      // …and it does carry the goods and the received-by rule.
      expect(screen.getByText('Cement'), template.name).toBeInTheDocument()
      expect(screen.getByText('RECEIVED BY'), template.name).toBeInTheDocument()

      unmount()
    }
  })

  it('uses the dispatched-by caption rather than the invoice one', () => {
    draw(delivery).render()
    expect(screen.getByText('DISPATCHED BY')).toBeInTheDocument()
    expect(screen.queryByText('AUTHORISED SIGNATURE')).not.toBeInTheDocument()
  })
})

describe('Long documents (§I)', () => {
  const many: ComposableDocument = {
    ...invoice,
    lineItems: Array.from({ length: 45 }, (_, i) => ({
      id: `l${i}`,
      description: `Item ${i}`,
      quantityMilli: quantity(1),
      unitPriceMinor: 100_000,
      taxable: true,
    })),
  }

  it('repeats the column headings on every page', () => {
    const { pages, render: drawIt } = draw(many, 'classic', 20)
    expect(pages.length).toBeGreaterThan(1)

    for (let i = 0; i < pages.length; i++) {
      const { unmount } = drawIt(i)
      expect(screen.getByText('Description')).toBeInTheDocument()
      expect(screen.getByText('Qty')).toBeInTheDocument()
      unmount()
    }
  })

  it('shows totals and signature on the last page only', () => {
    const { pages, render: drawIt } = draw(many, 'classic', 20)

    const first = drawIt(0)
    expect(screen.queryByText('AUTHORISED SIGNATURE')).not.toBeInTheDocument()
    expect(screen.getByText('continued…')).toBeInTheDocument()
    first.unmount()

    drawIt(pages.length - 1)
    expect(screen.getByText('AUTHORISED SIGNATURE')).toBeInTheDocument()
    expect(screen.queryByText('continued…')).not.toBeInTheDocument()
  })

  it('numbers the pages when there is more than one', () => {
    const { pages, render: drawIt } = draw(many, 'classic', 20)
    drawIt(0)
    expect(screen.getByText(`1 / ${pages.length}`)).toBeInTheDocument()
  })
})

describe('An issued document prints its frozen title (§D.2, §M, §V)', () => {
  it('keeps the original wording after the company moves region', () => {
    const frozen = freezeLabels({ locale: 'EN-NG' }, 'waybill')
    const model = composeDocument(
      { ...delivery, frozenLabels: frozen },
      { ...opts, profile: { locale: 'EN-GB' } },
    )
    const pages = paginate(model, { rowsPerPage: 20, footerRowCost: 3 })

    render(
      <DocumentPage
        model={model}
        template={templateById('classic')}
        page={pages[0]!}
        totalPages={1}
        formatAmount={fmt}
        currency="NGN"
        accent="#BA7517"
      />,
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('WAYBILL')
    expect(screen.queryByText('DELIVERY NOTE')).not.toBeInTheDocument()
  })
})
