/**
 * The page renderer (§I).
 *
 * It knows nothing about document types — every per-type decision was made in
 * composeDocument — so these tests check that the model reaches the page
 * faithfully, especially the parts §V says must NOT appear.
 */

import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

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

/**
 * EVERY DESIGN PRINTS A PAGE THAT HAS SOMETHING ON IT (§H, §I).
 *
 * A design was found rendering an entirely blank sheet on a device — the
 * saved-document view showed the paper, the caption and the four actions, and
 * nothing in between. The existing guards did not catch it because they assert
 * that the sixteen designs DIFFER from one another, and blank differs from
 * populated perfectly well. Sixteen designs, one of them empty, and every test
 * green.
 *
 * "Different" is the wrong question. These ask the only one that matters to
 * somebody sending an invoice: is the business name on it, is the title on it,
 * is the customer on it, are the goods on it.
 *
 * Four document types as well as sixteen designs, because a header style that
 * works for an invoice can still lose the goods table on a waybill — waybills
 * carry no prices, and the row shape differs.
 */
describe('Every design renders a populated page, for every type (§H)', () => {
  const documents: readonly [string, ComposableDocument][] = [
    ['invoice', invoice],
    ['waybill', delivery],
    ['quotation', { ...invoice, type: 'quotation', reference: 'QUO-0001' }],
    ['receipt', { ...invoice, type: 'receipt', reference: 'REC-0001' }],
  ]

  const cases = TEMPLATES.flatMap((template) =>
    documents.map(([name, document]) => [template.id, name, document] as const),
  )

  it.each(cases)('%s prints a populated %s', (templateId, _name, document) => {
    cleanup()
    const { render: paint } = draw(document, templateId)
    paint()

    const article = screen.getByRole('article')

    /*
     * The ACTUAL defect: a sheet with nothing on it. Measured as visible text,
     * because that is what a person looking at the page sees — an element tree
     * that exists but renders no words is the bug, not the absence of nodes.
     */
    const text = (article.textContent ?? '').replace(/\s+/g, ' ').trim()
    expect(text.length, `${templateId} printed a blank ${_name}`).toBeGreaterThan(40)

    // The four things that make it that document rather than a sheet of paper.
    expect(text, `${templateId}/${_name}: no business name`).toContain('Dynamic Renaissance')
    expect(text, `${templateId}/${_name}: no reference`).toContain(document.reference)
    expect(text, `${templateId}/${_name}: no customer`).toContain('Okoro & Sons')
    expect(text, `${templateId}/${_name}: no goods`).toContain('Cement')
  })

  /**
   * And the page is not merely populated but VISIBLE. A design that renders
   * its content in white on white, or collapses it to nothing, is blank to a
   * reader while passing every assertion above.
   */
  it.each(TEMPLATES.map((t) => [t.id] as const))('%s does not print ink on its own paper', (id) => {
    const template = templateById(id)
    expect(template.ink.toLowerCase(), `${id}: ink equals paper`).not.toBe(
      template.paper.toLowerCase(),
    )
  })
})

/**
 * NO DOCUMENT EVER PRINTS A MACHINE'S TIMESTAMP (§D, §I, §S).
 *
 * A quotation went to a customer reading `Issue Date: 2026-09-04T00:00:00.000Z`.
 * Nothing stood between the stored value and the page. The fix is one line in
 * `compose`, which is the single place every type and every design passes
 * through — and this is the assertion that keeps it that way, swept across all
 * sixteen designs and all four types, because a date that leaks on one of them
 * would leak on the rest.
 */
describe('Dates print as dates, on every design and every type (§D)', () => {
  const dated: readonly [string, ComposableDocument][] = [
    ['invoice', { ...invoice, issueDate: '2026-09-04T00:00:00.000Z', dueDate: '2026-09-25T00:00:00.000Z' }],
    ['waybill', { ...delivery, issueDate: '2026-09-04T00:00:00.000Z' }],
    ['quotation', { ...invoice, type: 'quotation', reference: 'QUO-0001', issueDate: '2026-09-04T00:00:00.000Z' }],
    ['receipt', { ...invoice, type: 'receipt', reference: 'REC-0001', issueDate: '2026-09-04T00:00:00.000Z' }],
  ]

  const cases = TEMPLATES.flatMap((template) =>
    dated.map(([name, document]) => [template.id, name, document] as const),
  )

  it.each(cases)('%s prints no timestamp on a %s', (templateId, _name, document) => {
    cleanup()
    const { render: paint } = draw(document, templateId)
    paint()
    const text = screen.getByRole('article').textContent ?? ''

    expect(text, `${templateId}/${_name} printed a raw timestamp`).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(text, `${templateId}/${_name} printed a UTC marker`).not.toMatch(/\d{2}:\d{2}:\d{2}/)
    // And the date is actually there, readable — not simply removed.
    expect(text, `${templateId}/${_name} lost its issue date`).toContain('4 Sep 2026')
  })
})

/**
 * THE FOOTER STRIP — how a customer reaches the business (§I).
 *
 * Every document the app produced ended in white space. The legacy documents
 * carried phone · email · website centred under a hairline, and on a quotation
 * that is the one thing the recipient needs: somebody who wants to accept it
 * otherwise has no way to say so.
 */
describe('Every document says how to reach the business (§I)', () => {
  const contact = {
    phone: '+2348106332490',
    email: 'admin@dynamicrenaissance.org',
    website: 'www.dynamicrenaissance.org',
  }

  const withContact = (over: Partial<typeof contact> = contact) => ({
    ...opts,
    branding: { ...branding, ...over },
  })

  it.each(TEMPLATES.map((t) => [t.id] as const))('%s prints all three', (id) => {
    cleanup()
    draw(invoice, id, 20, withContact()).render()
    const text = (screen.getByRole('article').textContent ?? '').replace(/\s+/g, ' ')

    expect(text, `${id}: no phone`).toContain(contact.phone)
    expect(text, `${id}: no email`).toContain(contact.email)
    expect(text, `${id}: no website`).toContain(contact.website)
  })

  it.each([
    ['invoice', invoice],
    ['waybill', delivery],
    ['quotation', { ...invoice, type: 'quotation' as const, reference: 'QUO-1' }],
    ['receipt', { ...invoice, type: 'receipt' as const, reference: 'REC-1' }],
  ])('prints on a %s as well', (_name, document) => {
    cleanup()
    draw(document as ComposableDocument, 'classic', 20, withContact()).render()
    expect(screen.getByRole('article').textContent ?? '').toContain(contact.phone)
  })

  /**
   * SEPARATORS BETWEEN, NEVER AROUND. A business with only a phone number
   * must print the number, not "· +234… ·" — a stranded separator announces
   * a field the owner chose not to fill.
   */
  it('prints one value with no separators around it', () => {
    cleanup()
    draw(invoice, 'classic', 20, withContact({ phone: '+2348106332490' })).render()
    const text = (screen.getByRole('article').textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain('+2348106332490')
    expect(text).not.toMatch(/·\s*·/)
    expect(text.trim()).not.toMatch(/·\s*$/)
  })

  /**
   * NOTHING AT ALL WHEN THERE IS NOTHING. No strip, and no hairline either —
   * an empty band with a rule over it announces that something is missing.
   */
  it('draws no strip and no rule when none of the three are set', () => {
    cleanup()
    const { container } = draw(invoice, 'classic', 20, { ...opts, branding }).render()

    /*
     * The ELEMENT, not the text. An empty strip renders no words, so a text
     * assertion passes over it while the hairline is still drawn across the
     * foot of the page announcing a section that is not there — the mutation
     * went green on exactly that before this line.
     */
    expect(container.querySelector('[data-contact-strip]')).toBeNull()
  })

  it('draws the strip element when there is something to put in it', () => {
    cleanup()
    const { container } = draw(invoice, 'classic', 20, withContact()).render()
    expect(container.querySelector('[data-contact-strip]')).not.toBeNull()
  })

  /**
   * ON THE LAST PAGE ONLY. Repeated under page one of four, a footer reads as
   * the end of the document — four times.
   */
  it('appears on the final page and not on the ones before it', () => {
    cleanup()
    const many = {
      ...invoice,
      lineItems: Array.from({ length: 40 }, (_, index) => ({
        id: `l${index}`,
        description: `Item ${index}`,
        quantityMilli: quantity(1),
        unitPriceMinor: 1000,
        taxable: false,
      })),
    }
    const sheet = draw(many, 'classic', 12, withContact())
    expect(sheet.pages.length).toBeGreaterThan(1)

    sheet.render(0)
    expect(screen.getByRole('article').textContent ?? '').not.toContain(contact.phone)

    cleanup()
    const last = draw(many, 'classic', 12, withContact())
    last.render(last.pages.length - 1)
    expect(screen.getByRole('article').textContent ?? '').toContain(contact.phone)
  })
})

/**
 * EVERY FIGURE HAS A WORD BESIDE IT (§I).
 *
 * The totals block rendered `<Line label="" …>` for subtotal, tax and
 * withholding, and `totalsLabelFor` returned null for everything but a
 * quotation — so an invoice printed a right-aligned column of amounts with
 * nothing saying which was which, and the grand total was a bare figure
 * directly under them. A customer reading three numbers has to guess, and
 * where there is withholding the guess is about money they are owed.
 */
describe('No amount prints without the word for it (§I)', () => {
  const taxed: ComposableDocument = { ...invoice, taxRate: 75_000, whtRate: 50_000 }

  it.each(TEMPLATES.map((t) => [t.id] as const))('%s labels every totals line', (id) => {
    cleanup()
    draw(taxed, id).render()
    const text = (screen.getByRole('article').textContent ?? '').replace(/\s+/g, ' ')

    expect(text, `${id}: no subtotal word`).toContain('Subtotal')
    expect(text, `${id}: no tax word`).toContain('Tax')
    expect(text, `${id}: no withholding word`).toContain('Less withholding tax')
    expect(text, `${id}: no word on the grand total`).toContain('Payable')
  })

  it.each([
    ['quotation', 'quotation' as const, 'Estimated total'],
    ['receipt', 'receipt' as const, 'Received'],
    ['invoice', 'invoice' as const, 'Payable'],
  ])('names the grand total on a %s', (_name, type, word) => {
    cleanup()
    draw({ ...invoice, type, reference: 'X-1' }, 'classic').render()
    expect(screen.getByRole('article').textContent ?? '').toContain(word)
  })

  /** A delivery has no money at all — and must not grow a totals word (§V). */
  it('puts no totals word on a delivery', () => {
    cleanup()
    draw(delivery, 'classic').render()
    const text = screen.getByRole('article').textContent ?? ''
    for (const word of ['Subtotal', 'Payable', 'Estimated total']) {
      expect(text, `a delivery printed "${word}"`).not.toContain(word)
    }
  })
})

/**
 * COMPLETE, NOT SPARSE — all sixteen (§I, §H).
 *
 * The reference documents carry, on every design: the headline amount in the
 * header, the business address, a ruled totals stack with its words, a NOTE
 * TO CUSTOMER block, a signature with its caption AND the business it commits,
 * and a footer contact strip. Ours carried almost none of it — the designs
 * differed in their headers and were identical, and sparse, everywhere else.
 *
 * "Different" was never the question. This asks whether each one is a whole
 * document.
 */
describe('Every design renders a COMPLETE document (§I)', () => {
  const full = {
    ...opts,
    branding: {
      ...branding,
      address: 'Lagos Abeokuta Motor Road, Ifo, Ogun State',
      phone: '+2348106332490',
      email: 'admin@dynamicrenaissance.org',
      website: 'www.dynamicrenaissance.org',
    },
    note: 'Thank you for your continued business. Payment is due within 14 days.',
    noteLabel: 'NOTE TO CUSTOMER',
  }

  const taxed: ComposableDocument = { ...invoice, taxRate: 75_000 }

  it.each(TEMPLATES.map((t) => [t.id] as const))('%s carries every block', (id) => {
    cleanup()
    const { container } = draw(taxed, id, 20, full).render()
    const article = screen.getByRole('article')
    const text = (article.textContent ?? '').replace(/\s+/g, ' ')

    // The headline figure, in the header rather than only at the foot.
    expect(container.querySelector('[data-headline]'), `${id}: no headline figure`).not.toBeNull()

    // The business, and where it is.
    expect(
      container.querySelector('[data-business-address]'),
      `${id}: no business address`,
    ).not.toBeNull()

    // The owner's terms.
    expect(container.querySelector('[data-note-block]'), `${id}: no note block`).not.toBeNull()
    expect(text, `${id}: the note did not print`).toContain('due within 14 days')

    // Whose signature it is.
    expect(
      container.querySelector('[data-signer-business]'),
      `${id}: the signature names no business`,
    ).not.toBeNull()

    // How to reach them.
    expect(container.querySelector('[data-contact-strip]'), `${id}: no footer strip`).not.toBeNull()

    // The totals stack, with its words.
    for (const word of ['Subtotal', 'Payable']) {
      expect(text, `${id}: totals missing "${word}"`).toContain(word)
    }
  })

  /** A delivery has no money, so no headline — and still everything else (§V). */
  it.each(TEMPLATES.map((t) => [t.id] as const))('%s gives a delivery no headline', (id) => {
    cleanup()
    const { container } = draw(delivery, id, 20, full).render()
    expect(container.querySelector('[data-headline]'), `${id}: a delivery grew a total`).toBeNull()
    expect(container.querySelector('[data-contact-strip]'), `${id}: no footer`).not.toBeNull()
    expect(container.querySelector('[data-note-block]'), `${id}: no note`).not.toBeNull()
  })
})
