/**
 * The five things walking the phone found (§G, §I, §N, Rule #1).
 *
 * Every one of these had green tests over it. They are here as a set because
 * the set is the lesson: each was invisible to the suite for a different
 * reason, and the reasons are worth keeping written down.
 *
 *  · The unmount commit — the route test clicked Next before asserting, and
 *    Next is the one gesture that saved. The walk took the catalogue link
 *    instead, which is one tap from the rows it discarded.
 *  · The printed method id — no test ever read the METHOD row of a receipt,
 *    only that it was present.
 *  · The bottom inset — jsdom has no system navigation bar, so a control
 *    underneath one is a control that passes every test ever written for it.
 *  · `capture` — an attribute that changes which app opens, which nothing in
 *    a test runner opens.
 *  · The payment nag on a receipt — asserted as "the card appears when no
 *    method is set up", which was true and wrong.
 */

import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories } from '../data/repositories'
import type { MemoryState } from '../data/repositories'
import { money } from '../domain/money/money'
import { stringsFor } from '../domain/locale/data/strings'
import { composeOptionsOf, designOf } from '../features/documents/composition'

const NGN = (minor: number) => money('NGN', minor)

const seeded = (over?: (state: MemoryState) => void) => {
  const state = devState()
  // §R sends a nameless company to the welcome screen, so a fixture that
  // leaves the name empty asks for the welcome and then asserts about Home.
  const company = state.companies[0]
  if (company !== undefined) state.companies[0] = { ...company, name: 'Sola Ventures' }
  over?.(state)
  return { state, repositories: createMemoryRepositories(state) }
}

const renderAt = (path: string, over?: (state: MemoryState) => void) => {
  const { state, repositories } = seeded(over)
  render(
    <App repositories={repositories} companyId={DEV_COMPANY_ID} router="memory" initialPath={path} />,
  )
  return state
}

const customer = (id = 'cus_1', name = 'Ade Stores') => ({
  id,
  companyId: DEV_COMPANY_ID,
  kind: 'company' as const,
  name,
  labels: [],
})

const draftInvoice = (state: MemoryState) => {
  state.customers.push(customer())
  state.documents.push({
    id: 'doc_draft',
    companyId: DEV_COMPANY_ID,
    type: 'invoice',
    status: 'draft',
    customerId: 'cus_1',
    currency: 'NGN',
    lineItems: [
      {
        id: 'li_1',
        description: 'Roofing sheets',
        quantityMilli: 1_000,
        unitPriceMinor: 145_000_00,
        taxable: true,
      },
    ],
    issueDate: '2026-09-01',
    issuedReference: null,
    frozenLabels: null,
    totalMinor: 145_000_00,
  })
}

describe('Leaving the builder saves what is on screen (§G, Rule #1)', () => {
  /**
   * THE ONE THIS IS FOR, and it was found by eye rather than by test.
   *
   * Autosave fired on STEP CHANGE and nowhere else. The Items step carries a
   * catalogue link in its own header, so the shortest route out of that screen
   * was also the one that threw the screen away — a photograph attached to a
   * line, visible on the row, gone from the printed page after a trip to Saved
   * items and back.
   *
   * The gesture below is that trip. It asserts on the RECORD, because the
   * screen's own state proving itself is what let this survive.
   */
  it('commits an item edit when the screen is left by a route that is not the step bar', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_draft', draftInvoice)

    await user.click(await screen.findByRole('button', { name: 'Items' }))
    await user.type(await screen.findByPlaceholderText(/Type an item/), 'Cement, 20 bags')
    await user.type(screen.getByLabelText('Unit price'), '7800')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Out through the catalogue link — no step change, no Save, no Close.
    await user.click(screen.getByRole('button', { name: 'Saved items' }))
    await screen.findByText('Saved items')

    await waitFor(() =>
      expect(
        state.documents[0]?.lineItems.map((line) => line.description),
        'the typed line was thrown away on the way out',
      ).toContain('Cement, 20 bags'),
    )
  })

  /** And an untouched document writes nothing on the way out. */
  it('writes nothing when the draft was never touched', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_draft', draftInvoice)
    const before = state.documents[0]

    await user.click(await screen.findByRole('button', { name: 'Items' }))
    await user.click(screen.getByRole('button', { name: 'Saved items' }))
    await screen.findByText('Saved items')

    expect(state.documents[0]).toBe(before)
  })

  /**
   * AND EXACTLY ONCE UNDER StrictMode, which mounts, unmounts and remounts.
   * A cleanup that committed on the first of those would write a draft the
   * person had not finished, from a screen that was about to come back.
   */
  it('does not commit on StrictMode’s throwaway mount', async () => {
    const { state, repositories } = seeded(draftInvoice)
    render(
      <StrictMode>
        <App
          repositories={repositories}
          companyId={DEV_COMPANY_ID}
          router="memory"
          initialPath="/edit/doc_draft"
        />
      </StrictMode>,
    )
    await screen.findByRole('button', { name: 'Items' })
    expect(state.documents[0]?.lineItems).toHaveLength(1)
  })
})

describe('A receipt prints the method in words, not its id (§D, Rule #4)', () => {
  const strings = stringsFor('en')

  /**
   * THE ONE THIS IS FOR. The receipt said `bank_transfer` — the database's
   * word, on a document handed to a customer — while the form that collected
   * it said "Bank transfer" two lines above.
   */
  it('resolves a stored id through the catalogue', () => {
    const options = composeOptionsOf({
      company: null,
      design: designOf(undefined, null),
      strings,
      assets: [],
    })
    expect(options.paymentMethodLabel?.('bank_transfer')).toBe(strings.settings.bankTransfer)
    expect(options.paymentMethodLabel?.('cash_on_delivery')).toBe(strings.settings.cashOnDelivery)
    expect(
      options.paymentMethodLabel?.('bank_transfer'),
      'the page would print the id a database stores',
    ).not.toBe('bank_transfer')
  })

  /**
   * A method this build does not know still prints something rather than
   * nothing: an old receipt keeps whatever it was issued with (Rule #5).
   */
  it('falls back to the id rather than printing a blank', () => {
    const options = composeOptionsOf({
      company: null,
      design: designOf(undefined, null),
      strings,
      assets: [],
    })
    expect(options.paymentMethodLabel?.('pos_terminal')).toBe('pos_terminal')
  })
})

describe('A receipt asks for no payment setup (§I, §J, §N)', () => {
  const paidReceipt = (state: MemoryState) => {
    state.customers.push(customer())
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(18_500_00),
      paidAt: '2026-09-18T09:00:00Z',
      method: 'cash_on_delivery',
      source: 'manual',
      allocations: [],
    })
    state.documents.push({
      id: 'doc_rec',
      companyId: DEV_COMPANY_ID,
      type: 'receipt',
      status: 'draft',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Payment received',
          quantityMilli: 1_000,
          unitPriceMinor: 18_500_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-18',
      issuedReference: null,
      frozenLabels: null,
      paymentId: 'pay_1',
      totalMinor: 18_500_00,
    })
  }

  /**
   * A receipt prints no payment box — it is evidence the money arrived — so an
   * amber "Set up payment" on one asked the owner to fix something that
   * document will never show.
   */
  it('shows no payment card on a receipt', async () => {
    renderAt('/edit/doc_rec', paidReceipt)
    await screen.findByText('Draft saved automatically')
    expect(screen.queryByRole('button', { name: 'Set up payment' })).toBeNull()
    expect(screen.queryByText('Currency & payment')).toBeNull()
  })

  /** And still shows it where a payment box does print. */
  it('still shows it on an invoice', async () => {
    renderAt('/edit/doc_draft', draftInvoice)
    expect(await screen.findByRole('button', { name: 'Set up payment' })).toBeInTheDocument()
  })
})

describe('The last control on a page is not under the system bar (§G)', () => {
  /**
   * jsdom has no navigation bar, so this asserts the PADDING rather than the
   * tap — the thing that was missing. Walking it, the first tap on "Record
   * payment" did nothing: the page could not scroll any further and the lower
   * third of the button sat under Android's own buttons.
   */
  it('pads the receipt flow against the bottom inset', async () => {
    renderAt('/new/receipt', (state) => {
      state.customers.push(customer())
    })
    const page = (await screen.findByText('Acknowledge a payment')).closest('div.px-4')
    expect(page?.className, 'the last control can sit under the system bar').toContain(
      'env(safe-area-inset-bottom)',
    )
  })
})

describe('A line photo can come from the camera OR the gallery (§G)', () => {
  afterEach(() => vi.restoreAllMocks())

  /**
   * THIS GUARD WAS WRONG ONCE, AND THAT IS THE LESSON.
   *
   * It used to assert that no file input carried `capture`, under the
   * heading "leave the chooser to the phone". That was true, and it was not
   * the property anybody wanted: absence of an attribute is a claim about
   * OUR markup, and "the phone will offer a choice" is a claim about
   * SOMEBODY ELSE'S software. The second one changed. A WebView file input
   * on this Android now opens the system photo picker, which is the gallery
   * and nothing else — so camera-only became gallery-only, the guard stayed
   * green through both, and the second walk found it by eye like the first.
   *
   * What is asserted now is the thing §G actually asks for: both routes are
   * reachable from the row, whatever any OS decides to do with a bare input.
   */
  const openTheChooser = async (user: ReturnType<typeof userEvent.setup>) => {
    renderAt('/edit/doc_draft', draftInvoice)
    await user.click(await screen.findByRole('button', { name: 'Items' }))
    await user.click(
      await screen.findByRole('button', { name: /Add a photo to Roofing sheets/ }),
    )
  }

  it('offers both, rather than hoping the phone will', async () => {
    const user = userEvent.setup()
    await openTheChooser(user)

    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a picture' })).toBeInTheDocument()
  })

  /**
   * AND EACH ONE GOES WHERE IT SAYS. `capture="environment"` is what opens a
   * viewfinder rather than a picker, so "Take a photo" must have it and
   * "Choose a picture" must not — the two file inputs are the two answers.
   */
  it('wires the camera to capture and the gallery to none', async () => {
    const user = userEvent.setup()
    await openTheChooser(user)

    const inputs = [...document.querySelectorAll('input[type="file"]')]
    const captures = inputs.map((input) => input.getAttribute('capture'))
    expect(captures, 'one route to the camera and one past it').toContain('environment')
    expect(captures).toContain(null)
    for (const input of inputs) expect(input.getAttribute('accept')).toBe('image/*')
  })

  /** And the row is unchanged for somebody who never attaches a photo. */
  it('asks nothing until the photo control is pressed', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_draft', draftInvoice)
    await user.click(await screen.findByRole('button', { name: 'Items' }))
    await screen.findByRole('button', { name: /Add a photo to Roofing sheets/ })

    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull()
  })

  /** A menu with no way out is a trap on a phone; the screen behind it shuts it. */
  it('can be dismissed without choosing', async () => {
    const user = userEvent.setup()
    await openTheChooser(user)

    await user.click(screen.getByRole('button', { name: 'Close the photo choices' }))
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull()
  })
})
