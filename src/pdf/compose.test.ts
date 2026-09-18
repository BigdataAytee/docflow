/**
 * §I composition, and the §V clauses it exists to make structural.
 *
 * These test the MODEL rather than pixels: a delivery document has no totals
 * and no payment box by construction, so no template can render money onto
 * one however it is styled.
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES, type DocumentType, quantity } from '../domain/documents/types'
import { money } from '../domain/money/money'
import { freezeLabels } from '../domain/locale/profile'
import { type ComposableDocument, type ComposeOptions, composeDocument } from './compose'
import { REQUIRED_FONT_FAMILIES, TEMPLATES, UnknownTemplateError, templateById } from './templates'

const branding = {
  name: 'Dynamic Renaissance Business Enterprises Ltd',
  nameStyle: 'classic' as const,
  logoSize: 'M' as const,
  showLogo: true,
}

const options = (over: Partial<ComposeOptions> = {}): ComposeOptions => ({
  profile: { locale: 'EN-NG' },
  branding,
  columnLabels: { description: 'Description', quantity: 'Qty', unit: 'Unit', amount: 'Amount' },
  bankValues: {
    bank_name: 'Guaranty Trust Bank',
    account_number: '0123456789',
    account_name: 'Dynamic Renaissance Business Enterprises Ltd',
  },
  ...over,
})

const doc = (type: DocumentType, over: Partial<ComposableDocument> = {}): ComposableDocument => ({
  type,
  status: 'issued',
  currency: 'NGN',
  reference: 'INV-0001',
  issueDate: '2026-09-11',
  party: { name: 'Okoro & Sons', address: '12 Balogun St' },
  frozenLabels: null,
  lineItems: [
    { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
  ],
  ...over,
})

describe('A delivery document carries no money, under any design (§I, §V)', () => {
  const delivery = doc('waybill', {
    reference: 'WAY-0001',
    lineItems: [
      { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unit: 'cartons', taxable: false },
    ],
  })

  it('has no totals block at all', () => {
    const page = composeDocument(delivery, options())
    expect(page.totals).toBeNull()
    expect(page.totalsLabel).toBeNull()
  })

  it('has no payment box', () => {
    expect(composeDocument(delivery, options()).paymentBox).toBeNull()
  })

  /*
   * CHANGED DELIBERATELY. This asserted a delivery carried a UNIT column, per
   * §I's "deliveries swap amount for unit". The owner has decided against it
   * having used it: a waybill is description and quantity. The money half of
   * §I — which is the half that matters, and the one §V gates on — is
   * unchanged and still asserted here.
   */
  it('carries description and quantity only, and no money column (§I, §V)', () => {
    const page = composeDocument(delivery, options())
    const keys = page.columns.map((c) => c.key)
    expect(keys).toEqual(['description', 'quantity'])
    expect(keys).not.toContain('amount')
    expect(keys).not.toContain('unit')
    expect(page.rows.every((r) => r.amount === undefined)).toBe(true)
  })

  /**
   * The column existed and NOTHING EVER FILLED IT.
   *
   * The case above asserted the header — `unit` among the column keys — and
   * the rows were built without one, so every printed waybill carried a UNIT
   * column with empty cells under it. Asserting a header is not asserting a
   * table: "10" against "10 cartons" is the difference between a document
   * somebody can sign for and a number.
   */
  it('puts the unit in the row, not only in the header', () => {
    const page = composeDocument(delivery, options())
    expect(page.rows[0]?.unit).toBe('cartons')
  })

  it('replaces the payment box with the localised received-by block (§I)', () => {
    expect(composeDocument(delivery, options()).receivedBy?.caption).toBe('RECEIVED BY')
    expect(
      composeDocument(delivery, options({ profile: { locale: 'FR' } })).receivedBy?.caption,
    ).toBe('REÇU PAR')
  })

  /**
   * THE ONE THIS WHOLE BLOCK EXISTS FOR.
   *
   * The customer's drawn mark went into `signatureAssetId` — the BUSINESS's
   * signature — so a signed delivery printed the customer's hand under
   * "DISPATCHED BY" with the business's name beneath it, and the "RECEIVED
   * BY" block they had actually signed stayed empty. It also destroyed the
   * business's own mark on that document, because the two were one field.
   *
   * On top of that, `composition.ts` never forwarded `signerName`,
   * `signerRole` or `signedAt` to compose at all — so even with a column of
   * its own the block had no facts to fill from. One bug was hiding the
   * other: the page LOOKED signed because the wrong mark was in the right
   * place on the wrong side.
   */
  it('fills the recipient block from the recipient’s own fields', () => {
    const signed = doc('waybill', {
      reference: 'WAY-0002',
      lineItems: [
        { id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false },
      ],
      signerSignatureAssetId: 'ast_recipient',
      signerName: 'Bisi Adeyemi',
      signerRole: 'Storekeeper',
      signedAt: '2026-09-14T14:30:00Z',
      signatureAssetId: 'ast_business',
    })
    const page = composeDocument(
      signed,
      options({ assetUrls: { ast_recipient: 'data:recipient', ast_business: 'data:business' } }),
    )

    expect(page.receivedBy?.markUrl, 'the recipient’s mark did not reach the page').toBe(
      'data:recipient',
    )
    expect(page.receivedBy?.name).toBe('Bisi Adeyemi')
    expect(page.receivedBy?.role).toBe('Storekeeper')
    // Formatted, never the raw stamp — the same rule every other date obeys.
    expect(page.receivedBy?.signedOn).not.toContain('T14:30')

    /*
     * AND THE TWO MARKS DO NOT SWAP. The sender's block keeps the business's
     * signature and the business's name; the recipient's name appears in
     * neither of those places.
     */
    expect(page.signature.imageUrl, 'the sender’s mark was replaced').toBe('data:business')
    expect(page.signature.signerName, 'the recipient’s name is on the sender’s block').toBeUndefined()
  })

  /**
   * An unsigned delivery still draws the caption and the rule, because that
   * is what somebody puts their hand ON. What it must not do is claim
   * anything: no mark, no name, no date until there is one.
   */
  it('leaves the recipient block empty until somebody signs', () => {
    const block = composeDocument(delivery, options()).receivedBy
    expect(block?.caption).toBe('RECEIVED BY')
    expect(block?.markUrl).toBeUndefined()
    expect(block?.name).toBeUndefined()
    expect(block?.signedOn).toBeUndefined()
  })

  it('stays money-free for every template, since templates are style only', () => {
    for (const template of TEMPLATES) {
      const page = composeDocument(delivery, options())
      expect(page.totals, template.id).toBeNull()
      expect(page.paymentBox, template.id).toBeNull()
    }
  })
})

describe('The payment box (§I, §J)', () => {
  it('prints NGN as exactly bank / account number / account name', () => {
    const page = composeDocument(doc('invoice'), options())
    expect(page.paymentBox?.rows.map((r) => r.label)).toEqual([
      'Bank',
      'Account number',
      'Account name',
    ])
    expect(page.paymentBox?.heading).toBe('HOW TO PAY')
  })

  it('stays inline at no more than 60% width, never a full-width band (§I)', () => {
    expect(composeDocument(doc('invoice'), options()).paymentBox?.maxWidthPercent).toBeLessThanOrEqual(60)
  })

  it('omits a field the user has not filled rather than printing an empty row', () => {
    const page = composeDocument(
      doc('invoice'),
      options({ bankValues: { bank_name: 'GTB', account_name: 'Ltd' } }),
    )
    expect(page.paymentBox?.rows.map((r) => r.label)).toEqual(['Bank', 'Account name'])
  })

  it('omits payment instructions from a quotation by default (§I)', () => {
    expect(composeDocument(doc('quotation'), options()).paymentBox).toBeNull()
  })

  it('never tells a receipt holder to pay again (§I)', () => {
    const receipt = doc('receipt', {
      paidAmount: money('NGN', 50_000_00),
      paidAt: '2026-09-11',
      paidMethod: 'Bank transfer',
    })
    const page = composeDocument(receipt, options())
    expect(page.paymentBox).toBeNull()
    // Its own heading and labels, resolved at compose time like every other
    // printed word — the page renders a model and never reaches for the
    // locale layer itself (Rule #4).
    expect(page.receiptEvidence).toMatchObject({
      amount: money('NGN', 50_000_00),
      // FORMATTED, like every other date on the page. The date that makes a
      // receipt a receipt was printing as the stored value while the issue
      // and due dates went through the formatter.
      paidAt: '11 Sep 2026',
      method: 'Bank transfer',
    })
    expect(page.receiptEvidence?.heading).toBe('Payment received')
  })
})

describe('Titles and labels come from the terminology layer (Rule #5, §D)', () => {
  it('prints the regional title for a delivery document', () => {
    expect(composeDocument(doc('waybill'), options()).title).toBe('WAYBILL')
    expect(
      composeDocument(doc('waybill'), options({ profile: { locale: 'EN-GB' } })).title,
    ).toBe('DELIVERY NOTE')
  })

  it('says the localised estimated total on a quotation (§H)', () => {
    expect(composeDocument(doc('quotation'), options()).totalsLabel).toBe('Estimated total')
    expect(
      composeDocument(doc('quotation'), options({ profile: { locale: 'FR' } })).totalsLabel,
    ).toBe('Total estimé')
  })

  it('prints which offer this one replaces (§G)', () => {
    // The reference alone cannot say so: every document earns its own (§M),
    // so QUO-0014 looks unrelated to the QUO-0009 the customer holds.
    const model = composeDocument(
      { ...doc('quotation'), replaces: { reference: 'QUO-0009', revisionNumber: 2 } },
      {
        ...options(),
        replacesLabel: (r) =>
          r.revisionNumber === undefined
            ? `Replaces ${r.reference}`
            : `Rev ${r.revisionNumber} · replaces ${r.reference}`,
      },
    )
    expect(model.replacesLine).toBe('Rev 2 · replaces QUO-0009')
  })

  it('prints no revision line on a first offer', () => {
    expect(composeDocument(doc('quotation'), options()).replacesLine).toBeNull()
  })

  it('prints what a reissued receipt replaces, with no revision number (§V)', () => {
    // Two receipts for one payment, neither mentioning the other, is how a
    // payment gets read as two.
    const model = composeDocument(
      { ...doc('receipt'), replaces: { reference: 'REC-0003' } },
      { ...options(), replacesLabel: (r) => `Replaces ${r.reference}` },
    )
    expect(model.replacesLine).toBe('Replaces REC-0003')
  })

  it('prints no revision line when nothing was given words for it', () => {
    // The words live in the catalogue (§S); this module holds none, so
    // without a labeller there is nothing true to print.
    const model = composeDocument(
      { ...doc('quotation'), replaces: { reference: 'QUO-0009', revisionNumber: 2 } },
      options(),
    )
    expect(model.replacesLine).toBeNull()
  })

  it('prints the actual signature when the asset is to hand (§I)', () => {
    const model = composeDocument(
      { ...doc('invoice'), signatureAssetId: 'ast_1' },
      { ...options(), assetUrls: { ast_1: 'data:image/svg+xml,%3Csvg%2F%3E' } },
    )
    expect(model.signature.imageUrl).toBe('data:image/svg+xml,%3Csvg%2F%3E')
  })

  it('prints no stand-in mark when the asset is not to hand (§I)', () => {
    // §I allows placeholders only in clearly-labelled samples. A real page
    // prints the rule and the caption with nothing above them.
    const model = composeDocument({ ...doc('invoice'), signatureAssetId: 'ast_gone' }, options())
    expect(model.signature.assetId).toBe('ast_gone')
    expect(model.signature.imageUrl).toBeUndefined()
  })

  it('prints nothing above the rule on a document nobody signed', () => {
    expect(composeDocument(doc('invoice'), options()).signature.imageUrl).toBeUndefined()
  })

  it('uses the per-type signature caption', () => {
    expect(composeDocument(doc('invoice'), options()).signature.caption).toBe('AUTHORISED SIGNATURE')
    expect(composeDocument(doc('waybill'), options()).signature.caption).toBe('DISPATCHED BY')
  })
})

describe('An issued document keeps its frozen labels and language (§D.2, §M, §V)', () => {
  it('ignores a later region change entirely', () => {
    const frozen = freezeLabels({ locale: 'EN-NG' }, 'waybill')
    const issued = doc('waybill', { frozenLabels: frozen })

    // The company has since moved to EN-GB. The issued PDF must not follow.
    const page = composeDocument(issued, options({ profile: { locale: 'EN-GB' } }))
    expect(page.title).toBe('WAYBILL')
    expect(page.partyLabel).toBe(frozen.partyLabel)
    expect(page.signature.caption).toBe(frozen.signatureCaption)
    expect(page.language).toBe('en')
  })

  it('keeps a French document French after a move to Spain', () => {
    const frozen = freezeLabels({ locale: 'FR' }, 'invoice')
    const page = composeDocument(
      doc('invoice', { frozenLabels: frozen }),
      options({ profile: { locale: 'ES' } }),
    )
    expect(page.title).toBe('FACTURE')
    expect(page.language).toBe('fr')
  })

  it('lets a draft follow the live profile', () => {
    const page = composeDocument(doc('waybill', { frozenLabels: null }), options({ profile: { locale: 'EN-US' } }))
    expect(page.title).toBe('PACKING SLIP')
  })
})

describe('The sixteen designs (§H)', () => {
  it('ships exactly sixteen', () => {
    expect(TEMPLATES).toHaveLength(16)
  })

  it('has ten original and six new', () => {
    expect(TEMPLATES.filter((t) => !t.isNew)).toHaveLength(10)
    expect(TEMPLATES.filter((t) => t.isNew)).toHaveLength(6)
  })

  it('carries the §H names, Bloom and Aria included and Noir absent', () => {
    const names = TEMPLATES.map((t) => t.name)
    for (const expected of [
      'Classic', 'Modern', 'Minimal', 'Bold', 'Elegant', 'Sidebar', 'Executive',
      'Wave', 'Compact', 'Sikky', 'Aurora', 'Ledger', 'Botanic', 'Prism', 'Bloom', 'Aria',
    ]) {
      expect(names).toContain(expected)
    }
    // §H: "A Noir design was built and removed".
    expect(names).not.toContain('Noir')
  })

  it('gives every design a unique id and name', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(16)
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(16)
  })

  it('declares no font outside the bundled audit (§F)', () => {
    for (const template of TEMPLATES) {
      expect(REQUIRED_FONT_FAMILIES, template.name).toContain(template.fontFamily)
    }
  })

  it('refuses an unknown design rather than falling back silently', () => {
    // A silent fallback would change how an already-issued PDF looks.
    expect(() => templateById('noir')).toThrow(UnknownTemplateError)
  })
})

describe('Composition holds for every type', () => {
  it('gives money types a totals block and the delivery type none', () => {
    for (const type of DOCUMENT_TYPES) {
      const page = composeDocument(doc(type, type === 'waybill'
        ? { lineItems: [{ id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false }] }
        : {}), options())
      expect(page.totals === null, type).toBe(type === 'waybill')
      expect(page.totalsWidthPercent).toBe(58)
    }
  })
})
