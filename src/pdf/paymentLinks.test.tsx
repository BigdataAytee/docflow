/**
 * HOW TO PAY, with links on it, at one method and at six (§I, §J).
 *
 * §J's list has always named provider methods, and the only one a customer
 * could act on was the bank account: switching PayPal on printed the bare
 * word "PayPal" under "Other payment methods" with no address behind it — a
 * line naming an app and giving nothing to open.
 *
 * The links print as labelled rows now, each under its provider's name, so
 * the customer knows which app this is for. §I's shape is the constraint that
 * makes this hard rather than obvious: the box is inline beside the signature
 * at ≤ 60% width, in an `mt-auto` footer, so it grows UPWARD into the page. A
 * trader with a bank account and six links is a trader whose totals and
 * signature can be pushed off the bottom by a convenience.
 *
 * So the cap is asserted here as DATA — at one, three and six methods, on all
 * sixteen templates — rather than eyeballed in a rendered PDF.
 */

import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { quantity } from '../domain/documents/types'
import { PAYMENT_BOX_MAX_ROWS, type ComposableDocument, composeDocument } from './compose'
import { paginate } from './paginate'
import { TEMPLATES, templateById } from './templates'
import { DocumentPage } from './DocumentPage'
import { printedLine, type SavedPaymentLink } from '../domain/payments/links'
import type { ProviderId } from '../domain/payments/providers'
import { composeOptionsOf, designOf } from '../features/documents/composition'
import { stringsFor } from '../domain/locale/data/strings'
import { methodName } from '../features/payments/methods'

const BANK = {
  bank_name: 'Zenith Bank',
  account_number: '1234567890',
  account_name: 'Dynamic Renaissance',
}

const opts = {
  profile: { locale: 'EN-NG' },
  branding: {
    name: 'Dynamic Renaissance',
    nameStyle: 'classic' as const,
    logoSize: 'M' as const,
    showLogo: false,
  },
  columnLabels: { description: 'Description', quantity: 'Qty', unit: 'Unit', amount: 'Amount' },
  bankValues: BANK,
}

const invoice: ComposableDocument = {
  type: 'invoice',
  status: 'issued',
  currency: 'NGN',
  reference: 'INV-0042',
  issueDate: '2026-09-01',
  lineItems: [
    {
      id: 'l1',
      description: 'Cement',
      quantityMilli: quantity(3),
      unitPriceMinor: 5_000_00,
      taxable: false,
    },
  ],
  party: { name: 'Ade Stores' },
  frozenLabels: null,
}

/** Real saved links, through the one function that turns them into lines. */
const LINKS: readonly SavedPaymentLink[] = (
  [
    ['paypal_me', 'paypal.me/dynamicrenaissance'],
    ['wise', 'wise.com/pay/me/dynamicrenaissance'],
    ['revolut', 'revolut.me/dynamic'],
    ['monzo_me', 'monzo.me/dynamic'],
    ['cash_app', 'cash.app/$dynamic'],
    ['stripe_link', 'buy.stripe.com/aEU5kC1x2'],
  ] as const
).map(([provider, value]) => ({ provider: provider as ProviderId, value }))

const withLinks = (count: number) =>
  composeDocument(invoice, { ...opts, paymentLinks: LINKS.slice(0, count).map(printedLine) })

const drawIt = (count: number, templateId: string) => {
  const model = withLinks(count)
  const pages = paginate(model, { rowsPerPage: 20, footerRowCost: 3 })
  return render(
    <DocumentPage
      model={model}
      template={templateById(templateId)}
      page={pages[pages.length - 1]!}
      totalPages={pages.length}
      formatAmount={(minor: number) =>
        `₦${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`
      }
      currency="NGN"
      accent="#2b3fd6"
    />,
  )
}

describe('A pasted link prints under its provider’s name (§I, §J)', () => {
  /**
   * THE ONE THIS IS FOR. "PayPal" alone told a customer which app and not
   * which account; §J's "everything switched on prints in invoice payment
   * instructions" was being met by a word.
   */
  it('prints the name and the address, not the name alone', () => {
    drawIt(1, 'classic')

    expect(screen.getByText('PayPal')).toBeInTheDocument()
    expect(screen.getByText('paypal.me/dynamicrenaissance')).toBeInTheDocument()
  })

  /** And the bank account still prints as §I's labelled rows beside them. */
  it('keeps the bank account’s own rows', () => {
    drawIt(1, 'classic')

    expect(screen.getByText('Zenith Bank')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('HOW TO PAY')).toBeInTheDocument()
  })

  /**
   * THE SAVED LINE IS THE PRINTED LINE. `printedLine` is the only function
   * that turns a stored link into a rendered one, so this asserts the page
   * carries exactly what it produced — no second rendering to drift (§J).
   */
  it('prints exactly what printedLine produced', () => {
    drawIt(3, 'classic')

    for (const link of LINKS.slice(0, 3)) {
      const line = printedLine(link)
      expect(screen.getByText(line.value), `${line.label} did not print its value`).toBeInTheDocument()
    }
  })
})

describe('The box holds its shape at any number of methods (§I)', () => {
  /**
   * THE CAP, AS DATA. Three bank rows plus six links is nine, and the box is
   * allowed eight — so the overflow is compacted to names rather than
   * dropped, because a method the owner switched on that appears nowhere is
   * the toggle that lies.
   */
  it('compacts past the cap instead of growing without limit', () => {
    const model = withLinks(6)
    const box = model.paymentBox!

    expect(box.rows.length + box.links.length).toBeLessThanOrEqual(PAYMENT_BOX_MAX_ROWS)
    expect(box.otherMethods.length, 'the overflow vanished instead of compacting').toBeGreaterThan(
      0,
    )
  })

  /** Nothing switched on is ever lost — every provider is named somewhere. */
  it('still names every method it could not print in full', () => {
    const box = withLinks(6).paymentBox!
    const named = new Set([...box.links.map((row) => row.label), ...box.otherMethods])

    for (const link of LINKS) {
      expect(named.has(printedLine(link).label), `${link.provider} printed nowhere`).toBe(true)
    }
  })

  /** Below the cap nothing is compacted at all. */
  it('prints every link in full when there is room', () => {
    const box = withLinks(3).paymentBox!
    expect(box.links).toHaveLength(3)
    expect(box.otherMethods).toEqual([])
  })

  /**
   * AND §I'S WIDTH IS NEVER GIVEN UP. "Inline at ≤ ~60% width beside the
   * signature, never a full-width band" — the number of methods must not be
   * what turns the box into one.
   */
  it.each([1, 3, 6])('stays within 60%% of the width at %i methods', (count) => {
    expect(withLinks(count).paymentBox?.maxWidthPercent).toBeLessThanOrEqual(60)
  })

  /**
   * ON ALL SIXTEEN TEMPLATES, because §H's designs are the thing that would
   * quietly disagree: one of them laying the footer out differently is
   * exactly how a box that fits in Classic pushes a signature off the page
   * in Aurora.
   */
  it.each([1, 3, 6])('renders on every template at %i methods', (count) => {
    for (const template of TEMPLATES) {
      const { unmount } = drawIt(count, template.id)

      expect(screen.getByText('HOW TO PAY'), template.name).toBeInTheDocument()
      // The first link always prints in full, whatever the count.
      expect(screen.getByText('PayPal'), template.name).toBeInTheDocument()
      // And the money and the mark are still on the page beside it.
      expect(screen.getByText('AUTHORISED SIGNATURE'), template.name).toBeInTheDocument()
      expect(screen.getAllByText(/₦15,000\.00/).length, template.name).toBeGreaterThan(0)

      unmount()
      cleanup()
    }
  })

  /**
   * AND IT NEVER SPLITS ACROSS A PAGE. The box lives in the footer, which
   * `paginate` puts on the LAST page and nowhere else — so a long invoice
   * with six links has one payment box, on the page the customer finishes on.
   */
  it('prints once, on the last page only', () => {
    const model = withLinks(6)
    const many = {
      ...model,
      rows: Array.from({ length: 45 }, (_, index) => ({
        ...model.rows[0]!,
        description: `Item ${index}`,
      })),
    }
    const pages = paginate(many, { rowsPerPage: 20, footerRowCost: 3 })
    expect(pages.length).toBeGreaterThan(1)

    const withFooter = pages.filter((page) => page.showsFooter)
    expect(withFooter, 'the payment box would print on more than one page').toHaveLength(1)
    expect(pages[pages.length - 1]?.showsFooter).toBe(true)
  })
})

/**
 * A saved link that is switched OFF does not print (§J).
 *
 * The owner's rule: "the on and off determines the ones that shows". Saved
 * and enabled are two different things — a trader keeps a PayPal link without
 * necessarily wanting it on every invoice — and §J says the same of every
 * other method: "each off until added … everything switched on prints in
 * invoice payment instructions".
 *
 * THIS TEST EXISTS BECAUSE ITS MUTATION PASSED. Removing the filter from
 * `composeOptionsOf` left all 365 document tests green: the printing suite
 * was handed an already-filtered list and so could never notice who filtered
 * it. Asserting on the composed OPTIONS is what closes that, because the
 * filter is the thing under test rather than an assumption the fixture bakes
 * in.
 */
describe('Switched off means off the page (§J)', () => {
  const optionsFor = (enabled: readonly string[]) =>
    composeOptionsOf({
      company: {
        id: 'co_1',
        name: 'Dynamic Renaissance',
        localeRegion: 'NG',
        localeLanguage: 'en',
        currency: 'NGN',
        numberingPrefixes: {},
        bankFields: {},
        enabledPaymentMethods: enabled,
        paymentLinks: [
          { provider: 'paystack_page', value: 'paystack.com/pay/dynamic' },
          { provider: 'flutterwave_page', value: 'flutterwave.com/pay/dynamic' },
        ],
      },
      design: designOf(undefined, null),
      strings: stringsFor('en'),
      assets: [],
    })

  it('prints only the links that are switched on', () => {
    const shown = optionsFor(['paystack_page']).paymentLinks ?? []
    expect(shown.map((row) => row.label)).toEqual(['Paystack'])
  })

  it('prints none of them when none is switched on', () => {
    expect(optionsFor([]).paymentLinks ?? []).toEqual([])
  })

  it('prints both when both are', () => {
    const shown = optionsFor(['paystack_page', 'flutterwave_page']).paymentLinks ?? []
    expect(shown.map((row) => row.label)).toEqual(['Paystack', 'Flutterwave'])
  })

  /** And the value that prints is the one that was saved (§J). */
  it('carries the saved value through unchanged', () => {
    const shown = optionsFor(['paystack_page']).paymentLinks ?? []
    expect(shown[0]?.value).toBe('paystack.com/pay/dynamic')
  })
})

/**
 * A provider id never reaches a customer (Rule #4, §I).
 *
 * FOUND ON THE PHONE. A pasted link's provider id lives in
 * `enabledPaymentMethods` like any other method, so it flowed into §I's
 * "Other payment methods" list — and printed there raw. The invoice read:
 *
 *     HOW TO PAY
 *     Paystack        paystack.com/pay/dynamic-renaissance
 *     ----------------------------------------
 *     OTHER PAYMENT METHODS
 *     paystack_page
 *
 * Two failures in three lines: a database token on a piece of paper, which
 * is the exact bug `bank_transfer` was fixed for once already, and the same
 * method named twice with the second naming saying less than the first.
 */
describe('No token, and nothing said twice (Rule #4, §I)', () => {
  const boxFor = (enabled: readonly string[]) =>
    composeOptionsOf({
      company: {
        id: 'co_1',
        name: 'Dynamic Renaissance',
        localeRegion: 'NG',
        localeLanguage: 'en',
        currency: 'NGN',
        numberingPrefixes: {},
        bankFields: {},
        enabledPaymentMethods: enabled,
        paymentLinks: [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }],
      },
      design: designOf(undefined, null),
      strings: stringsFor('en'),
      assets: [],
    })

  it('never prints a provider id', () => {
    const others = boxFor(['paystack_page']).otherPaymentMethods ?? []
    expect(others, 'a database token reached the printed page').not.toContain('paystack_page')
  })

  it('does not name a link again under the divider', () => {
    expect(
      boxFor(['paystack_page']).otherPaymentMethods ?? [],
      'the link has its own row and was named a second time',
    ).toEqual([])
  })

  /** A method with no row of its own still prints there, in words. */
  it('still names cash on delivery, and in words', () => {
    const others = boxFor(['paystack_page', 'cash_on_delivery']).otherPaymentMethods ?? []
    expect(others).toEqual(['Cash on delivery'])
  })

  /**
   * AND THE FALLBACK IS A NAME. Even reached directly — a stale enabled id
   * with no link behind it — a provider resolves to what a customer would
   * recognise rather than to the token a database stores.
   */
  it('resolves a provider id to its name wherever it is asked', () => {
    expect(methodName(stringsFor('en'), 'paystack_page')).toBe('Paystack')
    expect(methodName(stringsFor('en'), 'paypal_me')).toBe('PayPal')
    // And something nobody has heard of still prints rather than vanishing.
    expect(methodName(stringsFor('en'), 'pos_terminal')).toBe('pos_terminal')
  })
})

/**
 * The printed page carries names, never marks (§I, and a decision).
 *
 * The Settings list shows each provider's logo; the invoice does not, and
 * that is deliberate rather than unfinished. A customer-facing document is
 * closer to public use of a trademark than a private settings screen — it
 * gets forwarded, printed and filed — and each provider's guidelines set
 * conditions on size, clear space and colour that need checking one by one
 * before their mark goes on one. Recorded in PLAN.md as pending a
 * per-provider guidelines review.
 *
 * Asserted rather than assumed, because "we did not add it" is not a
 * property: somebody reusing the settings row on a page would be an easy
 * afternoon's work and nothing here would notice.
 */
describe('No mark reaches a printed document (§I)', () => {
  it.each([1, 3, 6])('prints %i methods with no image at all', (count) => {
    for (const template of TEMPLATES) {
      const { unmount } = drawIt(count, template.id)

      // The names are there …
      expect(screen.getByText('PayPal'), template.name).toBeInTheDocument()
      // … and nothing draws a mark beside them.
      expect(
        document.querySelectorAll('[data-provider-logo]').length,
        `${template.name} drew a provider mark on the page`,
      ).toBe(0)

      unmount()
      cleanup()
    }
  })

  /** Nor any image at all in the payment box, whatever it came from. */
  it('renders no image inside HOW TO PAY', () => {
    drawIt(3, 'classic')

    const heading = screen.getByText('HOW TO PAY')
    const box = heading.parentElement!
    expect(box.querySelectorAll('img').length, 'the payment box drew an image').toBe(0)
  })
})
