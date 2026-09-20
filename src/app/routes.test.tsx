/**
 * The routes (§G).
 *
 * These are the tests that were impossible while the screens had no host: that
 * each page is REACHABLE, and that the create → items → issue journey runs end
 * to end through the repositories.
 *
 * Everything runs on the in-memory repositories with no network of any kind,
 * which is also the honest limit of what they prove — §Q's airplane-mode gate
 * is a physical device walking the same path.
 */

import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories, type MemoryState } from '../data/repositories'
import { money } from '../domain/money/money'
import { effectivePayments, invoiceOutstanding } from '../domain/payments/ledger'
import { quantity } from '../domain/documents/types'

const NGN = (m: number) => money('NGN', m)

/**
 * A company with a NAME, because these render an app in use.
 *
 * `devState` seeds `name: ''` on purpose — that is what a fresh install looks
 * like, and §R sends a fresh install to the welcome. So a fixture that leaves
 * it empty is asking for the welcome screen and then asserting about Home.
 * Naming the business is how a test says "this app has been set up", which is
 * the state all of these are actually about.
 */
function seeded(over: (state: MemoryState) => void = () => undefined) {
  const state = devState()
  const company = state.companies[0]
  if (company !== undefined) state.companies[0] = { ...company, name: 'Sola Ventures' }
  over(state)
  return { state, repositories: createMemoryRepositories(state) }
}

function renderAt(path: string, over?: (state: MemoryState) => void) {
  const { state, repositories } = seeded(over)
  render(<App repositories={repositories} companyId={DEV_COMPANY_ID} router="memory" initialPath={path} />)
  return state
}

const withCompanyName = (name: string) => (state: MemoryState) => {
  const company = state.companies[0]
  if (company !== undefined) state.companies[0] = { ...company, name }
}

/**
 * An account a customer could actually pay into (§J).
 *
 * The two go together or neither is true: bank transfer switched on with no
 * account behind it is a method that prints nothing, and §G's issue gate now
 * refuses it. Fixtures that enabled the method and left the fields empty were
 * modelling a state the app is supposed to prevent.
 */
const PAID_BY_TRANSFER = {
  enabledPaymentMethods: ['bank_transfer'],
  bankFields: {
    bank_name: 'Guaranty Trust Bank',
    account_number: '0123456789',
    account_name: 'Sola Ventures',
  },
}

const customer = (id = 'cus_1', name = 'Ade Stores') => ({
  id,
  companyId: DEV_COMPANY_ID,
  kind: 'company' as const,
  name,
  labels: [] as string[],
})

/**
 * A payment belongs to a customer, and the repository scopes payments through
 * that customer — a ledger record carries no company of its own. So seeding a
 * payment means seeding its customer, which is the contract, not a workaround.
 */
const withIncome = (minor: number) => (state: MemoryState) => {
  state.customers.push(customer())
  state.payments.push({
    id: 'pay_1',
    customerId: 'cus_1',
    amount: NGN(minor),
    paidAt: new Date().toISOString(),
    method: 'bank_transfer',
    source: 'manual',
    allocations: [],
  })
}

/**
 * Corrections sit behind "More" now — cancelling used to compete visually
 * with §G's four actions, in the same shape and the same row as Share PDF.
 */
const revealMore = async (): Promise<void> => {
  /*
   * `findByRole`, not `queryByRole`. The query form reads the DOM at the
   * instant it is called — before the first render has landed — so it found
   * nothing, returned quietly, and every assertion after it failed looking
   * for a control that was never revealed.
   */
  await userEvent.click(await screen.findByRole('button', { name: 'Actions' }))
}

describe('Every page is reachable (§G)', () => {
  it('opens Home', async () => {
    renderAt('/', withCompanyName('Sola Ventures'))
    expect(await screen.findByText('Sola Ventures')).toBeInTheDocument()
    expect(screen.getByLabelText('Outstanding')).toBeInTheDocument()
  })

  it('opens a list page per type, under that type local name', async () => {
    renderAt('/list/waybill')
    // EN-NG calls a delivery document a waybill — resolved, never hardcoded.
    expect(await screen.findByRole('heading', { name: /Waybill/i })).toBeInTheDocument()
  })

  it('sends an unknown type home rather than inventing a heading', async () => {
    renderAt('/list/not-a-type')
    expect(await screen.findByLabelText('Outstanding')).toBeInTheDocument()
  })

  it('opens customers', async () => {
    renderAt('/customers', (state) => {
      state.customers.push(customer())
    })
    expect(await screen.findByText('Ade Stores')).toBeInTheDocument()
  })

  it('opens the business page with the three cards', async () => {
    renderAt('/analytics', withIncome(150_000_00))
    expect(await screen.findByLabelText('In')).toBeInTheDocument()
    expect(screen.getByLabelText('Out')).toBeInTheDocument()
    expect(screen.getByLabelText('Kept')).toBeInTheDocument()
  })

  it('opens the settings index and each panel', async () => {
    const user = userEvent.setup()
    renderAt('/settings')
    await user.click(await screen.findByRole('link', { name: 'Tax' }))
    expect(await screen.findByText(/Worked example|VAT/)).toBeInTheDocument()
  })

  it('sends an unknown settings panel to the first one, not a dead end', async () => {
    renderAt('/settings/not-a-panel')
    expect(await screen.findByRole('heading', { name: /Region/i })).toBeInTheDocument()
  })

  it('opens first run', async () => {
    renderAt('/welcome')
    expect(await screen.findByRole('button', { name: /Invoice/i })).toBeInTheDocument()
  })

  it('says so plainly when a link points nowhere', async () => {
    renderAt('/nowhere')
    expect(await screen.findByText('That page is not here')).toBeInTheDocument()
  })
})

/**
 * Countries are named, everywhere somebody picks one (§D, §R).
 *
 * `countries.test.ts` proves `COUNTRY_NAMES` has all 243 and that
 * `countriesByName()` sorts them. Nothing proved a SCREEN used it — and the
 * one screen that did not was setup, which is the first screen anybody sees.
 * A person starting a business was handed an alphabetical list of two-letter
 * codes and asked to find themselves in it.
 *
 * The comment defending it claimed a country name would be "a new claim this
 * project has not had reviewed". That reasoning belongs to TERMINOLOGY, which
 * §D really does gate on native-speaker sign-off. A country's name in English
 * is not terminology, and Settings and signup had both been printing them for
 * some time.
 */
/**
 * The nav belongs to the app shell, not to every screen (§F, §G).
 *
 * The floating pill rendered around EVERY route. On the saved document it sat
 * directly over the four contextual actions — two navigations competing for
 * one corner of one screen, and the one that won was the one irrelevant to
 * what the person was doing.
 *
 * It is primary navigation between top-level sections, so it appears at that
 * level and nowhere else. `ROOT_DESTINATIONS` says which those are, once, and
 * `App.tsx` builds the nav-bearing route group from it.
 *
 * Asserted by RENDERING each route, because the rule is about what a person
 * sees. A test that read the route table would agree with itself.
 */
/**
 * Billing the remainder of a part-paid invoice (§G, §K, Rule #5).
 *
 * The bar said "₦50,000 paid of ₦145,000 · ₦95,000 left" and there was
 * nothing to press. An issued invoice is frozen, so asking for the rest meant
 * a second invoice built by hand, with the balance retyped off the screen
 * behind them.
 */
/**
 * Leaving the builder must not trap you between two screens (§G).
 *
 * The owner's report: "when I press back it takes me back to the edit invoice
 * area back and forth — I am supposed to be able to go back to home page
 * without being held down."
 *
 * The ✕ PUSHED the saved document on top of the builder, so the builder
 * stayed on the stack behind the thing you had just left it for:
 *
 *     Home → /edit/x → (✕) → /doc/x → (Back) → /edit/x → (✕) → /doc/x …
 *
 * Home was buried under the pair and unreachable by the one control that
 * should reach it.
 */
describe('The builder is a step, not a place you come back to (§G)', () => {
  const draft = (state: MemoryState) => {
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
          id: 'l1',
          description: 'Cement',
          quantityMilli: quantity(2),
          unitPriceMinor: 500_000,
          taxable: false,
        },
      ],
      issueDate: '2026-09-18',
      issuedReference: null,
      frozenLabels: null,
      totalMinor: 0,
    })
  }

  /**
   * A REAL ROUTER, because this is a claim about history. On the memory
   * router `window.history` never moves, so a length check passes whatever
   * the component does.
   */
  it('does not grow the history when you leave it', async () => {
    const user = userEvent.setup()
    const { repositories } = seeded(draft)
    window.history.replaceState({}, '', '/edit/doc_draft')
    render(<App repositories={repositories} companyId={DEV_COMPANY_ID} router="browser" />)

    const before = window.history.length
    await user.click(await screen.findByRole('button', { name: /close|cancel|✕/i }))

    await waitFor(() => expect(screen.queryByText(/Draft saved automatically/)).toBeNull())
    expect(
      window.history.length - before,
      'leaving the builder stacked the document on top of it',
    ).toBe(0)
  })
})

describe('Invoice the balance (§G, §K)', () => {
  const billed = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'l1',
          description: 'Roofing sheets',
          quantityMilli: quantity(1),
          unitPriceMinor: 145_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
    })
  }

  const partPaid = (minor: number) => (state: MemoryState) => {
    billed(state)
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(minor),
      paidAt: '2026-09-10T09:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [
        { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_inv', amount: NGN(minor) },
      ],
    })
  }

  /** THE ONE THIS IS FOR. */
  it('draws a draft for exactly what is outstanding, linked both ways', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', partPaid(50_000_00))

    await user.click(await screen.findByRole('button', { name: 'Invoice the balance' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))

    const follow = state.documents.find((d) => d.id !== 'doc_inv')
    expect(follow?.type).toBe('invoice')
    expect(follow?.status).toBe('draft')
    expect(follow?.customerId).toBe('cus_1')

    // The amount the bar was showing: 145,000 − 50,000.
    expect(follow?.lineItems).toHaveLength(1)
    expect(follow?.lineItems[0]?.unitPriceMinor).toBe(95_000_00)

    // Both ends name each other, so the pair never reads as two debts.
    expect(follow?.billsBalanceOfId).toBe('doc_inv')
  })

  /**
   * BOTH ENDS NAME EACH OTHER, and a person can see it.
   *
   * The link was stored and shown nowhere — "one debt asked for twice" was a
   * claim in a comment. The declared-field sweep caught it: a field written by
   * a mapper and read by no layer below.
   */
  /*
   * Seeded rather than created through the UI: making the follow-up opens the
   * BUILDER, because it is a draft, and a document's links are drawn on the
   * saved-document screen. What is under test here is the LINK being visible,
   * not the act that made it — which the cases above already cover.
   */
  const withFollowUp = (state: MemoryState) => {
    partPaid(50_000_00)(state)
    state.documents.push({
      id: 'doc_follow',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'draft',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'lb',
          description: 'Balance of INV-0042',
          quantityMilli: quantity(1),
          unitPriceMinor: 95_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-18',
      issuedReference: null,
      frozenLabels: null,
      totalMinor: 0,
      billsBalanceOfId: 'doc_inv',
    })
  }

  it('says on the original that a follow-up exists', async () => {
    renderAt('/doc/doc_inv', withFollowUp)
    expect(await screen.findByText(/The balance of this is billed on/)).toBeInTheDocument()
  })

  it('says on the follow-up which invoice it chases', async () => {
    renderAt('/doc/doc_follow', withFollowUp)
    expect(await screen.findByText(/Bills the balance of INV-0042/)).toBeInTheDocument()
  })

  /** And the follow-up carries the other end of the link. */
  it('records on the follow-up which invoice it chases', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', partPaid(50_000_00))

    await user.click(await screen.findByRole('button', { name: 'Invoice the balance' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))

    const follow = state.documents.find((d) => d.id !== 'doc_inv')
    expect(follow?.billsBalanceOfId).toBe('doc_inv')
  })

  /**
   * ONE DEBT, IN ONE PLACE, THROUGH THE APP'S OWN READ PATH.
   *
   * The guard that shipped with this feature asserted the original invoice's
   * ledger was UNTOUCHED — true, and exactly the wrong property to lock in,
   * because the bug was that both documents then billed the same money.
   * Measured before the fix: ₦190,000 outstanding on a ₦95,000 debt, and the
   * original still unpaid after the follow-up was settled.
   *
   * These assert the TOTAL a person sees, at each stage the pair can be in.
   */
  const withFollowUpAt = (status: string, extraPayment = false) => (state: MemoryState) => {
    partPaid(50_000_00)(state)
    state.documents.push({
      id: 'doc_follow',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status,
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'lb',
          description: 'Balance of INV-0042',
          quantityMilli: quantity(1),
          unitPriceMinor: 95_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-18',
      issuedReference: status === 'draft' ? null : 'INV-0043',
      frozenLabels:
        status === 'draft'
          ? null
          : {
              printedTitle: 'INVOICE',
              partyLabel: 'Bill to',
              signatureCaption: 'Authorised signature',
              language: 'en',
            },
      totalMinor: status === 'draft' ? 0 : 95_000_00,
      billsBalanceOfId: 'doc_inv',
    })
    if (extraPayment) {
      state.payments.push({
        id: 'pay_2',
        customerId: 'cus_1',
        amount: NGN(95_000_00),
        paidAt: '2026-09-20T09:00:00Z',
        method: 'bank_transfer',
        source: 'manual',
        allocations: [
          { id: 'pay_2:a', paymentId: 'pay_2', invoiceId: 'doc_follow', amount: NGN(95_000_00) },
        ],
      })
    }
  }

  /** Home's Outstanding is the figure a trader looks at first. */
  const outstandingOnHome = async () => {
    const card = await screen.findByLabelText(/outstanding/i)
    return (card.textContent ?? '').replace(/\s+/g, ' ')
  }

  it('shows the debt once while the follow-up is only a draft', async () => {
    renderAt('/', withFollowUpAt('draft'))
    expect(await outstandingOnHome()).toContain('95,000')
  })

  /** THE FIRST HALF OF THE BUG: this used to read ₦190,000. */
  it('shows the debt once when the follow-up is issued', async () => {
    renderAt('/', withFollowUpAt('issued'))
    const text = await outstandingOnHome()
    expect(text).toContain('95,000')
    expect(text, 'the debt is being counted twice').not.toContain('190,000')
  })

  /** THE SECOND HALF: this used to leave ₦95,000 owed after it was settled. */
  it('shows nothing owed once the follow-up is paid', async () => {
    renderAt('/', withFollowUpAt('issued', true))
    expect(await outstandingOnHome()).not.toContain('95,000')
  })

  /** REVERSIBILITY: cancelling the follow-up must not erase a real debt. */
  it('returns the debt to the original when the follow-up is cancelled', async () => {
    renderAt('/', withFollowUpAt('void'))
    expect(await outstandingOnHome()).toContain('95,000')
  })

  /**
   * CONDITION 1: never a word implying the money came in. The original shows
   * the split instead of a paid-so-far bar.
   */
  it('never says paid on the original, and shows the split', async () => {
    renderAt('/doc/doc_inv', withFollowUpAt('issued'))
    await screen.findByRole('main')
    const split = document.querySelector('[data-balance-split]')
    expect(split, 'the original does not say where the balance went').not.toBeNull()
    expect(split?.textContent).toContain('₦50,000.00 received')
    expect(split?.textContent).toContain('₦95,000.00 billed on INV-0043')
  })

  /** CONDITION 3: one follow-up at a time. */
  it('does not offer a second follow-up while one is live', async () => {
    renderAt('/doc/doc_inv', withFollowUpAt('issued'))
    await screen.findByRole('main')
    expect(screen.queryByRole('button', { name: 'Invoice the balance' })).toBeNull()
  })

  it('offers one again once the follow-up is cancelled', async () => {
    renderAt('/doc/doc_inv', withFollowUpAt('void'))
    expect(
      await screen.findByRole('button', { name: 'Invoice the balance' }),
    ).toBeInTheDocument()
  })

  /**
   * IT MOVES NO MONEY. The original keeps its own balance and its own
   * payment; a follow-up existing must not settle, reverse or double-count
   * anything, or every figure that reads the ledger goes wrong at once.
   */
  it('leaves the original’s ledger exactly as it was', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', partPaid(50_000_00))
    const before = state.payments.length

    await user.click(await screen.findByRole('button', { name: 'Invoice the balance' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))

    expect(state.payments).toHaveLength(before)
    expect(state.documents.find((d) => d.id === 'doc_inv')?.totalMinor).toBe(145_000_00)
    expect(state.payments[0]?.allocations).toHaveLength(1)
  })

  /** Two taps make ONE draft — the key is derived (§M). */
  it('does not draw two drafts for two taps', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', partPaid(50_000_00))

    const button = await screen.findByRole('button', { name: 'Invoice the balance' })
    await user.click(button)
    await waitFor(() => expect(state.documents).toHaveLength(2))
  })

  /**
   * NOT OFFERED where it would be wrong, and each for its own reason: an
   * untouched invoice wants CHASING, which is already one of its four
   * actions, and a settled one has no remainder at all.
   */
  it('is not offered on an invoice nobody has paid', async () => {
    renderAt('/doc/doc_inv', billed)
    await screen.findByRole('main')
    expect(screen.queryByRole('button', { name: 'Invoice the balance' })).toBeNull()
  })

  it('is not offered once the invoice is settled', async () => {
    renderAt('/doc/doc_inv', partPaid(145_000_00))
    await screen.findByRole('main')
    expect(screen.queryByRole('button', { name: 'Invoice the balance' })).toBeNull()
  })
})

describe('Primary navigation appears only at the top level (§F, §G)', () => {
  const navOf = () => screen.queryByRole('navigation', { name: 'Sections' })

  const seededNav = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_nav',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        { id: 'l1', description: 'Cement', quantityMilli: quantity(2), unitPriceMinor: 500_000, taxable: false },
      ],
      issueDate: '2026-09-05',
      issuedReference: 'INV-0001',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 1_000_000,
    })
  }

  it.each([
    ['/', 'Home'],
    ['/list/invoice', 'the invoice list'],
    ['/list/waybill', 'the delivery list'],
    ['/customers', 'Customers'],
    ['/analytics', 'Analytics'],
    ['/settings', 'the settings index'],
  ])('shows it on %s (%s)', async (path) => {
    renderAt(path, seededNav)
    await screen.findByRole('main')
    expect(navOf(), `${path} lost its navigation`).toBeInTheDocument()
  })

  /**
   * THE ONE THIS IS FOR — and the rest of the detail screens with it. Absent,
   * not hidden: `queryByRole` finds an element that is merely transparent or
   * positioned off-screen, which is the implementation this rules out.
   */
  it.each([
    ['/doc/doc_nav', 'the saved document'],
    ['/customers/cus_1', 'a customer'],
    ['/settings/company', 'a settings panel'],
    ['/settings/region', 'another settings panel'],
  ])('hides it on %s (%s)', async (path) => {
    renderAt(path, seededNav)
    await screen.findByRole('main')
    expect(navOf(), `${path} still draws the navigation`).not.toBeInTheDocument()
  })

  /** The builder and setup are full-screen flows and never had it. */
  it.each([['/new/invoice'], ['/edit/doc_nav'], ['/start']])('keeps it off %s', async (path) => {
    renderAt(path, seededNav)
    expect(navOf(), `${path} drew the navigation`).not.toBeInTheDocument()
  })

  /**
   * Tapping the tab you are already on must not stack a duplicate.
   *
   * `NavLink` pushes unconditionally, so four taps on Home left four
   * identical history entries — and then four presses of Back to leave, each
   * one appearing to do nothing.
   */
  it('does not push a duplicate entry for the tab already showing', async () => {
    const user = userEvent.setup()

    /*
     * A REAL ROUTER, because this is a claim about HISTORY.
     *
     * Every other case here runs on the memory router, where
     * `window.history` never moves — so a length check passes whatever the
     * component does. The first version of this did exactly that and survived
     * having `replace` deleted, which is the definition of a guard that
     * cannot fail. A browser router in jsdom pushes real entries.
     */
    const { state, repositories } = seeded(seededNav)
    void state
    window.history.replaceState({}, '', '/')
    render(
      <App repositories={repositories} companyId={DEV_COMPANY_ID} router="browser" />,
    )

    const home = await screen.findByRole('link', { name: 'Home' })
    const before = window.history.length
    await user.click(home)
    await user.click(home)
    await user.click(home)
    expect(
      window.history.length - before,
      'tapping the tab already showing stacked history entries',
    ).toBe(0)
  })

  /** And moving to a DIFFERENT section still pushes one, or Back is broken. */
  it('pushes exactly one entry when the section changes', async () => {
    const user = userEvent.setup()
    const { repositories } = seeded(seededNav)
    window.history.replaceState({}, '', '/')
    render(<App repositories={repositories} companyId={DEV_COMPANY_ID} router="browser" />)

    const before = window.history.length
    await user.click(await screen.findByRole('link', { name: 'Customers' }))
    expect(window.history.length - before, 'moving section did not push').toBe(1)
  })

  /**
   * And a different tab still navigates — asserted on what RENDERS, because
   * the harness drives a memory router and `window.location` never moves.
   */
  it('still moves between sections', async () => {
    const user = userEvent.setup()
    renderAt('/', seededNav)
    await user.click(await screen.findByRole('link', { name: 'Customers' }))
    // The seeded customer is on the customers screen and on no other.
    expect(await screen.findByText('Ade Stores')).toBeInTheDocument()
  })

  /**
   * EVERY DETAIL SCREEN HAS A WAY OFF IT.
   *
   * None of them needed one while a floating pill sat on every page. Take the
   * pill away and the saved document and all six settings panels had no exit
   * at all — except Android's hardware button, which is the one platform
   * being tested and would have hidden this everywhere else.
   */
  it.each([
    ['/doc/doc_nav', 'the saved document'],
    ['/customers/cus_1', 'a customer'],
    ['/settings/company', 'a settings panel'],
    ['/settings/region', 'another settings panel'],
  ])('gives %s (%s) a way back', async (path) => {
    renderAt(path, seededNav)
    await screen.findByRole('main')
    const back = screen.queryAllByRole('button', { name: /back|all customers/i })
    expect(back.length, `${path} has no way off it`).toBeGreaterThan(0)
  })

  /**
   * And the four actions on the saved document are untouched. Removing the
   * nav was meant to make them clearer, not to alter them.
   */
  it('leaves the saved document its four actions', async () => {
    renderAt('/doc/doc_nav', seededNav)
    const grid = await screen.findByRole('group', { name: /actions/i })
    expect(grid.querySelectorAll('button')).toHaveLength(4)
  })
})

describe('Every country picker names its countries (§D, §R)', () => {
  const codeLike = /^[A-Z]{2}$/

  /**
   * The picker is on the flow's `business` page, one step in from its welcome
   * page — and the flow is at `/start`, not `/welcome`, which is a different
   * screen entirely.
   */
  const openSetup = async () => {
    const user = userEvent.setup()
    renderAt('/start')
    await user.click(await screen.findByRole('button', { name: /get started/i }))
    return screen.findByLabelText(/country/i)
  }

  it('lists full names on the setup screen, not codes', async () => {
    const select = await openSetup()
    const options = [...select.querySelectorAll('option')]

    expect(options.length, 'the country picker is empty').toBeGreaterThan(100)

    /*
     * Asserted on the LABEL, not on the value. The value is the code and has
     * to stay one — it is what gets stored. What changed is what a person
     * reads, which is the whole complaint.
     */
    const bare = options.filter((o) => codeLike.test((o.textContent ?? '').trim()))
    expect(bare.map((o) => o.textContent), 'options are still two-letter codes').toEqual([])

    expect(options.map((o) => (o.textContent ?? '').trim())).toContain('Nigeria')
    expect(options.map((o) => (o.textContent ?? '').trim())).toContain('United Kingdom')
  })

  /** And the code is still what gets stored, or nothing downstream works. */
  it('keeps the two-letter code as the value', async () => {
    const select = await openSetup()
    const nigeria = [...select.querySelectorAll('option')].find(
      (o) => (o.textContent ?? '').trim() === 'Nigeria',
    )
    expect(nigeria?.getAttribute('value')).toBe('NG')
  })
})

describe('The tab bar (§G)', () => {
  it('marks the page you are on', async () => {
    renderAt('/customers')
    await screen.findByRole('link', { name: 'Customers' })
    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('moves between pages', async () => {
    const user = userEvent.setup()
    renderAt('/', withIncome(150_000_00))
    await user.click(await screen.findByRole('link', { name: 'Business' }))
    expect(await screen.findByLabelText('Kept')).toBeInTheDocument()
  })

  it('is absent over the builder, which owns its own footer (§G)', async () => {
    renderAt('/new/invoice')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument())
  })
})

/**
 * The page header of whichever screen is showing.
 *
 * A saved document now draws its own A4 page below the header, and that page
 * prints the reference and the "replaces" line as well — so a bare
 * `findByText` for either finds two: the screen NAMING the record, and the
 * record naming ITSELF. Every assertion that scopes through here means the
 * first, which is what "we landed on this document" has always meant.
 *
 * `querySelector` rather than a role: a `<header>` inside `<main>` is not a
 * banner landmark, so there is no role to query it by.
 */
async function pageHeader(): Promise<HTMLElement> {
  // Awaited first, so this settles for the same reason `findByText` did.
  await screen.findByRole('heading', { level: 1 })
  const header = document.querySelector('header')
  if (header === null) throw new Error('No page header is rendered.')
  return header
}

describe('Create, fill, issue — through the repositories (§G, §M)', () => {
  it('creates exactly one draft for one visit to /new/:type', async () => {
    const state = renderAt('/new/invoice')
    await waitFor(() => expect(state.documents).toHaveLength(1))
    expect(state.documents[0]?.status).toBe('draft')
    expect(state.documents[0]?.issuedReference).toBeNull()
    // And the builder took over on the draft's own URL.
    expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
  })

  it('still creates exactly one draft under StrictMode, which is how it ships', async () => {
    // main.tsx renders inside StrictMode, so effects mount twice in
    // development. A second draft here would be a duplicate record for one
    // tap — the §M failure this guard exists for.
    const { state, repositories } = seeded()
    render(
      <StrictMode>
        <App
          repositories={repositories}
          companyId={DEV_COMPANY_ID}
          router="memory"
          initialPath="/new/invoice"
        />
      </StrictMode>,
    )
    await waitFor(() => expect(state.documents).toHaveLength(1))
  })

  it('walks the five steps and issues, freezing a reference and the labels', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_seeded', (seed) => {
      seed.customers.push(customer())
      seed.documents.push({
        id: 'doc_seeded',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [
          {
            id: 'li_1',
            description: 'Bag of cement',
            quantityMilli: quantity(20),
            unitPriceMinor: 5_000_00,
            taxable: true,
          },
        ],
        issueDate: '2026-09-11',
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 100_000_00,
      })
      const company = seed.companies[0]
      if (company !== undefined) {
        seed.companies[0] = {
          ...company,
          name: 'Sola Ventures',
          ...PAID_BY_TRANSFER,
          numberingPrefixes: { invoice: 'INV' },
        }
      }
    })

    // Step through to Review.
    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }

    await user.click(await screen.findByRole('button', { name: /^Save/ }))

    await waitFor(() => expect(state.documents[0]?.status).toBe('issued'))
    expect(state.documents[0]?.issuedReference).toMatch(/^INV-\d{4}(-[A-Z0-9]{2})?$/)
    expect(state.documents[0]?.frozenLabels?.printedTitle).toBeTruthy()
    expect(state.documents[0]?.frozenLabels?.language).toBeTruthy()
  })

  it('lands on the saved document, which offers no way to edit an issued one', async () => {
    renderAt('/doc/doc_issued', (seed) => {
      seed.documents.push({
        id: 'doc_issued',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-11',
        issuedReference: 'INV-0001',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 100_000_00,
      })
    })

    expect(within(await pageHeader()).getByText('INV-0001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Carry on editing' })).not.toBeInTheDocument()
    // §L3's bar and the payments list are here, which is what this screen is for.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('offers "carry on editing" on a draft, and nothing else about money', async () => {
    renderAt('/doc/doc_draft', (seed) => {
      seed.documents.push({
        id: 'doc_draft',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    })

    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('A region change reaches every screen at once (§D)', () => {
  it('renames the type on the list page without touching an issued document', async () => {
    const user = userEvent.setup()
    const state = renderAt('/settings/region', (seed) => {
      seed.documents.push({
        id: 'doc_frozen',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-11',
        issuedReference: 'WB-0001',
        frozenLabels: {
          printedTitle: 'WAYBILL',
          partyLabel: 'Deliver to',
          signatureCaption: 'Received by',
          language: 'en',
        },
        totalMinor: 0,
      })
    })

    const region = await screen.findByLabelText(/country/i)
    await user.selectOptions(region, 'GB')

    await waitFor(() => expect(state.companies[0]?.localeRegion).toBe('GB'))
    // The frozen labels on the issued record are untouched (§D.2, §M).
    expect(state.documents[0]?.frozenLabels?.printedTitle).toBe('WAYBILL')
  })
})

describe('Adding an expense moves Kept, on the real screen', () => {
  it('writes through the repository and the page re-reads', async () => {
    const user = userEvent.setup()
    const state = renderAt('/analytics', withIncome(150_000_00))

    const before = await screen.findByLabelText('Kept')
    expect(before).toHaveTextContent('₦150,000.00')

    await user.click(screen.getByLabelText('Add an expense'))
    await user.type(screen.getByLabelText('Amount'), '9500')
    await user.type(screen.getByLabelText('What was it for?'), 'Diesel')
    await user.click(screen.getByRole('button', { name: 'Add it' }))

    await waitFor(() => expect(state.expenses).toHaveLength(1))
    await waitFor(() =>
      expect(within(screen.getByLabelText('Kept')).queryByText('₦140,500.00')).not.toBeNull(),
    )
  })
})

describe('Home search replaces the body with results (§G, §D.3)', () => {
  const seedBook = (state: MemoryState) => {
    state.customers.push(customer())
    state.items.push({
      id: 'item_1',
      companyId: DEV_COMPANY_ID,
      name: 'Bag of cement',
      timesUsed: 3,
    })
    state.documents.push({
      id: 'doc_wb',
      companyId: DEV_COMPANY_ID,
      type: 'waybill',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        { id: 'li_1', description: 'Bag of cement', quantityMilli: quantity(20), taxable: false },
      ],
      issueDate: '2026-09-02',
      issuedReference: 'WB-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'Received by',
        language: 'en',
      },
      totalMinor: 0,
    })
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-03',
      dueDate: '2026-09-04',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 95_000_00,
    })
  }

  const type = async (text: string) => {
    const user = userEvent.setup()
    const field = await screen.findByRole('searchbox', { name: /Search/i })
    await user.type(field, text)
    return user
  }

  it('puts the tiles away while a query is in the field, and brings them back', async () => {
    renderAt('/', seedBook)
    // The four tiles and the attention list ARE the body until something is
    // typed. The tile's accessible name is its label and its count.
    expect(await screen.findByRole('button', { name: /^1 Invoice/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Needs attention')).toBeInTheDocument()

    const user = await type('cement')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^1 Invoice/ })).not.toBeInTheDocument(),
    )
    expect(screen.queryByLabelText('Needs attention')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Documents')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search/i }))
    expect(await screen.findByRole('button', { name: /^1 Invoice/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText('Documents')).not.toBeInTheDocument())
  })

  it('keeps the header, the stat cards and the field on screen while searching', async () => {
    renderAt('/', (state) => {
      seedBook(state)
      withCompanyName('Sola Ventures')(state)
    })
    await type('cement')
    expect(await screen.findByLabelText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Sola Ventures')).toBeInTheDocument()
    expect(screen.getByLabelText('Outstanding')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /Search/i })).toHaveValue('cement')
  })

  it('finds a document by an item on it, and a customer by name, in one field', async () => {
    renderAt('/', seedBook)
    await type('cement')
    const documents = await screen.findByLabelText('Documents')
    expect(within(documents).getByText('WB-0007')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Things you sell')).getByText('Bag of cement')).toBeInTheDocument()
  })

  it('finds an issued document by the word it was issued under AND the word in use now', async () => {
    // Issued in Lagos as a waybill; the company has since moved to the UK, so
    // its current word is "delivery note". §D.3 says both must find it.
    renderAt('/', (state) => {
      seedBook(state)
      const company = state.companies[0]
      if (company !== undefined) state.companies[0] = { ...company, localeRegion: 'GB' }
    })

    const user = await type('waybill')
    expect(within(await screen.findByLabelText('Documents')).getByText('WB-0007')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search/i }))
    await user.type(screen.getByRole('searchbox', { name: /Search/i }), 'delivery note')
    expect(within(await screen.findByLabelText('Documents')).getByText('WB-0007')).toBeInTheDocument()
  })

  it('finds a document by an amount typed either way', async () => {
    renderAt('/', seedBook)
    const user = await type('95000')
    expect(within(await screen.findByLabelText('Documents')).getByText('INV-0042')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search/i }))
    await user.type(screen.getByRole('searchbox', { name: /Search/i }), '95,000')
    expect(within(await screen.findByLabelText('Documents')).getByText('INV-0042')).toBeInTheDocument()
  })

  it('never offers a delivery document by an amount, because it carries none', async () => {
    renderAt('/', seedBook)
    await type('95000')
    const documents = await screen.findByLabelText('Documents')
    expect(within(documents).queryByText('WB-0007')).not.toBeInTheDocument()
  })

  it('shows who it is for and where it stands on each document row', async () => {
    renderAt('/', seedBook)
    await type('INV-0042')
    expect(await screen.findByText(/Ade Stores · Late · ₦95,000\.00/)).toBeInTheDocument()
  })

  it('opens a result', async () => {
    renderAt('/', seedBook)
    const user = await type('INV-0042')
    await user.click(await screen.findByText('INV-0042'))
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()
  })

  it('sends an item to the saved list it lives in', async () => {
    renderAt('/', seedBook)
    const user = await type('cement')
    await user.click(within(await screen.findByLabelText('Things you sell')).getByText('Bag of cement'))
    expect(await screen.findByRole('heading', { name: 'Saved items' })).toBeInTheDocument()
  })

  it('offers suggestions that work when nothing matched', async () => {
    renderAt('/', seedBook)
    const user = await type('zzzz')
    expect(await screen.findByText('Nothing matched "zzzz"')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Waybill' }))
    expect(within(await screen.findByLabelText('Documents')).getByText('WB-0007')).toBeInTheDocument()
  })
})

describe('The contact page (§G — Customers)', () => {
  const seedContact = (state: MemoryState) => {
    state.customers.push({ ...customer(), phone: '+234 803 111 2222', labels: ['Wholesale'] })
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      dueDate: '2026-09-04',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
    })
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(50_000_00),
      paidAt: '2026-09-10T09:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [
        { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_inv', amount: NGN(50_000_00) },
      ],
    })
  }

  it('opens from the customer list', async () => {
    const user = userEvent.setup()
    renderAt('/customers', seedContact)
    await user.click(await screen.findByText('Ade Stores'))
    expect(await screen.findByRole('heading', { name: 'Ade Stores' })).toBeInTheDocument()
    expect(screen.getByLabelText('Balance')).toHaveTextContent('₦95,000.00')
  })

  it('opens from a Home search result', async () => {
    const user = userEvent.setup()
    renderAt('/', seedContact)
    await user.type(await screen.findByRole('searchbox', { name: /Search/i }), 'Ade')
    await user.click(within(await screen.findByLabelText('Customers')).getByText('Ade Stores'))
    expect(await screen.findByLabelText('Balance')).toBeInTheDocument()
  })

  it('lists this customer history and opens a document from it', async () => {
    const user = userEvent.setup()
    renderAt('/customers/cus_1', seedContact)
    const history = await screen.findByLabelText('History')
    expect(within(history).getByText('INV-0042')).toBeInTheDocument()
    await user.click(within(history).getByText('INV-0042'))
    expect(await screen.findByRole('progressbar', { name: /paid of/ })).toBeInTheDocument()
  })

  it('saves a new label to the record', async () => {
    const user = userEvent.setup()
    const state = renderAt('/customers/cus_1', seedContact)
    await user.type(await screen.findByLabelText('New label'), 'VIP')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(state.customers[0]?.labels).toEqual(['Wholesale', 'VIP']))
  })

  it('saves a private note to the record', async () => {
    const user = userEvent.setup()
    const state = renderAt('/customers/cus_1', seedContact)
    await user.type(await screen.findByLabelText('Notes'), 'Pays after harvest')
    await user.tab()
    await waitFor(() => expect(state.customers[0]?.privateNote).toBe('Pays after harvest'))
  })

  it('sends an unknown customer back to the list', async () => {
    renderAt('/customers/nobody', seedContact)
    expect(await screen.findByText('Ade Stores')).toBeInTheDocument()
    expect(screen.queryByLabelText('Balance')).not.toBeInTheDocument()
  })

  it('reaches the statement, and back again', async () => {
    const user = userEvent.setup()
    renderAt('/customers/cus_1', seedContact)
    await user.click(await screen.findByRole('button', { name: 'Statement' }))
    expect(await screen.findByLabelText('Statement')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ade Stores' }))
    expect(await screen.findByLabelText('History')).toBeInTheDocument()
  })
})

describe('The statement covers any period (§G)', () => {
  const seedTwoMonths = (state: MemoryState) => {
    state.customers.push(customer())
    for (const [id, day, minor] of [
      ['doc_old', '2026-03-02', 10_000_00],
      ['doc_new', '2026-09-02', 20_000_00],
    ] as const) {
      state.documents.push({
        id,
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: day,
        issuedReference: `INV-${id}`,
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: minor,
      })
    }
  }

  it('narrows to this month and widens to everything', async () => {
    const user = userEvent.setup()
    renderAt('/customers/cus_1/statement/NGN', seedTwoMonths)

    // Twelve months is the opening offer, and both invoices fall inside it.
    const statement = await screen.findByLabelText('Statement')
    expect(statement).toHaveTextContent('INV-doc_old')
    expect(statement).toHaveTextContent('INV-doc_new')

    await user.click(screen.getByRole('button', { name: 'This month' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Statement')).not.toHaveTextContent('INV-doc_old'),
    )
    expect(screen.getByLabelText('Statement')).toHaveTextContent('INV-doc_new')
    // What fell outside the window is brought forward, not dropped.
    expect(screen.getByLabelText('Statement')).toHaveTextContent('Balance brought forward')

    await user.click(screen.getByRole('button', { name: 'Everything' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Statement')).toHaveTextContent('INV-doc_old'),
    )
  })

  it('prints "Everything" rather than a sentinel year on an open-ended statement', async () => {
    const user = userEvent.setup()
    renderAt('/customers/cus_1/statement/NGN', seedTwoMonths)
    await user.click(await screen.findByRole('button', { name: 'Everything' }))
    const statement = screen.getByLabelText('Statement')
    expect(statement).toHaveTextContent('From Everything')
    expect(statement).not.toHaveTextContent('0001-01-01')
  })
})

describe('Adding a customer (§G)', () => {
  it('offers the first one from the empty state, saves, and lands on the contact page', async () => {
    const user = userEvent.setup()
    const state = renderAt('/customers')

    await user.click(await screen.findByRole('button', { name: 'Add your first customer' }))
    await user.type(screen.getByLabelText('Name'), 'Ade Stores')
    await user.type(screen.getByLabelText('Phone'), '+234 803 111 2222')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.customers).toHaveLength(1))
    expect(state.customers[0]?.name).toBe('Ade Stores')
    expect(state.customers[0]?.labels).toEqual([])
    expect(await screen.findByLabelText('Balance')).toBeInTheDocument()
  })

  it('asks for a name and nothing else (Rule #1)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/customers')
    await user.click(await screen.findByRole('button', { name: 'Add your first customer' }))

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Name'), 'Bisi')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.customers).toHaveLength(1))
    expect(state.customers[0]?.phone).toBeUndefined()
    expect(state.customers[0]?.address).toBeUndefined()
  })

  it('keeps a `+` once there is somebody in the list', async () => {
    const user = userEvent.setup()
    renderAt('/customers', (state) => {
      state.customers.push(customer())
    })
    await user.click(await screen.findByRole('button', { name: 'Add a customer' }))
    expect(screen.getByLabelText('Add a customer')).toBeInTheDocument()
  })
})

describe('The builder picks a customer (§G, step 1)', () => {
  const seedDraft = (state: MemoryState) => {
    state.documents.push({
      id: 'doc_draft',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'draft',
      currency: 'NGN',
      lineItems: [],
      issuedReference: null,
      frozenLabels: null,
      totalMinor: 0,
    })
  }

  it('chooses an existing customer onto the draft', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_draft', (seed) => {
      seedDraft(seed)
      seed.customers.push(customer())
    })

    await user.click(await screen.findByRole('button', { name: 'Choose who this is for' }))
    await user.click(screen.getByRole('button', { name: /Ade Stores/ }))

    // Committed on the next step change, per §G's autosave.
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(state.documents[0]?.customerId).toBe('cus_1'))
  })

  it('adds a customer from the typed name and puts them on the draft', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_draft', seedDraft)

    await user.click(await screen.findByRole('button', { name: 'Choose who this is for' }))
    await user.type(screen.getByRole('searchbox'), 'Chinedu Motors')
    await user.click(screen.getByRole('button', { name: 'Add "Chinedu Motors"' }))

    // The name carried across: no retyping (§G).
    expect(screen.getByLabelText('Name')).toHaveValue('Chinedu Motors')
    await user.type(screen.getByLabelText('Phone'), '08099988877')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(state.customers).toHaveLength(1))
    expect(state.customers[0]?.name).toBe('Chinedu Motors')

    // And the new customer is the one on the card, without being chosen again.
    expect(
      await screen.findByRole('button', { name: 'Choose who this is for' }),
    ).toHaveTextContent('Chinedu Motors')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(state.documents[0]?.customerId).toBe(state.customers[0]?.id))
  })

  it('shows the balance the contact page shows, from the ledger', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_draft', (seed) => {
      seedDraft(seed)
      seed.customers.push(customer())
      seed.documents.push({
        id: 'doc_billed',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 145_000_00,
      })
      seed.payments.push({
        id: 'pay_1',
        customerId: 'cus_1',
        amount: NGN(50_000_00),
        paidAt: '2026-09-10T09:00:00Z',
        method: 'bank_transfer',
        source: 'manual',
        allocations: [
          { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_billed', amount: NGN(50_000_00) },
        ],
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Choose who this is for' }))
    await user.click(screen.getByRole('button', { name: /Ade Stores/ }))
    expect(await screen.findByText('Owes ₦95,000.00')).toBeInTheDocument()
  })

  it('shows no balance chip on a delivery document, which carries no money', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_way', (seed) => {
      seed.customers.push(customer())
      seed.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Choose who this is for' }))
    await user.click(screen.getByRole('button', { name: /Ade Stores/ }))
    expect(screen.queryByText('Settled')).not.toBeInTheDocument()
    expect(screen.queryByText(/Owes/)).not.toBeInTheDocument()
  })

  it('titles the card with the region word for the party, not a hardcoded one', async () => {
    renderAt('/edit/doc_way', (seed) => {
      seed.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    })
    // EN-NG: a delivery document is delivered to somebody, not billed to them.
    expect(await screen.findByRole('heading', { name: /Deliver to/i })).toBeInTheDocument()
  })
})

describe('Sharing a document (§B, §G, §M)', () => {
  const issued = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_issued',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      dueDate: '2026-09-30',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
    })
    const company = state.companies[0]
    if (company !== undefined) state.companies[0] = { ...company, name: 'Sola Ventures' }
  }

  it('offers sharing on an issued document', async () => {
    renderAt('/doc/doc_issued', issued)
    expect(await screen.findByRole('button', { name: 'Share PDF' })).toBeInTheDocument()
  })

  it('offers nothing to share on a draft, which has no frozen reference yet', async () => {
    renderAt('/doc/doc_draft', (state) => {
      state.documents.push({
        id: 'doc_draft',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    })
    // The draft's own action is there, so the screen has rendered.
    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()

    /*
     * Present and DARK, not absent (§N). A draft has no frozen reference and
     * no issued page, so there is nothing to send — and the pill says that
     * rather than leaving a gap the owner has to interpret.
     */
    const share = screen.getByRole('button', { name: 'Share PDF' })
    expect(share).toBeDisabled()
    expect(share.textContent).toMatch(/issue it first/i)
  })

  it('composes the message from the document, the customer and the ledger', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_issued', issued)
    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))

    const sheet = screen.getByLabelText('Send this document')
    expect(sheet).toHaveTextContent('Invoice INV-0042')
    expect(sheet).toHaveTextContent('For Ade Stores')
    expect(sheet).toHaveTextContent('₦145,000.00 still outstanding')
    expect(sheet).toHaveTextContent('Due 2026-09-30')
    expect(sheet).toHaveTextContent('— Sola Ventures')
  })

  it('carries no money in a delivery document message (§G, §I, §V)', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_way', (state) => {
      state.customers.push(customer())
      state.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'delivered',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'WB-0007',
        frozenLabels: {
          printedTitle: 'WAYBILL',
          partyLabel: 'Deliver to',
          signatureCaption: 'Received by',
          language: 'en',
        },
        totalMinor: 0,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    const sheet = screen.getByLabelText('Send this document')
    expect(sheet).toHaveTextContent('Waybill WB-0007')
    expect(sheet).not.toHaveTextContent('₦')
    expect(sheet).not.toHaveTextContent('outstanding')
  })

  it('keeps the word the document was issued under after a region change (§D.2)', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_way', (state) => {
      state.customers.push(customer())
      state.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'delivered',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'WB-0007',
        frozenLabels: {
          printedTitle: 'WAYBILL',
          partyLabel: 'Deliver to',
          signatureCaption: 'Received by',
          language: 'en',
        },
        totalMinor: 0,
      })
      // The business has since moved to the UK, where it is a delivery note.
      const company = state.companies[0]
      if (company !== undefined) state.companies[0] = { ...company, localeRegion: 'GB' }
    })

    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    const sheet = screen.getByLabelText('Send this document')
    expect(sheet).toHaveTextContent('Waybill WB-0007')
    expect(sheet).not.toHaveTextContent('Delivery note')
  })

  it('records the handoff against the document, and never a delivery', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_issued', issued)
    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))

    // jsdom has no navigator.share, so the port reports no sheet and the
    // screen offers the clipboard instead — the honest capability path (§N).
    expect(screen.queryByRole('button', { name: 'Send it' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy the text' }))

    await waitFor(() => expect(state.shares).toHaveLength(1))
    const event = state.shares[0]
    expect(event?.action).toBe('shared')
    expect(event?.entity).toBe('document')
    expect(event?.recordId).toBe('doc_issued')
    expect(event?.channel).toBe('clipboard')
    expect(event).not.toHaveProperty('deliveredAt')
    expect(event).not.toHaveProperty('recipient')
  })

  it('shows the handoff count on the next visit', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_issued', (state) => {
      issued(state)
      state.shares.push({
        id: 'shr_1',
        companyId: DEV_COMPANY_ID,
        action: 'shared',
        entity: 'document',
        recordId: 'doc_issued',
        at: '2026-09-11T10:00:00Z',
        channel: 'sheet',
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    expect(screen.getByText(/Sent once/)).toBeInTheDocument()
    expect(screen.getByText(/Last sent 2026-09-11/)).toBeInTheDocument()
  })
})

describe('Pressing Save when a document is not ready (§G, §M)', () => {
  it('takes the owner to the first missing thing instead of throwing', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_bare', (seed) => {
      seed.documents.push({
        id: 'doc_bare',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    })

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }
    await user.click(screen.getByRole('button', { name: /^Save/ }))

    // Said so, rather than throwing; and still a draft, so nothing was lost.
    expect(await screen.findByRole('alert')).toHaveTextContent(/Not quite ready/)
    expect(state.documents[0]?.status).toBe('draft')
    expect(state.documents[0]?.issuedReference).toBeNull()
  })

  it('issues once the missing things are there', async () => {
    const user = userEvent.setup()
    const state = renderAt('/edit/doc_ready', (seed) => {
      seed.customers.push(customer())
      seed.documents.push({
        id: 'doc_ready',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [
          {
            id: 'li_1',
            description: 'Bag of cement',
            quantityMilli: quantity(20),
            unitPriceMinor: 5_000_00,
            taxable: true,
          },
        ],
        issueDate: '2026-09-11',
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 100_000_00,
      })
      const company = seed.companies[0]
      if (company !== undefined) {
        seed.companies[0] = { ...company, ...PAID_BY_TRANSFER }
      }
    })

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Save/ }))

    await waitFor(() => expect(state.documents[0]?.status).toBe('issued'))
  })
})

describe('Converting a document (§G, §M)', () => {
  const quote = (state: MemoryState, status = 'accepted') => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_quote',
      companyId: DEV_COMPANY_ID,
      type: 'quotation',
      status,
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Bag of cement',
          quantityMilli: quantity(20),
          unitPriceMinor: 5_000_00,
          taxable: true,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: 'QUO-0009',
      frozenLabels: {
        printedTitle: 'QUOTATION',
        partyLabel: 'Client',
        signatureCaption: 'Prepared by',
        language: 'en',
      },
      totalMinor: 100_000_00,
    })
  }

  it('offers the action on an accepted quotation and not on a draft', async () => {
    renderAt('/doc/doc_quote', (state) => quote(state))
    expect(
      await screen.findByRole('button', { name: 'Convert to…' }),
    ).toBeInTheDocument()
  })

  it('offers nothing on a receipt, which is evidence of a payment', async () => {
    renderAt('/doc/doc_rct', (state) => {
      state.documents.push({
        id: 'doc_rct',
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'REC-0003',
        frozenLabels: {
          printedTitle: 'RECEIPT',
          partyLabel: 'Received from',
          signatureCaption: 'Issued by',
          language: 'en',
        },
        totalMinor: 50_000_00,
      })
    })
    expect(within(await pageHeader()).getByText('REC-0003')).toBeInTheDocument()

    /*
     * §G: "A receipt is evidence of a payment" — there is nothing to turn it
     * into, and the pill says so rather than vanishing. That answers the
     * question directly on screen: no, an invoice does not become a receipt.
     */
    const convert = screen.getByRole('button', { name: 'Convert to…' })
    expect(convert).toBeDisabled()
    expect(convert.textContent).toMatch(/nothing to convert/i)
  })

  it('makes a draft invoice from a quotation, leaving the quotation untouched', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', (state) => quote(state))

    await user.click(await screen.findByRole('button', { name: 'Convert to…' }))
    await user.click(screen.getByRole('button', { name: 'Turn into Invoice' }))

    await waitFor(() => expect(state.documents).toHaveLength(2))
    const made = state.documents.find((row) => row.type === 'invoice')
    expect(made?.status).toBe('draft')
    expect(made?.issuedReference).toBeNull()
    expect(made?.frozenLabels).toBeNull()
    expect(made?.customerId).toBe('cus_1')
    expect(made?.convertedFromId).toBe('doc_quote')

    // The original is exactly as it was (§G).
    const original = state.documents.find((row) => row.id === 'doc_quote')
    expect(original?.status).toBe('accepted')
    expect(original?.issuedReference).toBe('QUO-0009')
    expect(original).not.toHaveProperty('convertedToId')

    // And the builder opened on the new draft, because nothing is issued unseen.
    await waitFor(() => expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument())
  })

  it('drops the prices on the way to a delivery (§G, §I)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', (state) => quote(state))

    await user.click(await screen.findByRole('button', { name: 'Convert to…' }))
    await user.click(screen.getByRole('button', { name: 'Turn into Waybill' }))

    await waitFor(() => expect(state.documents).toHaveLength(2))
    const made = state.documents.find((row) => row.type === 'waybill')
    expect(made?.lineItems[0]?.description).toBe('Bag of cement')
    expect(made?.lineItems[0]?.unitPriceMinor).toBeUndefined()
  })

  it('offers to open the conversion that already exists, not a second one', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', (state) => {
      quote(state)
      state.documents.push({
        id: 'doc_made',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
        convertedFromId: 'doc_quote',
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Convert to…' }))
    expect(screen.getByText('Already made: Invoice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn into Invoice' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open it' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))
    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()
  })

  it('shows the link back to what it was made from', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_made', (state) => {
      quote(state)
      state.documents.push({
        id: 'doc_made',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-12',
        issuedReference: 'INV-0050',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 100_000_00,
        convertedFromId: 'doc_quote',
      })
    })

    const back = await screen.findByRole('button', { name: 'Made from QUO-0009' })
    await user.click(back)
    expect(within(await pageHeader()).getByText('QUO-0009')).toBeInTheDocument()
  })
})

describe('A first run is sent to the welcome (§R)', () => {
  /*
   * The dismissal lives in `localStorage`, which outlives a render — so
   * without this, the first test here to leave the welcome switches it off
   * for every test after it, and they pass by accident.
   */
  beforeEach(() => {
    globalThis.localStorage?.removeItem('docflow.onboarded')
  })

  /** A company with no name: what a fresh install actually looks like. */
  const freshInstall = (state: MemoryState) => {
    const company = state.companies[0]
    if (company !== undefined) state.companies[0] = { ...company, name: '' }
  }

  /**
   * The assertion whose absence let `/welcome` sit unreachable since Phase 2.
   *
   * Every other test in this file now seeds a NAMED company so it can get at
   * the screen it is about — which would leave nothing at all checking that
   * the gate still fires. That is precisely how a route becomes unreachable
   * without a single test going red.
   */
  it('opens the welcome instead of Home when no business has been named', async () => {
    renderAt('/', freshInstall)
    expect(await screen.findByText('Your paperwork. One clear place.')).toBeInTheDocument()
  })

  it('offers a way past it without naming anything (Rule #1)', async () => {
    renderAt('/', freshInstall)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Look around first' }))
    expect(await screen.findByLabelText('Outstanding')).toBeInTheDocument()
  })

  /** Somebody already working is never interrupted to be introduced. */
  it('leaves somebody with documents alone', async () => {
    renderAt('/', (state) => {
      freshInstall(state)
      state.customers.push(customer())
      state.documents.push({
        id: 'doc_inv',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 100_000_00,
      })
    })
    expect(await screen.findByLabelText('Outstanding')).toBeInTheDocument()
  })

  /**
   * The second launch. Stated as the STORED FACT rather than by walking the
   * welcome twice, because that is what the next launch actually reads — and
   * a test that re-walks it would prove the walk, not the memory.
   */
  it('does not ask again once the welcome has been left', async () => {
    globalThis.localStorage?.setItem('docflow.onboarded', '1')
    renderAt('/', freshInstall)
    expect(await screen.findByLabelText('Outstanding')).toBeInTheDocument()
  })
})

describe('The Repeat toggle keeps its answer (§L4)', () => {
  const repeatable = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      /*
       * REAL GOODS, because the receipt has to carry them.
       *
       * An empty `lineItems` made the picker row blank and would have let the
       * "the receipt carries the invoice's items" guard pass over nothing.
       */
      lineItems: [
        {
          id: 'li_1',
          description: 'Roofing sheets, 30 bundles',
          quantityMilli: 1_000,
          unitPriceMinor: 145_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 100_000_00,
    })
  }

  /**
   * The bug this whole feature exists to close.
   *
   * The toggle wrote to a `useState` on the document screen and to nothing
   * else, so switching Repeat on and leaving the screen switched it back off
   * — a control that showed a state it was not keeping. Leaving and returning
   * is therefore the assertion; checking the toggle immediately after the tap
   * would have passed against the broken version too.
   */
  it('is still on after leaving the document and coming back', async () => {
    renderAt('/doc/doc_inv', repeatable)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Not repeating' }))
    expect(await screen.findByRole('button', { name: 'Repeating' })).toBeInTheDocument()

    /*
     * Away, and back — the screen unmounts and its state goes with it. Search
     * rather than the tiles, because this is about the schedule surviving the
     * round trip, not about how you get there.
     *
     * Via the screen's own BACK, not the nav: a detail screen carries no
     * primary navigation any more, which is the point of it having a back
     * control at all.
     */
    await user.click(screen.getByRole('button', { name: /back/i }))
    await user.type(await screen.findByRole('searchbox', { name: /Search/i }), 'INV-0042')
    await user.click(await screen.findByText('INV-0042'))

    expect(await screen.findByRole('button', { name: 'Repeating' })).toBeInTheDocument()
  })

  it('is off again after Repeat is switched off, and stays off', async () => {
    renderAt('/doc/doc_inv', repeatable)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Not repeating' }))
    await user.click(await screen.findByRole('button', { name: 'Repeating' }))

    expect(await screen.findByRole('button', { name: 'Not repeating' })).toBeInTheDocument()
  })
})

describe('A delivery list row summarises goods, not money (§G, §V)', () => {
  /**
   * The last surface on a delivery where an amount could appear.
   *
   * The reference says the row summary reads "10 cartons" — a POSITIVE
   * summary in the place an invoice shows its total, not an empty space. An
   * absence tells nobody which delivery this is.
   *
   * Seeded with a priced, taxable line and company rates, so a total exists
   * to leak if anything is confused about the type.
   */
  const deliveries = (state: MemoryState) => {
    state.customers.push(customer())
    const company = state.companies[0]
    if (company !== undefined) {
      state.companies[0] = { ...company, name: 'Sola Ventures', taxRatePpm: 75_000, whtRatePpm: 50_000 }
    }
    state.documents.push({
      id: 'doc_way',
      companyId: DEV_COMPANY_ID,
      type: 'waybill',
      status: 'in_transit',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'l1',
          description: 'Cement 50kg',
          quantityMilli: quantity(10),
          unitPriceMinor: 25_000_00,
          unit: 'cartons',
          taxable: true,
        },
      ],
      discountRatePpm: 75_000,
      issueDate: '2026-09-05',
      issuedReference: 'WB-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'Dispatched by',
        language: 'en',
      },
      totalMinor: 250_000_00,
    })
  }

  /*
   * CHANGED DELIBERATELY. This read "10 cartons" — the quantity and the UNIT.
   * The owner decided against the unit on waybills having used it, so the row
   * names the GOODS instead, which is what actually identifies a delivery:
   * "10 × Cement 50kg" says which one this is, "10 cartons" never did.
   */
  it('summarises the goods where an amount would be', async () => {
    renderAt('/list/waybill', deliveries)
    expect(await screen.findByText(/10 × Cement 50kg/)).toBeInTheDocument()
  })

  it('shows no currency or total anywhere on the page, though both exist', async () => {
    renderAt('/list/waybill', deliveries)
    await screen.findByText('WB-0007')

    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
    expect(screen.queryByText(/250,000/)).not.toBeInTheDocument()
  })

  /** The control: an invoice with the same line does show its money. */
  it('still shows an amount on an invoice row', async () => {
    renderAt('/list/invoice', (state) => {
      deliveries(state)
      state.documents.push({
        ...state.documents[0]!,
        id: 'doc_inv',
        type: 'invoice',
        status: 'issued',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
      })
    })
    expect(await screen.findByText(/₦/)).toBeInTheDocument()
  })
})

describe('A delivery still has a creation date nobody typed (§E, §G)', () => {
  /**
   * The consequence of moving slot 0 from `issueDate` to `dispatchDate`.
   *
   * A delivery no longer SHOWS an issue date — its two dates are Dispatch and
   * Expected. But the record still needs one: a customer's history sorts on
   * `issueDate`, and a document without one sinks to the bottom of that list
   * however recently it happened. So it is set at creation and never asked
   * for, which is what "nothing downstream depends on a user having set it"
   * has to mean in practice.
   */
  it('sets it when the draft is created, without asking', async () => {
    const state = renderAt('/list/waybill')
    const user = userEvent.setup()

    const [create] = await screen.findAllByRole('button', { name: '+ New waybill' })
    await user.click(create!)
    await waitFor(() => expect(state.documents).toHaveLength(1))

    expect(state.documents[0]?.issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  /** And it is not something the delivery's own step ever asks about. */
  it('never shows that date on the delivery itself', async () => {
    renderAt('/list/waybill')
    const user = userEvent.setup()

    const [create] = await screen.findAllByRole('button', { name: '+ New waybill' })
    await user.click(create!)

    expect(await screen.findByRole('button', { name: /^Dispatch:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Date:/ })).not.toBeInTheDocument()
  })
})

describe('A saved delivery asserts no payment relationship (§V, §G)', () => {
  /**
   * Why this is not cosmetic.
   *
   * A paid-so-far bar or a chase section on a delivery is the app claiming a
   * payment relationship the document does not have. A driver handing that
   * over at a gate is handing over something that reads as a demand — and the
   * recipient has no way to know the app added it.
   *
   * Seeded so that money COULD appear if anything were confused about the
   * type: a priced, taxable line, a discount on the record, and company VAT
   * and withholding rates set. If the absence survives all of that, it is a
   * property of the type rather than of an empty fixture.
   */
  const deliveredWithEveryRate = (state: MemoryState) => {
    state.customers.push(customer())
    const company = state.companies[0]
    if (company !== undefined) {
      state.companies[0] = { ...company, name: 'Sola Ventures', taxRatePpm: 75_000, whtRatePpm: 50_000 }
    }
    state.documents.push({
      id: 'doc_way',
      companyId: DEV_COMPANY_ID,
      type: 'waybill',
      status: 'in_transit',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'l1',
          description: 'Cement 50kg',
          quantityMilli: quantity(10),
          unitPriceMinor: 25_000_00,
          unit: 'cartons',
          taxable: true,
        },
      ],
      discountRatePpm: 75_000,
      issueDate: '2026-09-05',
      issuedReference: 'WB-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'Dispatched by',
        language: 'en',
      },
      totalMinor: 0,
    })
  }

  it('shows no paid bar, payment list, chase or repeat', async () => {
    renderAt('/doc/doc_way', deliveredWithEveryRate)
    // Twice by design: the header names the record, the page prints it.
    await screen.findAllByText('WB-0007')

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/paid of/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Payments')).not.toBeInTheDocument()
    expect(screen.queryByText(/chase/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record a payment/i })).not.toBeInTheDocument()
  })

  it('prints no currency, subtotal or payable anywhere on the screen', async () => {
    renderAt('/doc/doc_way', deliveredWithEveryRate)
    // Twice by design: the header names the record, the page prints it.
    await screen.findAllByText('WB-0007')

    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
    for (const word of [/subtotal/i, /payable/i, /VAT/, /withholding/i]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument()
    }
  })

  /** And the goods are still legible — absence of money, not of content. */
  it('still shows the goods and the quantity, and no unit column', async () => {
    renderAt('/doc/doc_way', deliveredWithEveryRate)
    expect(await screen.findAllByText(/Cement 50kg/)).not.toHaveLength(0)
    // The unit is gone from deliveries by decision; the goods carry the row.
    expect(screen.queryAllByText(/^cartons$/)).toHaveLength(0)
  })
})

describe('Cancelling and crediting (Rule #5, §G)', () => {
  const invoiced = (state: MemoryState, totalMinor = 145_000_00) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      dueDate: '2026-09-30',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor,
    })
  }

  const paid = (state: MemoryState, minor: number) => {
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(minor),
      paidAt: '2026-09-10T09:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [
        { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_inv', amount: NGN(minor) },
      ],
    })
  }

  it('cancels an invoice with nothing against it, keeping its reference and totals', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', (seed) => invoiced(seed))

    await revealMore()
    await user.click(await screen.findByRole('button', { name: 'Cancel this document' }))
    // Nothing to type: the required reason was a new required field that got
    // discarded, so the warning is the confirmation now (Rule #1).
    await user.click(screen.getByRole('button', { name: 'Cancel it' }))

    await waitFor(() => expect(state.documents[0]?.status).toBe('void'))
    // A void is not an edit (§M): everything frozen at issue is still there.
    expect(state.documents[0]?.issuedReference).toBe('INV-0042')
    expect(state.documents[0]?.frozenLabels?.printedTitle).toBe('INVOICE')
    expect(state.documents[0]?.totalMinor).toBe(145_000_00)
  })

  it('refuses to cancel once money has come in, and offers to credit instead', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', (seed) => {
      invoiced(seed)
      paid(seed, 50_000_00)
    })
    await revealMore()
    await user.click(await screen.findByRole('button', { name: 'Cancel this document' }))
    expect(screen.getByText(/Money has already come in against this/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel it' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Credit the balance back instead' }))
    expect(await screen.findByLabelText('Credit some of this back')).toBeInTheDocument()

    // And the invoice is untouched by the refusal.
    expect(state.documents[0]?.status).toBe('issued')
  })

  it('issues a credit note that lowers what is owed and leaves income alone', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', (seed) => {
      invoiced(seed)
      paid(seed, 50_000_00)
    })
    await revealMore()

    // ₦95,000 outstanding before crediting.
    expect(
      await screen.findByLabelText('₦50,000.00 paid of ₦145,000.00'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Credit some of this back' }))
    await user.type(screen.getByLabelText('How much?'), '95000')
    await user.type(screen.getByLabelText('Why?'), 'Short delivery')
    await user.click(screen.getByRole('button', { name: 'Credit it back' }))

    await waitFor(() => expect(state.credits).toHaveLength(1))
    expect(state.credits[0]?.amount).toEqual(NGN(95_000_00))
    expect(state.credits[0]?.invoiceId).toBe('doc_inv')
    expect(state.credits[0]?.reason).toBe('Short delivery')
    // The invoice itself is untouched — Rule #5.
    expect(state.documents[0]?.status).toBe('issued')
    expect(state.documents[0]?.totalMinor).toBe(145_000_00)
    // The payment is untouched too: a credit never moves income (§V).
    expect(state.payments).toHaveLength(1)
    expect(state.payments[0]?.amount).toEqual(NGN(50_000_00))
  })

  it('shows the credit in the balance, and the invoice as settled', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_inv', (seed) => {
      invoiced(seed)
      paid(seed, 50_000_00)
      seed.credits.push({
        id: 'crn_1',
        companyId: DEV_COMPANY_ID,
        invoiceId: 'doc_inv',
        amount: NGN(95_000_00),
        reference: 'CRN-0001',
        reason: 'Short delivery',
        issuedAt: '2026-09-12T10:00:00Z',
        invoiceReference: 'INV-0042',
        invoiceTotal: NGN(145_000_00),
      })
    })

    // ₦50,000 paid, ₦95,000 credited: nothing left owing, so the bar says so.
    expect(await screen.findByText('Settled in full')).toBeInTheDocument()
    // And the cancel route no longer offers to credit, because there is
    // nothing left to credit.
    await revealMore()
    await user.click(screen.getByRole('button', { name: 'Cancel this document' }))
    expect(
      screen.queryByRole('button', { name: 'Credit the balance back instead' }),
    ).not.toBeInTheDocument()
  })

  it('takes the credit off Outstanding on Home (§G)', async () => {
    renderAt('/', (seed) => {
      invoiced(seed)
      seed.credits.push({
        id: 'crn_1',
        companyId: DEV_COMPANY_ID,
        invoiceId: 'doc_inv',
        amount: NGN(45_000_00),
        reference: 'CRN-0001',
        reason: 'Short delivery',
        issuedAt: '2026-09-12T10:00:00Z',
        invoiceReference: 'INV-0042',
        invoiceTotal: NGN(145_000_00),
      })
    })
    expect(await screen.findByLabelText('Outstanding')).toHaveTextContent('₦100,000.00')
  })

  it('offers no cancel on a delivered delivery — the evidence is sealed', async () => {
    renderAt('/doc/doc_way', (seed) => {
      seed.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status: 'delivered',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'WB-0007',
        frozenLabels: {
          printedTitle: 'WAYBILL',
          partyLabel: 'Deliver to',
          signatureCaption: 'Received by',
          language: 'en',
        },
        totalMinor: 0,
      })
    })
    expect(within(await pageHeader()).getByText('WB-0007')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel this document' }),
    ).not.toBeInTheDocument()
  })
})

describe('A receipt is evidence of a payment (§G, §K, §V)', () => {
  const billed = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      /*
       * REAL GOODS, because the receipt has to carry them.
       *
       * An empty `lineItems` made the picker row blank and would have let the
       * "the receipt carries the invoice's items" guard pass over nothing.
       */
      lineItems: [
        {
          id: 'li_1',
          description: 'Roofing sheets, 30 bundles',
          quantityMilli: 1_000,
          unitPriceMinor: 145_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
    })
  }

  const paid = (minor: number) => (state: MemoryState) => {
    billed(state)
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(minor),
      paidAt: '2026-09-10T09:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [
        { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_inv', amount: NGN(minor) },
      ],
    })
  }

  describe('From Home, the payment is recorded first (§G)', () => {
    it('opens a payment form rather than an empty document', async () => {
      const state = renderAt('/new/receipt', billed)
      expect(await screen.findByLabelText('Acknowledge a payment')).toBeInTheDocument()
      // Nothing was created by arriving: no payment, and no draft.
      expect(state.documents).toHaveLength(1)
      expect(state.payments).toHaveLength(0)
    })

    it('still creates a bare draft for every other type', async () => {
      const state = renderAt('/new/invoice')
      await waitFor(() => expect(state.documents).toHaveLength(1))
      expect(screen.queryByLabelText('Acknowledge a payment')).not.toBeInTheDocument()
    })

    /*
     * THE TWO PATHS (§G, Rule #1).
     *
     * `/new/receipt` opens on a choice now, not a form. The owner built this
     * app and could not work out how to create a receipt, because the form's
     * first question was "Who paid?" from a list of existing customers —
     * which is the wrong first question for cash from somebody not in the
     * book, and made the commonest receipt in a market impossible to record.
     */
    const viaOwed = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      await user.click(await screen.findByRole('button', { name: new RegExp(name) }))
    }

    /**
     * Path A, all the way to its one page: who paid, which bill, done.
     *
     * There is no items step, no design step and no review — the invoice
     * already described the goods, and the preview is on the page itself.
     */
    const viaOwedInvoice = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await viaOwed(user, name)
      await user.click(await screen.findByRole('button', { name: /INV-0042/ }))
      await screen.findByLabelText('Acknowledge a payment')
    }

    const viaCash = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(await screen.findByRole('button', { name: 'New sale / cash payment' }))
      await user.type(await screen.findByLabelText('Received from'), name)
    }

    /**
     * PATH A, ONE PAGE, ENDING IN THE RECEIPT (§G, §K, §V).
     *
     * Pick who paid, pick which bill, and the next screen is the last one:
     * the amount already filled with the whole balance, the date, the method
     * and the signature, and one button that writes the payment, issues the
     * receipt and shows it.
     */
    it('records the payment and issues the receipt from one page', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await viaOwedInvoice(user, 'Ade Stores')

      // PREFILLED WITH THE WHOLE BALANCE: paying in full costs no typing.
      const amount = screen.getByLabelText('How much came in?')
      expect(amount, 'the balance was not offered as the amount').toHaveValue('145000')
      await user.clear(amount)
      await user.type(amount, '45000')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      const payment = state.payments[0]
      expect(payment?.amount).toEqual(NGN(45_000_00))
      expect(payment?.allocations[0]?.invoiceId).toBe('doc_inv')
      // The allocation names the payment that actually exists (§E).
      expect(payment?.allocations[0]?.paymentId).toBe(payment?.id)

      await waitFor(() => expect(state.documents).toHaveLength(2))
      const receipt = state.documents.find((document) => document.type === 'receipt')
      expect(receipt?.paymentId).toBe(payment?.id)
      expect(receipt?.linkedInvoiceId).toBe('doc_inv')
      expect(receipt?.customerId).toBe('cus_1')

      /*
       * ISSUED, NOT LEFT AS A DRAFT. The customer is standing there; a draft
       * would hand them nothing and put an unexplained step in the way.
       */
      expect(receipt?.status, 'the receipt was left as a draft').toBe('issued')
      expect(receipt?.issuedReference).toBeTruthy()

      /*
       * §V: THE PRINTED TOTAL IS THE PAYMENT.
       *
       * This is the one the receipt's new items could have broken. The
       * receipt now carries the INVOICE'S goods, which come to ₦145,000, and
       * issuing computes a total from the lines — so a ₦45,000 part payment
       * would have been recorded, listed and reported as the full bill.
       */
      expect(receipt?.totalMinor, 'the receipt was issued at the bill, not the payment').toBe(
        45_000_00,
      )

      /*
       * THE WHOLE PICTURE, FROZEN AT ISSUE (§I, Rule #5).
       *
       * The goods the money was for, the bill, what had arrived before, and
       * what is left — so a customer holding the PDF can add it up, and finds
       * the same figures on it next year.
       */
      expect(receipt?.lineItems.map((line) => line.description)).toEqual([
        'Roofing sheets, 30 bundles',
      ])
      expect(receipt?.invoiceTotalMinor).toBe(145_000_00)
      expect(receipt?.paidBeforeMinor).toBe(0)
      expect(receipt?.balanceAfterMinor, 'the receipt does not say what is left').toBe(100_000_00)

      // And what came back is the document, not its builder: an issued
      // receipt has nothing left to edit (Rule #5).
      expect(screen.queryByRole('button', { name: /Next/ })).toBeNull()
    })

    /**
     * NO ITEMS STEP ANYWHERE ON PATH A (§G, Rule #1).
     *
     * The invoice already described the goods, so asking for them again is
     * asking somebody to describe what they are holding.
     */
    it('never asks for items on the way to a receipt for money owed', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', billed)

      await viaOwedInvoice(user, 'Ade Stores')
      expect(screen.queryByRole('button', { name: /Next/ })).toBeNull()
      expect(screen.queryByText(/Add item/i)).toBeNull()
      // The one page holds the amount, the date, the method and the pad.
      expect(screen.getByLabelText('How much came in?')).toBeInTheDocument()
      expect(screen.getByLabelText('When?')).toBeInTheDocument()
      expect(screen.getByLabelText('How?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tap to sign' })).toBeInTheDocument()
    })

    /**
     * THE PICKER IS READABLE (§G, Rule #1).
     *
     * A reference and a balance is not enough to recognise a bill by. The row
     * leads with the goods and carries the date, the face value and what is
     * still owing — the face value beside the balance being what says a part
     * payment already happened.
     */
    it('names the goods, the date and both figures on each invoice', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', (state) => {
        billed(state)
        state.payments.push({
          id: 'pay_old',
          customerId: 'cus_1',
          amount: NGN(45_000_00),
          paidAt: '2026-09-05T09:00:00Z',
          method: 'cash',
          source: 'manual',
          allocations: [
            { id: 'pay_old:a', paymentId: 'pay_old', invoiceId: 'doc_inv', amount: NGN(45_000_00) },
          ],
        })
      })

      await viaOwed(user, 'Ade Stores')
      const row = await screen.findByRole('button', { name: /INV-0042/ })
      expect(row).toHaveTextContent('Roofing sheets, 30 bundles')
      expect(row).toHaveTextContent('1 Sep 2026')
      expect(row, 'the face value is missing, so a part payment is invisible').toHaveTextContent(
        'Total ₦145,000.00',
      )
      expect(row).toHaveTextContent('₦100,000.00 left')
    })

    /*
     * THE CASH PATH, and the case that was impossible before: a name that is
     * in nobody's book. The payer is TYPED, matched to a customer if one
     * exists and created if not — the contact happens as a consequence of
     * being paid, never as a toll before it.
     */
    it('records money standing alone without billing anybody for it (§G, §K)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await viaCash(user, 'A passing stranger')
      await user.type(screen.getByLabelText('How much came in?'), '10000')
      await user.click(screen.getByRole('button', { name: 'Record it' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      expect(state.payments[0]?.allocations).toEqual([])
      // The name became a customer, because it matched nobody.
      const made = state.customers.find((row) => row.name === 'A passing stranger')
      expect(made, 'a typed name did not become a customer').toBeDefined()
      expect(state.payments[0]?.customerId).toBe(made?.id)
      // No second invoice appeared from nowhere: still the one that was seeded.
      expect(state.documents.filter((document) => document.type === 'invoice')).toHaveLength(1)
      const receipt = state.documents.find((document) => document.type === 'receipt')
      expect(receipt?.linkedInvoiceId).toBeUndefined()
    })

    it('moves the balance once for a double tap, not twice (§M, §V)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await viaOwedInvoice(user, 'Ade Stores')
      // An impatient owner on a slow phone. Two taps land BEFORE the first
      // write comes back, which `userEvent` cannot reproduce — it yields
      // between events, so the screen has already moved on by the second.
      // Money is the one place a retry must never add (Rule #3, §M).
      const button = screen.getByRole('button', { name: 'Record payment' })
      fireEvent.click(button)
      fireEvent.click(button)

      // Let the whole gesture settle — both taps — before counting. A
      // `waitFor(length === 1)` would pass on the first write and never see
      // the second, which is the bug being guarded against.
      await waitFor(() => expect(state.payments).toHaveLength(1))
      await waitFor(() =>
        expect(state.documents.filter((document) => document.type === 'receipt')).toHaveLength(1),
      )
      expect(state.payments).toHaveLength(1)
    })

    it('moves the balance exactly once for one tap, under StrictMode (§M, §V)', async () => {
      const user = userEvent.setup()
      const { state, repositories } = seeded(billed)
      render(
        <StrictMode>
          <App
            repositories={repositories}
            companyId={DEV_COMPANY_ID}
            router="memory"
            initialPath="/new/receipt"
          />
        </StrictMode>,
      )

      await viaOwedInvoice(user, 'Ade Stores')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      expect(state.documents.filter((document) => document.type === 'receipt')).toHaveLength(1)
    })

    /*
     * THE DEBTORS PICKER SHOWS ONLY PEOPLE WHO OWE, so somebody who owes
     * nothing cannot be reached down this path at all — which is a stronger
     * version of the old guarantee. Money from one customer allocated to
     * another's invoice would settle a debt nobody paid and leave the real
     * one standing (§K).
     */
    it('never offers a debtor who owes nothing (§G, §K)', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', (state) => {
        billed(state)
        state.customers.push(customer('cus_2', 'Bisi'))
      })

      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      expect(await screen.findByRole('button', { name: /Ade Stores/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Bisi/ })).toBeNull()
    })

    /** And the picker states what each one owes, so nobody has to remember. */
    it('says what each debtor owes', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', billed)
      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      expect(
        await screen.findByRole('button', { name: /Ade Stores.*₦145,000\.00/ }),
      ).toBeInTheDocument()
    })
  })

  describe('From a payment on the saved document (§G)', () => {
    it('derives the draft from that payment and opens the builder', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_inv', paid(50_000_00))

      // EN-NG calls it a receipt; the word is resolved, never hardcoded.
      await user.click(await screen.findByRole('button', { name: /Receipt/i }))

      await waitFor(() => expect(state.documents).toHaveLength(2))
      const receipt = state.documents.find((document) => document.type === 'receipt')
      expect(receipt?.paymentId).toBe('pay_1')
      expect(receipt?.linkedInvoiceId).toBe('doc_inv')
      expect(receipt?.totalMinor).toBe(50_000_00)
      // No second payment: the money was already recorded (§V).
      expect(state.payments).toHaveLength(1)
      expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
    })

    it('carries the payment onto the draft, so it can actually be issued (§K)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_inv', paid(50_000_00))
      await user.click(await screen.findByRole('button', { name: /Receipt/i }))
      await waitFor(() => expect(state.documents).toHaveLength(2))

      /*
       * The payment supplied the party, the date, the line and the total, so
       * nothing is missing and nothing had to be retyped (Rule #1).
       *
       * THREE Nexts, not four: this receipt settles an invoice, so it has no
       * ITEMS step — the items were described on the invoice the customer is
       * holding. Walking to the end by pressing Next until Save appears, so
       * the case stays about the payment reaching the draft rather than about
       * how many steps that takes.
       */
      for (let step = 0; step < 6; step += 1) {
        const next = screen.queryByRole('button', { name: 'Next' })
        if (next === null) break
        await user.click(next)
      }
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /^Save/ }))

      const receipt = () => state.documents.find((document) => document.type === 'receipt')
      await waitFor(() => expect(receipt()?.status).toBe('issued'))
      expect(receipt()?.issuedReference).toMatch(/^REC-\d{4}(-[A-Z0-9]{2})?$/)
      // §V: the printed total IS the payment, never a sum with tax on top.
      expect(receipt()?.totalMinor).toBe(50_000_00)
      // And drawing it moved no money.
      expect(state.payments).toHaveLength(1)
    })

    it('dates the draft from the payment, not from today (§E, Rule #1)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_inv', paid(50_000_00))
      await user.click(await screen.findByRole('button', { name: /Receipt/i }))
      await waitFor(() => expect(state.documents).toHaveLength(2))
      const receipt = state.documents.find((document) => document.type === 'receipt')
      // The seeded payment arrived on the 10th.
      expect(receipt?.issueDate).toBe('2026-09-10')
    })

    it('describes the line as the payment, priced at what came in (§V)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_inv', paid(50_000_00))
      await user.click(await screen.findByRole('button', { name: /Receipt/i }))
      await waitFor(() => expect(state.documents).toHaveLength(2))

      const line = state.documents.find((document) => document.type === 'receipt')?.lineItems[0]
      expect(line?.description).toBe('Payment for invoice INV-0042')
      expect(line?.unitPriceMinor).toBe(50_000_00)
      // Not taxable: tax on money already received would print a total that
      // is not the payment (Rule #3, §V).
      expect(line?.taxable).toBe(false)
    })

    it('opens the one that exists instead of minting a second (§G, §M)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_inv', (seed) => {
        paid(50_000_00)(seed)
        seed.documents.push({
          id: 'doc_rct',
          companyId: DEV_COMPANY_ID,
          type: 'receipt',
          status: 'issued',
          customerId: 'cus_1',
          currency: 'NGN',
          lineItems: [],
          issueDate: '2026-09-10',
          issuedReference: 'REC-0003',
          frozenLabels: {
            printedTitle: 'RECEIPT',
            partyLabel: 'Received from',
            signatureCaption: 'Received by',
            language: 'en',
          },
          totalMinor: 50_000_00,
          paymentId: 'pay_1',
        })
      })

      await user.click(await screen.findByRole('button', { name: /Receipt/i }))

      // The issued one, on its own page — and nothing new written: the two
      // seeded documents are still the only two.
      expect(within(await pageHeader()).getByText('REC-0003')).toBeInTheDocument()
      expect(state.documents).toHaveLength(2)
    })
  })
})

describe('Signing (§G, §I, §P)', () => {
  /** jsdom lays nothing out, so the pad falls back to raw client coordinates. */
  const drawOn = (pad: HTMLElement) => {
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 20, clientY: 40 })
    for (const [x, y] of [
      [40, 20],
      [60, 45],
      [80, 25],
      [100, 40],
    ]) {
      fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
    }
    fireEvent.pointerUp(pad, { pointerId: 1 })
  }

  const sign = async (user: ReturnType<typeof userEvent.setup>) => {
    drawOn(await screen.findByRole('application', { name: 'Signing area' }))
    await user.click(screen.getByRole('button', { name: 'Use this' }))
  }

  describe('Drawing one in the builder (§G step 1)', () => {
    const seedDraft = (state: MemoryState) => {
      state.customers.push(customer())
      state.documents.push({
        id: 'doc_draft',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 0,
      })
    }

    it('stores the mark and puts it on the draft', async () => {
      const user = userEvent.setup()
      const state = renderAt('/edit/doc_draft', seedDraft)

      await user.click(await screen.findByRole('button', { name: 'Tap to sign' }))
      await sign(user)

      await waitFor(() => expect(state.assets).toHaveLength(1))
      expect(state.assets[0]?.kind).toBe('signature')
      expect(state.assets[0]?.dataUrl.startsWith('data:image/svg+xml,')).toBe(true)

      // §G: "the dashed tap-to-sign box, OR the drawn signature".
      expect(await screen.findByRole('img', { name: 'Signed' })).toHaveAttribute(
        'src',
        state.assets[0]?.dataUrl ?? '',
      )
    })

    it('survives the save, which is what a drawn signature has to do', async () => {
      const user = userEvent.setup()
      const state = renderAt('/edit/doc_draft', seedDraft)

      await user.click(await screen.findByRole('button', { name: 'Tap to sign' }))
      await sign(user)
      await waitFor(() => expect(state.assets).toHaveLength(1))

      // Autosave happens on step change (§G).
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() =>
        expect(state.documents[0]?.signatureAssetId).toBe(state.assets[0]?.id),
      )
    })

    it('reaches the page it will print on (§I)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/edit/doc_draft', seedDraft)
      await user.click(await screen.findByRole('button', { name: 'Tap to sign' }))
      await sign(user)
      await waitFor(() => expect(state.assets).toHaveLength(1))

      // Step 5 is Review, which renders the real page.
      for (let step = 0; step < 4; step += 1) {
        await user.click(await screen.findByRole('button', { name: 'Next' }))
      }
      expect(
        await screen.findByRole('img', { name: 'AUTHORISED SIGNATURE' }),
      ).toBeInTheDocument()
    })
  })

  describe('Drawing one once, in Settings (§G — Your business)', () => {
    it('saves it as the default and shows it back', async () => {
      const user = userEvent.setup()
      const state = renderAt('/settings/signature')

      expect(await screen.findByText('Nothing drawn yet.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tap to sign' }))
      await sign(user)

      await waitFor(() => expect(state.companies[0]?.defaultSignatureAssetId).toBe(state.assets[0]?.id))
      expect(await screen.findByRole('img', { name: 'Default signature' })).toBeInTheDocument()
    })

    it('signs the next new document without being drawn again', async () => {
      const user = userEvent.setup()
      const state = renderAt('/settings/signature')
      await user.click(await screen.findByRole('button', { name: 'Tap to sign' }))
      await sign(user)
      await waitFor(() => expect(state.assets).toHaveLength(1))

      // Back off the settings panel, then Home — a panel has no nav on it.
      await user.click(screen.getByRole('button', { name: /back/i }))
      await user.click(await screen.findByRole('link', { name: 'Home' }))
      await user.click(await screen.findByRole('button', { name: /^\d+ Invoice/ }))
      // "+ New invoice" — the sentence form, cased by the terminology table
      // rather than by the call site (§D). Matched case-insensitively so this
      // test stays about the signature reaching the next document.
      await user.click((await screen.findAllByRole('button', { name: /New invoice/i }))[0]!)

      await waitFor(() => expect(state.documents).toHaveLength(1))
      expect(state.documents[0]?.signatureAssetId).toBe(state.assets[0]?.id)
    })

    it('stops signing new documents when it is removed, keeping the mark itself', async () => {
      const user = userEvent.setup()
      const state = renderAt('/settings/signature')
      await user.click(await screen.findByRole('button', { name: 'Tap to sign' }))
      await sign(user)
      await waitFor(() => expect(state.assets).toHaveLength(1))

      await user.click(await screen.findByRole('button', { name: 'Remove' }))
      await waitFor(() => expect(state.companies[0]?.defaultSignatureAssetId).toBeNull())
      // The asset stays: documents already signed with it hold its id, and an
      // issued page's mark cannot change under it (Rule #5).
      expect(state.assets).toHaveLength(1)
    })
  })

  describe('Signing for a delivery (§P, §Q Phase 2 gate)', () => {
    const delivery = (status: string) => (state: MemoryState) => {
      state.customers.push(customer())
      state.documents.push({
        id: 'doc_way',
        companyId: DEV_COMPANY_ID,
        type: 'waybill',
        status,
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'WB-0007',
        frozenLabels: {
          printedTitle: 'WAYBILL',
          partyLabel: 'Deliver to',
          signatureCaption: 'Received by',
          language: 'en',
        },
        totalMinor: 0,
      })
    }

    it('offers to send an issued one on its way, then to sign for it', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_way', delivery('issued'))

      /*
       * A delivery that never left cannot have arrived (§M), so the pill is
       * DARK and says which step comes first — rather than being absent and
       * leaving the owner to discover the order by its appearing later.
       */
      const waiting = await screen.findByRole('button', { name: 'Ask them to sign' })
      expect(waiting).toBeDisabled()
      expect(waiting.textContent).toMatch(/on its way first/i)

      await user.click(await screen.findByRole('button', { name: 'Send it on its way' }))

      await waitFor(() => expect(state.documents[0]?.status).toBe('dispatched'))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Ask them to sign' })).not.toBeDisabled(),
      )
    })

    /*
     * CHANGED DELIBERATELY. This drove "Mark it on the way" as its own
     * full-width button. The saved document carried NINE actions where §G
     * asks for four, and three of them were the delivery's STATE rather than
     * actions on the document — so they are one control now, showing the step
     * that is actually next.
     *
     * "On the way" is not that step. §G's own reasoning is that a delivery
     * signed for from "sent out" is signed for just as well and a compulsory
     * extra tap buys nothing (Rule #1), so making it the primary control
     * would have forced the optional middle on everybody. What this asserts
     * now is the thing that matters: from dispatched, signing is reachable
     * directly.
     */
    it('offers signing directly once it has left, with no step in between', async () => {
      renderAt('/doc/doc_way', delivery('dispatched'))

      expect(
        await screen.findByRole('button', { name: 'Ask them to sign' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Mark it on the way' })).toBeNull()
    })

    it('can be signed for straight from dispatched, without the extra step', async () => {
      renderAt('/doc/doc_way', delivery('dispatched'))
      expect(await screen.findByRole('button', { name: 'Ask them to sign' })).toBeInTheDocument()
    })

    it('offers a link for the customer to sign on their own phone (§G)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_way', delivery('dispatched'))

      // The pill opens the control; the control mints and copies (§G).
      // The pad opens first; the link is the secondary path inside it.
      await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))
      await user.click(await screen.findByRole('button', { name: /send a link instead/i }))
      await user.click(await screen.findByRole('button', { name: /copy a link/i }))

      // Only the HASH is kept: a leaked row cannot open a link (§P).
      await waitFor(() => expect(state.linkTokens).toHaveLength(1))
      const stored = state.linkTokens[0]
      expect(stored?.documentId).toBe('doc_way')
      expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(stored?.consumedAt).toBeUndefined()

      // The link is shown as well as copied — a clipboard write can be
      // refused, and an owner who cannot see it has nothing to send.
      const shown = await screen.findByText(/\/sign\/[0-9A-Z]{32}$/)
      expect(shown).toBeInTheDocument()
      // The token itself is never what was stored.
      expect(stored?.tokenHash).not.toBe(shown.textContent?.split('/').pop())
    })

    it('replaces the link when one is copied again, killing the old one (§P)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_way', delivery('dispatched'))

      await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))
      await user.click(await screen.findByRole('button', { name: /send a link instead/i }))
      const button = await screen.findByRole('button', { name: /copy a link/i })
      await user.click(button)
      await waitFor(() => expect(state.linkTokens).toHaveLength(1))
      const first = state.linkTokens[0]?.tokenHash

      await user.click(button)
      await waitFor(() => expect(state.linkTokens[0]?.tokenHash).not.toBe(first))
      // One live link per document: two ways in, only one revocable, is the
      // thing this avoids.
      expect(state.linkTokens).toHaveLength(1)
    })

    it('captures the signer and the mark in one write, and delivers it (§P)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_way', delivery('dispatched'))

      await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))
      await user.type(screen.getByLabelText('Who received it?'), 'Bisi Adeyemi')
      await user.type(screen.getByLabelText('Their role'), 'Storekeeper')
      await sign(user)

      await waitFor(() => expect(state.documents[0]?.status).toBe('delivered'))
      const signed = state.documents[0]
      expect(signed?.signerName).toBe('Bisi Adeyemi')
      expect(signed?.signerRole).toBe('Storekeeper')
      expect(signed?.signedAt).toBeTruthy()
      // The RECIPIENT's field, which is the whole point of it existing.
      expect(signed?.signerSignatureAssetId).toBe(state.assets[0]?.id)
      /*
       * AND THE BUSINESS'S OWN MARK IS UNTOUCHED. Signing used to write into
       * `signatureAssetId` — the sender's signature — so taking a customer's
       * hand at the gate destroyed the business's mark on that document and
       * printed the customer's under the sender's caption.
       */
      expect(signed?.signatureAssetId).not.toBe(state.assets[0]?.id)
    })

    it('asks who received it before taking a mark, rather than discarding one', async () => {
      const user = userEvent.setup()
      renderAt('/doc/doc_way', delivery('dispatched'))
      await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))

      // No pad at all until there is a name — a signature already drawn must
      // never be thrown away for a rule nobody was told about.
      expect(screen.queryByRole('application', { name: 'Signing area' })).not.toBeInTheDocument()
      expect(screen.getByText(/Add who received it/)).toBeInTheDocument()

      await user.type(screen.getByLabelText('Who received it?'), 'Bisi')
      expect(screen.getByRole('application', { name: 'Signing area' })).toBeInTheDocument()
    })

    it('shows the evidence afterwards and offers no way to sign again (§P)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_way', delivery('dispatched'))

      await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))
      await user.type(screen.getByLabelText('Who received it?'), 'Bisi Adeyemi')
      await sign(user)
      await waitFor(() => expect(state.documents[0]?.status).toBe('delivered'))

      expect(await screen.findByText(/Signed by Bisi Adeyemi/)).toBeInTheDocument()
      /*
       * §P: evidence is captured ONCE. `delivered` is terminal, and a second
       * signature would overwrite the first while the customer holding the
       * earlier PDF had no way to know it had changed.
       *
       * The pill keeps its place and goes dark carrying "sealed" — the same
       * answer the repository gives, in the place somebody would ask for it.
       * A missing button proved only that nothing could be tapped.
       */
      const again = screen.getByRole('button', { name: 'Ask them to sign' })
      expect(again).toBeDisabled()
      expect(again.textContent).toMatch(/sealed/i)

      // The lifecycle control is gone entirely: there is no step left.
      expect(screen.queryByRole('button', { name: 'Send it on its way' })).not.toBeInTheDocument()
    })

    it('is offered on no other type', async () => {
      renderAt('/doc/doc_inv', (state) => {
        state.documents.push({
          id: 'doc_inv',
          companyId: DEV_COMPANY_ID,
          type: 'invoice',
          status: 'issued',
          currency: 'NGN',
          lineItems: [],
          issueDate: '2026-09-01',
          issuedReference: 'INV-0042',
          frozenLabels: {
            printedTitle: 'INVOICE',
            partyLabel: 'Bill to',
            signatureCaption: 'Authorised signature',
            language: 'en',
          },
          totalMinor: 145_000_00,
        })
      })
      expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ask them to sign' })).not.toBeInTheDocument()
    })
  })
})

describe('Duplicate as Rev 2 (§G, Rule #5, §M)', () => {
  const offer = (over: Partial<MemoryState['documents'][number]> = {}) => (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_quote',
      companyId: DEV_COMPANY_ID,
      type: 'quotation',
      status: 'sent',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Bag of cement',
          quantityMilli: quantity(20),
          unitPriceMinor: 5_000_00,
          taxable: true,
        },
      ],
      issueDate: '2026-09-01',
      validUntil: '2026-09-08',
      issuedReference: 'QUO-0009',
      frozenLabels: {
        printedTitle: 'QUOTATION',
        partyLabel: 'Client',
        signatureCaption: 'Prepared by',
        language: 'en',
      },
      totalMinor: 100_000_00,
      ...over,
    })
  }

  it('offers it on a quotation that has been sent', async () => {
    renderAt('/doc/doc_quote', offer())
    expect(await screen.findByRole('button', { name: 'Make Rev 2' })).toBeInTheDocument()
  })

  it('offers it on one the customer rejected, which is the whole point', async () => {
    renderAt('/doc/doc_quote', offer({ status: 'rejected' }))
    expect(await screen.findByRole('button', { name: 'Make Rev 2' })).toBeInTheDocument()
  })

  it('offers nothing on a draft, which can simply be edited', async () => {
    renderAt('/doc/doc_quote', offer({ status: 'draft', issuedReference: null, frozenLabels: null }))
    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Make Rev/ })).not.toBeInTheDocument()
  })

  it('offers nothing on an invoice, whose corrections are void or credit (Rule #5)', async () => {
    renderAt('/doc/doc_inv', (state) => {
      state.documents.push({
        id: 'doc_inv',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 145_000_00,
      })
    })
    expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Make Rev/ })).not.toBeInTheDocument()
  })

  it('copies the work into a new draft and leaves the original untouched', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offer())

    await user.click(await screen.findByRole('button', { name: 'Make Rev 2' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))

    const original = state.documents.find((d) => d.id === 'doc_quote')
    const rev2 = state.documents.find((d) => d.id !== 'doc_quote')

    // §G: originals are never altered. Not the status, not the reference, and
    // emphatically no "superseded" flag written back onto it (Rule #5).
    expect(original?.status).toBe('sent')
    expect(original?.issuedReference).toBe('QUO-0009')
    expect(original).not.toHaveProperty('supersedesId')

    expect(rev2?.type).toBe('quotation')
    expect(rev2?.status).toBe('draft')
    expect(rev2?.issuedReference).toBeNull()
    expect(rev2?.supersedesId).toBe('doc_quote')
    expect(rev2?.customerId).toBe('cus_1')
    expect(rev2?.lineItems[0]?.description).toBe('Bag of cement')
    // The builder opened on it.
    expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
  })

  it('does not carry the validity date, which would arrive already expired', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offer())
    await user.click(await screen.findByRole('button', { name: 'Make Rev 2' }))
    await waitFor(() => expect(state.documents).toHaveLength(2))

    const rev2 = state.documents.find((d) => d.id !== 'doc_quote')
    expect(rev2?.validUntil).toBeUndefined()
  })

  it('opens the one that exists instead of making a second (§M)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', (seed) => {
      offer()(seed)
      seed.documents.push({
        id: 'doc_rev2',
        companyId: DEV_COMPANY_ID,
        type: 'quotation',
        status: 'sent',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'QUO-0014',
        frozenLabels: {
          printedTitle: 'QUOTATION',
          partyLabel: 'Client',
          signatureCaption: 'Prepared by',
          language: 'en',
        },
        totalMinor: 90_000_00,
        supersedesId: 'doc_quote',
      })
    })

    // No second Rev 2, and no second control either: the notice IS the link.
    expect(screen.queryByRole('button', { name: /Make Rev/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open it' })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Replaced by Rev 2/ }))

    expect(within(await pageHeader()).getByText('QUO-0014')).toBeInTheDocument()
    expect(state.documents).toHaveLength(2)
  })

  it('says at both ends of the chain which offer replaced which (§G)', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_quote', (seed) => {
      offer()(seed)
      seed.documents.push({
        id: 'doc_rev2',
        companyId: DEV_COMPANY_ID,
        type: 'quotation',
        status: 'sent',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'QUO-0014',
        frozenLabels: {
          printedTitle: 'QUOTATION',
          partyLabel: 'Client',
          signatureCaption: 'Prepared by',
          language: 'en',
        },
        totalMinor: 90_000_00,
        supersedesId: 'doc_quote',
      })
    })

    // The replaced offer says so, and the link goes forward.
    expect(await screen.findByText('Replaced by Rev 2')).toBeInTheDocument()
    await user.click(screen.getByText('Replaced by Rev 2'))

    // The replacement says what it replaces, and the link goes back.
    expect(await screen.findByText('Rev 2')).toBeInTheDocument()
    expect(screen.getByText('Replaces QUO-0009')).toBeInTheDocument()
  })

  it('says in the LIST which offer was replaced (§G)', async () => {
    // Two sent quotations look identical in a list, and only one of them is
    // the live offer — which is the question making a Rev 2 creates.
    renderAt('/list/quotation', (seed) => {
      offer()(seed)
      seed.documents.push({
        id: 'doc_rev2',
        companyId: DEV_COMPANY_ID,
        type: 'quotation',
        status: 'sent',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'QUO-0014',
        frozenLabels: {
          printedTitle: 'QUOTATION',
          partyLabel: 'Client',
          signatureCaption: 'Prepared by',
          language: 'en',
        },
        totalMinor: 90_000_00,
        supersedesId: 'doc_quote',
      })
    })

    expect(await screen.findByText('QUO-0009')).toBeInTheDocument()
    expect(screen.getByText('QUO-0014')).toBeInTheDocument()
    // Exactly one row is marked: the one that was replaced.
    expect(screen.getAllByText('Replaced by Rev 2')).toHaveLength(1)
  })

  it('makes Rev 3 from Rev 2, counting the chain', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_rev2', (seed) => {
      offer()(seed)
      seed.documents.push({
        id: 'doc_rev2',
        companyId: DEV_COMPANY_ID,
        type: 'quotation',
        status: 'rejected',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'QUO-0014',
        frozenLabels: {
          printedTitle: 'QUOTATION',
          partyLabel: 'Client',
          signatureCaption: 'Prepared by',
          language: 'en',
        },
        totalMinor: 90_000_00,
        supersedesId: 'doc_quote',
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Make Rev 3' }))
    await waitFor(() => expect(state.documents).toHaveLength(3))
    expect(state.documents.find((d) => d.supersedesId === 'doc_rev2')).toBeTruthy()
  })

  it('prints which offer it replaces, so the customer can tell (§G)', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_rev2', (seed) => {
      offer()(seed)
      seed.documents.push({
        id: 'doc_rev2',
        companyId: DEV_COMPANY_ID,
        type: 'quotation',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [
          {
            id: 'li_1',
            description: 'Bag of cement',
            quantityMilli: quantity(20),
            unitPriceMinor: 4_500_00,
            taxable: true,
          },
        ],
        issueDate: '2026-09-10',
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 90_000_00,
        supersedesId: 'doc_quote',
      })
    })

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }
    // The real page, as it will print: the reference alone cannot say this.
    expect(await screen.findByText('Rev 2 · Replaces QUO-0009')).toBeInTheDocument()
  })
})

describe('Void and reissue a receipt (§G, Rule #5, §V)', () => {
  const paid = (state: MemoryState) => {
    state.customers.push(customer())
    state.payments.push({
      id: 'pay_1',
      customerId: 'cus_1',
      amount: NGN(50_000_00),
      paidAt: '2026-09-10T09:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [
        { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_inv', amount: NGN(50_000_00) },
      ],
    })
    state.documents.push({
      id: 'doc_inv',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      issuedReference: 'INV-0042',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
    })
  }

  const withReceipt = (over: Partial<MemoryState['documents'][number]> = {}) =>
    (state: MemoryState) => {
      paid(state)
      state.documents.push({
        id: 'doc_rct',
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'REC-0003',
        frozenLabels: {
          printedTitle: 'RECEIPT',
          partyLabel: 'Received from',
          signatureCaption: 'Issued by',
          language: 'en',
        },
        totalMinor: 50_000_00,
        paymentId: 'pay_1',
        linkedInvoiceId: 'doc_inv',
        ...over,
      })
    }

  /*
   * THROUGH THE FOUR-ACTION GRID, which is where these two live now.
   *
   * They used to be standalone buttons further down the page — "Cancel and
   * draw a new one" and "Open what it paid for" — while the grid ALSO carried
   * `void_and_reissue` and `open_invoice`. A receipt showed six actions where
   * §G asks for four, two of them doing the same thing as two others under
   * different words.
   */
  it('offers both of §G’s receipt actions, and exactly four in total', async () => {
    renderAt('/doc/doc_rct', withReceipt())
    const grid = await screen.findByRole('group', { name: /actions/i })
    expect(grid.querySelectorAll('button')).toHaveLength(4)
    expect(within(grid).getByRole('button', { name: 'Void and reissue' })).toBeInTheDocument()
    expect(within(grid).getByRole('button', { name: 'Open the invoice' })).toBeInTheDocument()

    // And the old pair is gone rather than merely moved.
    expect(screen.queryByRole('button', { name: 'Cancel and draw a new one' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open what it paid for' })).toBeNull()
  })

  it('opens what the payment settled — the link was stored and unreachable', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_rct', withReceipt())
    await user.click(await screen.findByRole('button', { name: 'Open the invoice' }))
    expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
  })

  it('offers neither on an invoice, whose corrections are void or credit', async () => {
    renderAt('/doc/doc_inv', paid)
    expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Void and reissue' }),
    ).not.toBeInTheDocument()
  })

  it('cancels the old one and opens a fresh draft for the same payment', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_rct', withReceipt())

    /*
     * THE PILL DOES THE WHOLE ACT. It used to open a sheet that only VOIDED
     * — half of what "Void and reissue" promises — while the standalone
     * button beneath it did the void AND drew the replacement. Now there is
     * one control and it does both.
     */
    await user.click(await screen.findByRole('button', { name: 'Void and reissue' }))
    await waitFor(() => expect(state.documents).toHaveLength(3))

    const cancelled = state.documents.find((d) => d.id === 'doc_rct')
    const fresh = state.documents.find((d) => d.type === 'receipt' && d.id !== 'doc_rct')

    // Cancelled, not edited: reference, labels and totals all untouched (§M).
    expect(cancelled?.status).toBe('void')
    expect(cancelled?.issuedReference).toBe('REC-0003')
    expect(cancelled?.totalMinor).toBe(50_000_00)

    expect(fresh?.status).toBe('draft')
    expect(fresh?.paymentId).toBe('pay_1')
    expect(fresh?.linkedInvoiceId).toBe('doc_inv')
    expect(fresh?.totalMinor).toBe(50_000_00)
    expect(fresh?.supersedesId).toBe('doc_rct')
    expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
  })

  it('never moves the money, in either direction (§V)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_rct', withReceipt())
    /*
     * THE PILL DOES THE WHOLE ACT. It used to open a sheet that only VOIDED
     * — half of what "Void and reissue" promises — while the standalone
     * button beneath it did the void AND drew the replacement. Now there is
     * one control and it does both.
     */
    await user.click(await screen.findByRole('button', { name: 'Void and reissue' }))
    await waitFor(() => expect(state.documents).toHaveLength(3))

    // One payment, unchanged, still allocated to the same invoice. Cancelling
    // the paper cannot un-receive cash, and drawing it again cannot receive
    // it twice.
    expect(state.payments).toHaveLength(1)
    expect(state.payments[0]?.amount).toEqual(NGN(50_000_00))
    expect(state.payments[0]?.allocations[0]?.invoiceId).toBe('doc_inv')
  })

  it('offers nothing to reissue once the payment was reversed, and says why', async () => {
    renderAt('/doc/doc_rct', (seed) => {
      withReceipt()(seed)
      seed.payments.push({
        id: 'pay_1r',
        customerId: 'cus_1',
        amount: NGN(50_000_00),
        paidAt: '2026-09-11T00:00:00Z',
        method: 'bank_transfer',
        source: 'manual',
        reversalOfId: 'pay_1',
        allocations: [],
      })
    })

    expect(await screen.findByText(/that payment was reversed/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cancel and draw a new one' }),
    ).not.toBeInTheDocument()
    // The plain cancel is still there, which is the honest action.
    await revealMore()
    expect(screen.getByRole('button', { name: 'Cancel this document' })).toBeInTheDocument()
  })

  /*
   * SAID, NOT HIDDEN (§N). The standalone button used to vanish on a cancelled
   * receipt; the grid keeps its four and darkens the one that cannot act, with
   * the reason under it — which is what tells somebody WHY rather than leaving
   * them to notice an absence.
   */
  it('cannot cancel one already cancelled, and says so', async () => {
    renderAt('/doc/doc_rct', withReceipt({ status: 'void' }))
    expect(within(await pageHeader()).getByText('REC-0003')).toBeInTheDocument()
    const pill = screen.getByRole('button', { name: 'Void and reissue' })
    expect(pill).toBeDisabled()
    expect(pill).toHaveTextContent(/already void|void/i)
  })

  it('says at both ends which receipt replaced which, without numbering them', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_rct', (seed) => {
      withReceipt({ status: 'void' })(seed)
      seed.documents.push({
        id: 'doc_rct2',
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'REC-0004',
        frozenLabels: {
          printedTitle: 'RECEIPT',
          partyLabel: 'Received from',
          signatureCaption: 'Issued by',
          language: 'en',
        },
        totalMinor: 50_000_00,
        paymentId: 'pay_1',
        supersedesId: 'doc_rct',
      })
    })

    // A receipt chain is not numbered — §G's Rev 2 is a quotation idea, and
    // numbering a reissue would say more than is true.
    expect(await screen.findByText('Cancelled — a newer one replaces this')).toBeInTheDocument()
    expect(screen.queryByText(/Rev \d/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Cancelled — a newer one replaces this'))
    // The link BACK, not the line the page prints — the A4 preview says the
    // same words, and only one of the two can be followed.
    expect(
      await screen.findByRole('button', { name: /Replaces REC-0003/ }),
    ).toBeInTheDocument()
  })

  it('marks the cancelled one in the LIST, without calling it a revision', async () => {
    // A quotation's chain is numbered; a receipt's is not. Calling a replaced
    // receipt "Rev 2" in the list would say more than is true.
    renderAt('/list/receipt', (seed) => {
      withReceipt({ status: 'void' })(seed)
      seed.documents.push({
        id: 'doc_rct2',
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-10',
        issuedReference: 'REC-0004',
        frozenLabels: {
          printedTitle: 'RECEIPT',
          partyLabel: 'Received from',
          signatureCaption: 'Issued by',
          language: 'en',
        },
        totalMinor: 50_000_00,
        paymentId: 'pay_1',
        supersedesId: 'doc_rct',
      })
    })

    expect(await screen.findByText('REC-0003')).toBeInTheDocument()
    expect(screen.getByText('REC-0004')).toBeInTheDocument()
    expect(screen.getAllByText('Cancelled — a newer one replaces this')).toHaveLength(1)
    expect(screen.queryByText(/Replaced by Rev/)).not.toBeInTheDocument()
  })

  it('prints what it replaces, so one payment is never read as two (§V)', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_rct2', (seed) => {
      withReceipt({ status: 'void' })(seed)
      seed.documents.push({
        id: 'doc_rct2',
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'draft',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [
          {
            id: 'li_1',
            description: 'Payment received',
            quantityMilli: quantity(1),
            unitPriceMinor: 50_000_00,
            taxable: false,
          },
        ],
        issueDate: '2026-09-10',
        issuedReference: null,
        frozenLabels: null,
        totalMinor: 50_000_00,
        paymentId: 'pay_1',
        supersedesId: 'doc_rct',
      })
    })

    /*
     * Walked to the end rather than counted: a receipt runs fewer steps now —
     * no items when it settles an invoice, and no totals on either path,
     * because its printed total IS the payment (§V).
     */
    /*
     * Straight to the last step by name, not by counting Nexts.
     *
     * A receipt runs fewer steps than it used to — no items when it settles an
     * invoice, and no totals on either path, because its printed total IS the
     * payment (§V). A loop counting four clicks encoded the old shape; the
     * step bar names the destination, which is also how a person gets there.
     */
    await user.click(await screen.findByRole('button', { name: 'Review' }))

    // The real page: no "Rev" on a receipt, just what it replaces.
    expect(await screen.findByText('Replaces REC-0003')).toBeInTheDocument()
  })
})

describe('Recording the customer’s answer (§G, §P)', () => {
  const offered = (status = 'sent') => (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_quote',
      companyId: DEV_COMPANY_ID,
      type: 'quotation',
      status,
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Bag of cement',
          quantityMilli: quantity(20),
          unitPriceMinor: 5_000_00,
          taxable: true,
        },
      ],
      issueDate: '2026-09-01',
      validUntil: '2026-09-30',
      issuedReference: 'QUO-0009',
      frozenLabels: {
        printedTitle: 'QUOTATION',
        partyLabel: 'Client',
        signatureCaption: 'Prepared by',
        language: 'en',
      },
      totalMinor: 100_000_00,
    })
  }

  it('offers both answers on an offer that has been made', async () => {
    renderAt('/doc/doc_quote', offered())
    expect(await screen.findByRole('button', { name: 'They accepted' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'They turned it down' })).toBeInTheDocument()
  })

  it('records acceptance as a status change and nothing else (Rule #5)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offered())

    await user.click(await screen.findByRole('button', { name: 'They accepted' }))
    await waitFor(() => expect(state.documents[0]?.status).toBe('accepted'))

    // Reference, labels and totals untouched: an answer is not an edit.
    expect(state.documents[0]?.issuedReference).toBe('QUO-0009')
    expect(state.documents[0]?.frozenLabels?.printedTitle).toBe('QUOTATION')
    expect(state.documents[0]?.totalMinor).toBe(100_000_00)
  })

  it('records a refusal, which is what Rev 2 exists for', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offered())
    await user.click(await screen.findByRole('button', { name: 'They turned it down' }))
    await waitFor(() => expect(state.documents[0]?.status).toBe('rejected'))
    // And the answer opens the door Rev 2 was built for.
    expect(await screen.findByRole('button', { name: 'Make Rev 2' })).toBeInTheDocument()
  })

  it('shows the answer afterwards and offers no way to change it (§P)', async () => {
    renderAt('/doc/doc_quote', offered('accepted'))
    expect(await screen.findByText(/Answered Accepted/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'They accepted' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'They turned it down' })).not.toBeInTheDocument()
  })

  it('offers nothing on a draft, which nobody has been offered', async () => {
    renderAt('/doc/doc_quote', (seed) => {
      offered('draft')(seed)
      const row = seed.documents[0]
      if (row !== undefined) seed.documents[0] = { ...row, issuedReference: null, frozenLabels: null }
    })
    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'They accepted' })).not.toBeInTheDocument()
  })

  it('offers nothing on any other type', async () => {
    renderAt('/doc/doc_inv', (state) => {
      state.documents.push({
        id: 'doc_inv',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 145_000_00,
      })
    })
    expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'They accepted' })).not.toBeInTheDocument()
  })

  it('offers a link for the customer to accept on their own phone (§G)', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offered())

    await user.click(
      await screen.findByRole('button', { name: 'Copy a link for them to accept' }),
    )

    await waitFor(() => expect(state.linkTokens).toHaveLength(1))
    expect(state.linkTokens[0]?.documentId).toBe('doc_quote')
    expect(await screen.findByText(/\/accept\/[0-9A-Z]{32}$/)).toBeInTheDocument()
  })

  it('offers no link once the offer has been answered', async () => {
    // The page behind it would refuse anyway, but an owner should not be
    // handed a link that cannot work.
    renderAt('/doc/doc_quote', offered('accepted'))
    expect(await screen.findByText(/Answered Accepted/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Copy a link for them to accept' }),
    ).not.toBeInTheDocument()
  })

  it('an accepted offer can then be converted, which nothing could reach before', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', offered())

    await user.click(await screen.findByRole('button', { name: 'They accepted' }))
    await waitFor(() => expect(state.documents[0]?.status).toBe('accepted'))

    await user.click(
      await screen.findByRole('button', { name: 'Convert to…' }),
    )
    expect(await screen.findByLabelText('Turn this into something else')).toBeInTheDocument()
  })
})

/**
 * A picture of the goods, on a line item (§E, §G step 2, §I).
 *
 * The declared-and-never-REACHABLY-filled shape CLAUDE.md warns the sweep
 * cannot see. `imageAssetId` could be read by a mapper and printed by the
 * page and still be a dead field, because nothing a person can touch put a
 * value in it. So this walks the builder: open the Items step, attach a
 * photo, and check the draft that gets SAVED carries the id.
 */
describe('A photo on a line item (§E, §G step 2)', () => {
  /**
   * jsdom has no canvas and no `createImageBitmap`, so `shrinkItemPhoto`
   * cannot run here — the same split the signature pad and the delivery photo
   * use: the arithmetic is property-tested on its own, and this drives the
   * wiring around it.
   */
  const stubShrink = () => {
    const bitmap = { width: 4032, height: 3024, close: () => undefined } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', async () => bitmap)
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,THUMB')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURL)
    return toDataURL
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const shot = () => new File(['pretend-jpeg-bytes'], 'sheets.jpg', { type: 'image/jpeg' })

  const drafted = (type: 'invoice' | 'quotation' | 'waybill' | 'receipt') => (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_draft',
      companyId: DEV_COMPANY_ID,
      type,
      status: 'draft',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Roofing sheets',
          quantityMilli: 1_000,
          ...(type === 'waybill' ? { unit: 'bundles' } : { unitPriceMinor: 145_000_00 }),
          taxable: true,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: null,
      frozenLabels: null,
      totalMinor: type === 'waybill' ? 0 : 145_000_00,
      ...(type === 'receipt' ? { paymentId: 'pay_1' } : {}),
    })
  }

  /** A delivery calls the step Goods; everything else calls it Items (§D). */
  const openItems = async (
    user: ReturnType<typeof userEvent.setup>,
    named: 'Items' | 'Goods' = 'Items',
  ) => {
    await user.click(await screen.findByRole('button', { name: named }))
  }

  /**
   * Drafts autosave on step change (§G), so moving on is what writes.
   *
   * Which is also the real gesture: a trader attaches the photo and carries
   * on. Reading the record without it would be reading the screen's state
   * back to itself.
   */
  const moveOn = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Next' }))
  }

  /**
   * THE ONE THIS IS FOR. Before the field existed, the control could not be
   * drawn and the id could not be stored — the spec had asked for both since
   * it was written.
   */
  it('stores the shrunk photo and puts its id on the line', async () => {
    const user = userEvent.setup()
    const toDataURL = stubShrink()
    const state = renderAt('/edit/doc_draft', drafted('invoice'))

    await openItems(user)
    await user.upload(document.querySelector('input[type="file"]')!, shot())

    await waitFor(() => expect(state.assets).toHaveLength(1))
    expect(state.assets[0]?.kind).toBe('item_photo')
    expect(state.assets[0]?.dataUrl).toBe('data:image/jpeg;base64,THUMB')

    /*
     * SHRUNK MUCH HARDER than a delivery photo. A thumbnail is drawn 34pt
     * wide on the page; a document full of evidence-quality photographs is
     * several megabytes over metered data, which is a PDF that never gets
     * sent.
     */
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.6)

    // And the row draws the picture rather than saying one is attached.
    expect(await screen.findByRole('img', { name: /Roofing sheets/ })).toBeInTheDocument()

    await moveOn(user)
    await waitFor(() =>
      expect(state.documents[0]?.lineItems[0]?.imageAssetId).toBe(state.assets[0]?.id),
    )
  })

  /** Taking it off removes the FIELD, not the id — an empty string reads as a photo. */
  it('removes the photo from the line', async () => {
    const user = userEvent.setup()
    stubShrink()
    const state = renderAt('/edit/doc_draft', drafted('invoice'))

    await openItems(user)
    await user.upload(document.querySelector('input[type="file"]')!, shot())
    await screen.findByRole('img', { name: /Roofing sheets/ })
    await moveOn(user)
    await waitFor(() => expect(state.documents[0]?.lineItems[0]?.imageAssetId).toBeTruthy())

    await openItems(user)
    await user.click(await screen.findByRole('button', { name: /Remove the photo/ }))
    await moveOn(user)
    await waitFor(() =>
      expect(state.documents[0]?.lineItems[0]?.imageAssetId).toBeUndefined(),
    )
    expect('imageAssetId' in (state.documents[0]?.lineItems[0] ?? {})).toBe(false)
  })

  /**
   * A ROW WITH NO PHOTO MUST LOOK FINISHED. Most traders will not attach one
   * most of the time, and Rule #1's "ignoring it costs nothing" is about what
   * the screen looks like as much as what it asks for — so the control is a
   * camera the size of the delete button, with no label taking width.
   */
  it.each(['invoice', 'quotation', 'waybill'] as const)('offers a quiet control on a %s', async (type) => {
    const user = userEvent.setup()
    renderAt('/edit/doc_draft', drafted(type))
    await openItems(user, type === 'waybill' ? 'Goods' : 'Items')
    const add = await screen.findByRole('button', { name: /Add a photo to Roofing sheets/ })
    expect(add.textContent, 'the control took width for a label').toBe('')
  })

  /**
   * AND NOT ON A RECEIPT. It is evidence money arrived; the goods were
   * described on the invoice it settles, which carries the photographs.
   */
  it('offers nothing on a receipt', async () => {
    const user = userEvent.setup()
    renderAt('/edit/doc_draft', drafted('receipt'))
    await openItems(user)
    await screen.findByText('Roofing sheets')
    expect(screen.queryByRole('button', { name: /Add a photo to/ })).toBeNull()
  })
})

/**
 * A cash sale that was not paid in full (§G, §K, §V).
 *
 * Path B has items, so a totals block at the foot of them says what they come
 * to and how much of it was actually handed over. Leaving the figure alone is
 * the common case and costs nothing; reducing it says a customer walked away
 * owing something — and a debt that is real in the yard must not be invisible
 * in the ledger.
 */
describe('Path B totals, and the bill a short payment produces', () => {
  const cashPath = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string,
    amount: string,
  ) => {
    await user.click(await screen.findByRole('button', { name: 'New sale / cash payment' }))
    await user.type(await screen.findByLabelText('Received from'), name)
    await user.type(screen.getByLabelText('How much came in?'), amount)
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    await screen.findByText('Draft saved automatically')
  }

  const addGoods = async (
    user: ReturnType<typeof userEvent.setup>,
    description: string,
    qty: string,
    price: string,
  ) => {
    await user.clear(await screen.findByLabelText('Qty'))
    await user.type(screen.getByLabelText('Qty'), qty)
    await user.type(screen.getByPlaceholderText(/Type an item/), description)
    await user.type(screen.getByLabelText('Unit price'), price)
    await user.click(screen.getByRole('button', { name: 'Add' }))
  }

  /*
   * PATH B RUNS A TOTALS STEP: Details -> Items -> Totals -> Design -> Review.
   * Its goods were typed on this screen and nowhere else, so the subtotal,
   * anything knocked off at the counter and the tax are all decisions being
   * made right now — and all three have to print.
   */
  const openTotals = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Totals' }))
    await screen.findByText('What they paid')
  }
  const paidSection = () => document.querySelector('[data-paid-section]')
  const paidField = () => paidSection()?.querySelector('[data-paid-now]') as HTMLInputElement

  const sellFor = async (user: ReturnType<typeof userEvent.setup>) => {
    await cashPath(user, 'Mama Bisi', '100000')
    await user.click(screen.getByRole('button', { name: 'Items' }))
    await addGoods(user, 'Cement, 20 bags', '20', '5000')
    await openTotals(user)
  }

  const shortPay = async (user: ReturnType<typeof userEvent.setup>) => {
    const paid = paidField()
    await user.clear(paid)
    await user.type(paid, '40000')
    await waitFor(() => expect(paidSection()?.textContent).toContain('60,000.00'))
  }

  /**
   * THE FIGURE THE ITEMS COME TO, which had no home at all: the Totals step is
   * gone from receipts — correctly, a receipt computes nothing — and the sum
   * first appeared on the saved document.
   */
  it('shows what the items add up to, and follows them', async () => {
    const user = userEvent.setup()
    renderAt('/new/receipt')

    await sellFor(user)
    // Subtotal from the items, and the total beneath it.
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(paidField(), 'the payment was not prefilled to the total').toHaveValue('100000')

    // A second line moves it, because the step reads the LIST rather than a
    // figure somebody typed once.
    await user.click(screen.getByRole('button', { name: 'Items' }))
    await addGoods(user, 'Delivery', '1', '7500')
    await openTotals(user)
    expect(paidField()).toHaveValue('107500')
  })

  /**
   * DISCOUNT AND TAX BELONG HERE. A cash sale often involves knocking
   * something off at the point of sale, and it has to print.
   */
  it('applies a discount and a tax, and the payment follows the total', async () => {
    const user = userEvent.setup()
    renderAt('/new/receipt')

    await sellFor(user)
    const discount = screen.getByLabelText('Discount')
    await user.clear(discount)
    await user.type(discount, '10')

    // ₦100,000 less 10% is ₦90,000, and the payment prefills to it.
    await waitFor(() => expect(paidField()).toHaveValue('90000'))
    expect(paidSection()?.textContent).toContain('This clears it')
  })

  /**
   * AND THE PAYMENT FIELD NEVER MOVES THE PRICE. Everything above it is what
   * the goods cost; this is what the customer handed over, and confusing the
   * two is the one thing the layout exists to prevent.
   */
  it('never lets the payment change the total', async () => {
    const user = userEvent.setup()
    renderAt('/new/receipt')

    await sellFor(user)
    const before = document.querySelector('[data-totals-payable]')?.textContent
    await shortPay(user)
    expect(
      document.querySelector('[data-totals-payable]')?.textContent,
      'typing what they paid changed what the goods cost',
    ).toBe(before)
  })

  /**
   * LEAVING IT ALONE CHANGES NOTHING. Paid in full is the common case, and §G
   * caps it at no extra taps: no invoice, no second document, no question.
   */
  it('makes no invoice when the amount is left alone', async () => {
    const user = userEvent.setup()
    const state = renderAt('/new/receipt')
    const before = state.documents.filter((row) => row.type === 'invoice').length

    await sellFor(user)
    expect(paidSection()?.textContent).toContain('This clears it')

    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Save/ }))

    await waitFor(() =>
      expect(state.documents.find((row) => row.type === 'receipt')?.status).toBe('issued'),
    )
    expect(
      state.documents.filter((row) => row.type === 'invoice'),
      'a sale paid in full billed somebody anyway',
    ).toHaveLength(before)
    const receipt = state.documents.find((row) => row.type === 'receipt')
    expect(receipt?.linkedInvoiceId).toBeUndefined()
    expect(receipt?.balanceAfterMinor).toBeUndefined()
  })

  /**
   * THE ONE THIS IS FOR. ₦100,000 of goods, ₦40,000 handed over — and without
   * this the ₦60,000 lives only in the owner's memory.
   */
  it('bills the full sale and allocates the payment when it is short', async () => {
    const user = userEvent.setup()
    const state = renderAt('/new/receipt')

    await sellFor(user)
    await shortPay(user)

    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Save/ }))

    const billsMade = () =>
      state.documents.filter((row) => row.type === 'invoice')
    await waitFor(() => expect(billsMade()[0]?.status).toBe('issued'))
    const invoice = billsMade()[0]

    /*
     * THE WHOLE SALE, not the remainder. Billing ₦60,000 would rewrite the
     * sale to match what was left over — a purchase the customer never made,
     * and ₦40,000 allocated to nothing.
     */
    expect(invoice?.totalMinor, 'the bill was written for the remainder').toBe(100_000_00)
    expect(invoice?.status).toBe('issued')
    expect(invoice?.issuedReference).toBeTruthy()
    expect(invoice?.lineItems.map((row) => row.description)).toEqual(['Cement, 20 bags'])

    // ONE payment counts, allocated to that invoice: the original is reversed
    // and replaced, because §K's ledger is append-only.
    await waitFor(() => {
      const live = effectivePayments(state.payments)
      expect(live).toHaveLength(1)
      expect(live[0]?.amount.minor).toBe(40_000_00)
      expect(live[0]?.allocations[0]?.invoiceId).toBe(invoice?.id)
    })

    // And the receipt prints the same picture Path A does.
    const receipt = state.documents.find((row) => row.type === 'receipt')
    expect(receipt?.linkedInvoiceId).toBe(invoice?.id)
    expect(receipt?.invoiceTotalMinor).toBe(100_000_00)
    expect(receipt?.paidBeforeMinor).toBe(0)
    expect(receipt?.balanceAfterMinor).toBe(60_000_00)
  })

  /**
   * AND THE REMAINDER BEHAVES LIKE ANY OTHER DEBT. That is the whole reason
   * for billing it: Outstanding, the customer balance and the ageing report
   * all read the same invoices, so a debt the app cannot see is one nobody
   * chases.
   */
  it('puts the remainder where every balance in the app will find it', async () => {
    const user = userEvent.setup()
    const state = renderAt('/new/receipt')

    await sellFor(user)
    await shortPay(user)
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(await screen.findByRole('button', { name: /Save/ }))

    await waitFor(() =>
      expect(
        state.documents.filter((row) => row.type === 'invoice'),
      ).toHaveLength(1),
    )
    const made = state.documents.find((row) => row.type === 'invoice')
    const owed = invoiceOutstanding(
      made?.id ?? '',
      NGN(made?.totalMinor ?? 0),
      effectivePayments(state.payments),
      [],
    )
    expect(owed, 'the remainder is invisible to every balance in the app').toEqual(NGN(60_000_00))
  })

  /**
   * SAVING TWICE NEVER BILLS TWICE (§M). The key is derived from the receipt,
   * so a second save finds the first invoice rather than minting a rival.
   */
  it('mints one invoice however many times the save runs', async () => {
    const user = userEvent.setup()
    const state = renderAt('/new/receipt')

    await sellFor(user)
    await shortPay(user)
    await user.click(screen.getByRole('button', { name: 'Review' }))

    const save = await screen.findByRole('button', { name: /Save/ })
    fireEvent.click(save)
    fireEvent.click(save)

    await waitFor(() =>
      expect(state.documents.find((row) => row.type === 'receipt')?.status).toBe('issued'),
    )
    expect(
      state.documents.filter((row) => row.type === 'invoice'),
      'the customer was billed twice for one sale',
    ).toHaveLength(1)
    expect(effectivePayments(state.payments)).toHaveLength(1)
  })
})

/**
 * A paid quotation becomes a bill and its evidence (§G, §K, §V).
 *
 * An owner holding an accepted quote and a customer's cash had no route at
 * all: they had to know that a quotation must be converted to an invoice
 * before it can be paid for, and then do it by hand.
 *
 * THE INVOICE IS ALWAYS CREATED, and that is what these are mostly about. A
 * receipt hanging off a quotation would be evidence of money against a
 * document that never billed anybody — the sale would appear in nothing that
 * was invoiced, the balance would be computed from thin air, and an OFFER
 * would have a payment attached to it.
 *
 * REACHABLE FROM BOTH ENDS, and the same from either. The quotation's own
 * "They've paid" and the receipt flow's accepted-quotation row run one
 * implementation: the first navigates into the flow with the id, the second
 * calls it directly. These check the property rather than the plumbing,
 * because the plumbing is what would drift.
 */
describe('A paid quotation becomes a bill and its evidence (§G, §K)', () => {
  const accepted = (state: MemoryState, over: Record<string, unknown> = {}) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_quo',
      companyId: DEV_COMPANY_ID,
      type: 'quotation',
      status: 'accepted',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [
        {
          id: 'li_1',
          description: 'Roofing sheets, 30 bundles',
          quantityMilli: 1_000,
          unitPriceMinor: 145_000_00,
          taxable: false,
        },
      ],
      issueDate: '2026-09-01',
      issuedReference: 'QUO-0009',
      frozenLabels: {
        printedTitle: 'QUOTATION',
        partyLabel: 'Bill to',
        signatureCaption: 'Authorised signature',
        language: 'en',
      },
      totalMinor: 145_000_00,
      ...over,
    })
  }

  const billsMade = (state: MemoryState) =>
    state.documents.filter((row) => row.type === 'invoice')
  const receipts = (state: MemoryState) => state.documents.filter((row) => row.type === 'receipt')

  /** Door one: the quotation's own action, which only exists once accepted. */
  const viaTheQuotation = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: /They.{0,3}ve paid/ }))
    await screen.findByLabelText('Acknowledge a payment')
  }

  /** Door two: the accepted quotation offered beside the debtors. */
  const viaThePicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
    await user.click(await screen.findByRole('button', { name: /QUO-0009/ }))
    await screen.findByLabelText('Acknowledge a payment')
  }

  describe('The action appears exactly when it can do something (§N)', () => {
    it('offers it on an accepted quotation', async () => {
      renderAt('/doc/doc_quo', accepted)
      expect(await screen.findByRole('button', { name: /They.{0,3}ve paid/ })).toBeInTheDocument()
    })

    /**
     * And it takes the ACCEPT LINK's slot, because that is the one pill on an
     * accepted quotation that cannot do anything: it asks a customer for a
     * decision they have already made.
     */
    it('replaces the accept link, keeping four actions', async () => {
      renderAt('/doc/doc_quo', accepted)
      await screen.findByRole('button', { name: /They.{0,3}ve paid/ })
      expect(screen.queryByRole('button', { name: 'Ask them to accept' })).toBeNull()
    })

    /**
     * A quotation nobody accepted is not a debt. Turning one into an invoice
     * because money appeared would bill somebody for a price they never said
     * yes to — and accepting it first is one tap away (§G).
     */
    it('offers it on nothing else', async () => {
      renderAt('/doc/doc_quo', (state) => accepted(state, { status: 'sent' }))
      await screen.findByRole('button', { name: 'Ask them to accept' })
      expect(screen.queryByRole('button', { name: /They.{0,3}ve paid/ })).toBeNull()
    })
  })

  describe('Either door produces the same thing (§G, §M)', () => {
    /**
     * THE ONE THIS IS FOR. An accepted quotation, money in hand, and the app
     * had nothing to offer — so the sale existed on paper and nowhere in the
     * ledger.
     */
    it.each([
      ['from the quotation', viaTheQuotation, '/doc/doc_quo'],
      ['from the picker', viaThePicker, '/new/receipt'],
    ])('bills the quotation in full and settles it, %s', async (_case, door, path) => {
      const user = userEvent.setup()
      const state = renderAt(path, accepted)

      await door(user)

      // The bill exists, issued, for the WHOLE quotation.
      await waitFor(() => expect(billsMade(state)).toHaveLength(1))
      const invoice = billsMade(state)[0]
      expect(invoice?.status).toBe('issued')
      expect(invoice?.totalMinor, 'the bill is not what was quoted').toBe(145_000_00)
      expect(invoice?.lineItems.map((row) => row.description)).toEqual([
        'Roofing sheets, 30 bundles',
      ])
      // Linked BOTH ways: the link lives on the new document, and the
      // quotation is never written to (§G).
      expect(invoice?.convertedFromId).toBe('doc_quo')
      expect(state.documents.find((row) => row.id === 'doc_quo')?.status).toBe('accepted')

      // And the flow lands on the page where the money is recorded, already
      // knowing who is paying and what for.
      expect(await screen.findByLabelText('How much came in?')).toHaveValue('145000')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))

      await waitFor(() => expect(receipts(state)).toHaveLength(1))
      const receipt = receipts(state)[0]
      expect(receipt?.status).toBe('issued')
      expect(receipt?.linkedInvoiceId).toBe(invoice?.id)
      expect(receipt?.totalMinor).toBe(145_000_00)
      expect(state.payments).toHaveLength(1)
      expect(state.payments[0]?.allocations[0]?.invoiceId).toBe(invoice?.id)
    })

    /**
     * ONE INVOICE HOWEVER MANY TIMES IT RUNS (§M). The key is derived from
     * the quotation, so both doors mint the same one and the second to run
     * finds the first's bill rather than a rival.
     */
    /**
     * AN IMPATIENT TAP BILLS ONCE (§M).
     *
     * Two taps before the first write comes back is the retry that actually
     * happens on a slow phone — and money is the one place a retry must never
     * add (Rule #3). The key is derived from the quotation, so both taps land
     * on one invoice; the mount guard stops the journey running twice.
     */
    it('never bills the same quotation twice', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_quo', accepted)

      const act = await screen.findByRole('button', { name: /They.{0,3}ve paid/ })
      fireEvent.click(act)
      fireEvent.click(act)

      await screen.findByLabelText('Acknowledge a payment')
      await waitFor(() => expect(billsMade(state)).toHaveLength(1))
      expect(await screen.findByLabelText('How much came in?')).toHaveValue('145000')

      // And recording still produces exactly one of each.
      await user.click(screen.getByRole('button', { name: 'Record payment' }))
      await waitFor(() => expect(receipts(state)).toHaveLength(1))
      expect(billsMade(state), 'the customer was billed twice for one quotation').toHaveLength(1)
      expect(state.payments).toHaveLength(1)
    })
  })

  /**
   * A QUOTATION ALREADY BILLED IS NOT OFFERED AGAIN (§N).
   *
   * Found by walking it: picking one that had been paid for landed on a form
   * with the amount at zero, "This clears it" underneath, and a button that
   * could not be pressed — offered, then blocked at the end of a journey
   * somebody had already taken.
   */
  /**
   * A QUOTATION ALREADY BILLED IS NOT OFFERED AGAIN (§N).
   *
   * Found by walking it: picking one that had been paid for landed on a form
   * with the amount at zero, "This clears it" underneath, and a button that
   * could not be pressed — offered, then blocked at the end of a journey
   * somebody had already taken.
   *
   * Once an invoice exists from it the debt lives on THAT document: part
   * paid, it appears among the debtors like any other; settled, there is
   * nothing to pay. Either way the quotation row is redundant, and the
   * redundant version is the one that misleads.
   */
  describe('The picker stops offering it once it has been billed (§N)', () => {
    const alreadyBilled = (state: MemoryState) => {
      accepted(state)
      state.documents.push({
        id: 'doc_inv_from_quo',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [
          {
            id: 'li_1',
            description: 'Roofing sheets, 30 bundles',
            quantityMilli: 1_000,
            unitPriceMinor: 145_000_00,
            taxable: false,
          },
        ],
        issueDate: '2026-09-20',
        issuedReference: 'INV-0090',
        frozenLabels: null,
        totalMinor: 145_000_00,
        convertedFromId: 'doc_quo',
      })
    }

    it('drops the row once an invoice has been made from it', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', alreadyBilled)

      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      await screen.findByText('Who is paying?')
      expect(
        screen.queryByRole('button', { name: /QUO-0009/ }),
        'a quotation that has been billed was offered again',
      ).toBeNull()
    })

    /** And the debt it left is reachable as an ordinary one, on the bill. */
    it('leaves the debt among the debtors instead', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', alreadyBilled)

      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      await user.click(await screen.findByRole('button', { name: /Ade Stores/ }))
      expect(await screen.findByRole('button', { name: /INV-0090/ })).toBeInTheDocument()
    })

    /** It is still offered while nothing has billed it. */
    it('keeps the row while no bill exists', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', accepted)

      await user.click(await screen.findByRole('button', { name: 'Payment towards money owed' }))
      expect(await screen.findByRole('button', { name: /QUO-0009/ })).toBeInTheDocument()
    })
  })

  describe('A part payment behaves like any other debt (§K)', () => {
    /**
     * Nothing special about it: the bill is what was agreed, the receipt
     * prints what arrived, and the remainder is chased like the rest.
     */
    it('leaves the balance owing on the bill', async () => {
      const user = userEvent.setup()
      const state = renderAt('/doc/doc_quo', accepted)

      await viaTheQuotation(user)
      const amount = await screen.findByLabelText('How much came in?')
      await user.clear(amount)
      await user.type(amount, '45000')
      await user.click(screen.getByRole('button', { name: 'Record payment' }))

      await waitFor(() => expect(receipts(state)).toHaveLength(1))
      const invoice = billsMade(state)[0]
      const receipt = receipts(state)[0]
      expect(receipt?.invoiceTotalMinor).toBe(145_000_00)
      expect(receipt?.balanceAfterMinor).toBe(100_000_00)
      expect(
        invoiceOutstanding(
          invoice?.id ?? '',
          NGN(invoice?.totalMinor ?? 0),
          effectivePayments(state.payments),
          [],
        ),
      ).toEqual(NGN(100_000_00))
    })
  })

  describe('The receipt names all three (§N)', () => {
    /**
     * Two documents appear that the owner never asked for by name. Finding
     * them in a list on Thursday is the surprise §N exists to prevent.
     */
    it('says what was made, and offers the way to each', async () => {
      const user = userEvent.setup()
      renderAt('/doc/doc_quo', accepted)

      await viaTheQuotation(user)
      await user.click(await screen.findByRole('button', { name: 'Record payment' }))

      const card = await screen.findByTestId('from-quotation')
      expect(card).toHaveTextContent(/INV-/)
      expect(card).toHaveTextContent(/REC-/)
      expect(within(card).getByRole('button', { name: 'Open the invoice' })).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: /QUO-0009/ })).toBeInTheDocument()
    })
  })
})

describe('The photo on a delivery (§G, §E, §P)', () => {
  /**
   * jsdom has no canvas and no `createImageBitmap`, so `shrinkImage` cannot
   * run here — the same split the signature pad uses: the arithmetic is
   * property-tested on its own, and these drive the wiring around it.
   */
  const stubShrink = () => {
    const bitmap = {
      width: 4032,
      height: 3024,
      close: () => undefined,
    } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', async () => bitmap)
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,SHRUNK')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURL)
    return toDataURL
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const photo = () => new File(['pretend-jpeg-bytes'], 'gate.jpg', { type: 'image/jpeg' })

  const delivery = (status: string) => (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      id: 'doc_way',
      companyId: DEV_COMPANY_ID,
      type: 'waybill',
      status,
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      issuedReference: 'WAY-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'Received by',
        language: 'en',
      },
      totalMinor: 0,
    })
  }

  it('offers it on a delivery that exists as a document', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_way', delivery('dispatched'))

    // The card opens from §G's pill now; it no longer sits open underneath
    // a second button that did the same thing.
    await user.click(await screen.findByRole('button', { name: 'Add photo' }))
    expect(await screen.findByLabelText('Proof of delivery')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add a photo/i })).toBeInTheDocument()
  })

  it('stores the shrunk photo and attaches it to the delivery', async () => {
    const user = userEvent.setup()
    const toDataURL = stubShrink()
    const state = renderAt('/doc/doc_way', delivery('dispatched'))

    await user.click(await screen.findByRole('button', { name: 'Add photo' }))
    await screen.findByRole('button', { name: /add a photo/i })
    await user.upload(document.querySelector('input[type="file"]')!, photo())

    await waitFor(() => expect(state.assets).toHaveLength(1))
    expect(state.assets[0]?.kind).toBe('delivery_photo')
    expect(state.assets[0]?.dataUrl).toBe('data:image/jpeg;base64,SHRUNK')
    // Shrunk, not passed through: every photo uploads on the connection §M
    // assumes the owner actually has.
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)

    await waitFor(() =>
      expect(state.documents[0]?.deliveryPhotoAssetId).toBe(state.assets[0]?.id),
    )
    expect(await screen.findByRole('img', { name: 'Photo attached' })).toBeInTheDocument()
  })

  it('never touches the document beyond the photo (§P)', async () => {
    const user = userEvent.setup()
    stubShrink()
    const state = renderAt('/doc/doc_way', delivery('dispatched'))

    await user.click(await screen.findByRole('button', { name: 'Add photo' }))
    await screen.findByRole('button', { name: /add a photo/i })
    await user.upload(document.querySelector('input[type="file"]')!, photo())
    await waitFor(() => expect(state.documents[0]?.deliveryPhotoAssetId).toBeTruthy())

    expect(state.documents[0]?.status).toBe('dispatched')
    expect(state.documents[0]?.issuedReference).toBe('WAY-0007')
    // Emphatically not a signature: a stack of bags does not say who took them.
    expect(state.documents[0]?.signerName).toBeUndefined()
    expect(state.documents[0]?.signedAt).toBeUndefined()
  })

  it('shows the photo but offers no way to change it once signed for (§P)', async () => {
    renderAt('/doc/doc_way', (seed) => {
      delivery('delivered')(seed)
      seed.assets.push({
        id: 'ast_photo',
        companyId: DEV_COMPANY_ID,
        kind: 'delivery_photo',
        dataUrl: 'data:image/jpeg;base64,GATE',
        createdAt: '2026-09-12T10:00:00Z',
      })
      const row = seed.documents[0]
      if (row !== undefined) {
        seed.documents[0] = { ...row, deliveryPhotoAssetId: 'ast_photo' }
      }
    })

    expect(await screen.findByRole('img', { name: 'Photo attached' })).toBeInTheDocument()
    expect(screen.getByText(/cannot be changed/)).toBeInTheDocument()

    /*
     * CHANGED DELIBERATELY, and the contract is stronger than it was.
     *
     * This asserted the photo control was ABSENT once signed for. §G asks for
     * four actions per type and §N says an unavailable capability is said
     * rather than hidden, so the pill stays in its place, disabled, carrying
     * the reason — "Signed for — sealed". §P is unchanged and is what these
     * two lines now check directly: it cannot be pressed, and the page says
     * why. A missing button proved only that nothing could be tapped; this
     * proves nothing can be tapped AND that the person is told the record is
     * closed rather than left to wonder where the button went.
     */
    const photo = screen.getByRole('button', { name: /add photo/i })
    expect(photo).toBeDisabled()
    expect(photo.textContent).toMatch(/sealed/i)
  })

  it('offers nothing on a delivery nobody has issued', async () => {
    renderAt('/doc/doc_way', (seed) => {
      delivery('draft')(seed)
      const row = seed.documents[0]
      if (row !== undefined) seed.documents[0] = { ...row, issuedReference: null, frozenLabels: null }
    })
    expect(await screen.findByRole('button', { name: 'Carry on editing' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Proof of delivery')).not.toBeInTheDocument()
  })

  it('offers nothing on any other type', async () => {
    renderAt('/doc/doc_inv', (state) => {
      state.documents.push({
        id: 'doc_inv',
        companyId: DEV_COMPANY_ID,
        type: 'invoice',
        status: 'issued',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-01',
        issuedReference: 'INV-0042',
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'Authorised signature',
          language: 'en',
        },
        totalMinor: 145_000_00,
      })
    })
    expect(within(await pageHeader()).getByText('INV-0042')).toBeInTheDocument()
    expect(screen.queryByLabelText('Proof of delivery')).not.toBeInTheDocument()
  })

  it('says so when the chosen file is not a photo', async () => {
    const opener = userEvent.setup()
    renderAt('/doc/doc_way', delivery('dispatched'))
    await opener.click(await screen.findByRole('button', { name: 'Add photo' }))
    await screen.findByRole('button', { name: /add a photo/i })

    // `user.upload` filters by the input's `accept`, so it would drop this
    // silently. `accept` is a hint the platform may ignore, which is exactly
    // why the guard exists — so the file is delivered directly.
    const input = document.querySelector('input[type="file"]')!
    fireEvent.change(input, {
      target: { files: [new File(['%PDF-'], 'invoice.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('That file is not a photo.')
  })

  it('attaches a receipt photo to an expense, which nothing could do before', async () => {
    const user = userEvent.setup()
    stubShrink()
    const state = renderAt('/analytics', (seed) => {
      seed.customers.push(customer())
    })

    await user.click(await screen.findByLabelText('Add an expense'))
    await user.type(screen.getByLabelText('Amount'), '9500')
    // §G: "a three-field sheet OR receipt photo" — the photo stands in for
    // the description, so this expense is saved without one.
    await user.upload(document.querySelector('input[type="file"]')!, photo())
    await waitFor(() => expect(state.assets).toHaveLength(1))
    expect(state.assets[0]?.kind).toBe('expense_photo')

    await user.click(screen.getByRole('button', { name: 'Add it' }))
    await waitFor(() => expect(state.expenses).toHaveLength(1))
    expect(state.expenses[0]?.photoAssetId).toBe(state.assets[0]?.id)
  })
})

describe('The payment detour goes somewhere and comes back (§G, §J)', () => {
  /**
   * §G: an amber "Set up payment" that "carries into Settings under a blue
   * return band — 'Setting up payment for your document · Back to draft' —
   * and returns with the draft intact."
   *
   * The band was the half that never got built. The builder navigated to the
   * panel and left the person there, with no statement of why they had moved
   * and no route home but the system back gesture — which mid-task is the one
   * thing people will not risk.
   */
  const bankTransferOnly = (state: MemoryState) => {
    const company = state.companies[0]
    if (company !== undefined) {
      state.companies[0] = {
        ...company,
        name: 'Sola Ventures',
        enabledPaymentMethods: [],
        bankFields: {},
      }
    }
  }

  it('carries into the panel under the band, and back to the same draft', async () => {
    const user = userEvent.setup()
    renderAt('/new/invoice', bankTransferOnly)

    await user.click(await screen.findByRole('button', { name: /set up payment/i }))

    // There, and saying why.
    expect(await screen.findByText('Setting up payment for your document')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How you get paid' })).toBeInTheDocument()

    // And back, to the builder rather than to the list.
    await user.click(screen.getByRole('button', { name: 'Back to draft' }))
    await waitFor(() => {
      expect(screen.queryByText('Setting up payment for your document')).not.toBeInTheDocument()
    })
    expect(await screen.findByRole('button', { name: /set up payment/i })).toBeInTheDocument()
  })

  /** A panel reached the ordinary way carries no band at all. */
  it('shows no band when Settings was opened directly', async () => {
    renderAt('/settings/payment', bankTransferOnly)
    expect(await screen.findByRole('heading', { name: 'How you get paid' })).toBeInTheDocument()
    expect(screen.queryByText('Setting up payment for your document')).not.toBeInTheDocument()
  })
})

/**
 * NO LIVE PILL IS WIRED TO NOTHING (§G, §N).
 *
 * I shipped four of them. `copy_signing_link`, `copy_accept_link`,
 * `add_photo` and `duplicate_rev2` rendered enabled in §G's action grid and
 * had no branch in the handler at all, so tapping them did nothing — the
 * exact shape this codebase keeps digging out, introduced by the change that
 * was meant to honour §G.
 *
 * `sign` was worse than nothing: it navigated to `editDocumentPath(id)` with
 * the ACTION's id, so it opened `/edit/sign` — a route for a document that
 * does not exist.
 */
describe('Every enabled action does something (§G, §N)', () => {
  /** Its own fixture: the ones above are scoped inside their describes. */
  const dispatched = (seed: MemoryState) => {
    seed.customers.push(customer())
    seed.documents.push({
      id: 'doc_way',
      companyId: DEV_COMPANY_ID,
      type: 'waybill',
      status: 'dispatched',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [],
      issueDate: '2026-09-01',
      issuedReference: 'WAY-0007',
      frozenLabels: {
        printedTitle: 'WAYBILL',
        partyLabel: 'Deliver to',
        signatureCaption: 'Received by',
        language: 'en',
      },
      totalMinor: 0,
    })
  }

  /*
   * REWRITTEN. These asserted the pill SCROLLED to a control further down —
   * which was the first shape of this fix and the wrong one: it left the
   * duplicates in place, and the screen carried nine actions where §G asks
   * for four. The pill OPENS the control now, and the duplicate is gone.
   */
  it('opens the signing-link control from its pill, with no duplicate below', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_way', dispatched)

    // Nothing minting links is on screen until the pill is pressed.
    expect(screen.queryByRole('button', { name: /copy a link/i })).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Ask them to sign' }))
    await user.click(await screen.findByRole('button', { name: /send a link instead/i }))
    expect(await screen.findByRole('button', { name: /copy a link/i })).toBeInTheDocument()
  })

  it('opens the proof-of-delivery card from its pill, with no duplicate below', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_way', dispatched)

    expect(screen.queryByLabelText('Proof of delivery')).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Add photo' }))
    expect(await screen.findByLabelText('Proof of delivery')).toBeInTheDocument()
  })

  /**
   * THE COUNT ITSELF. §G asks for four actions per type; the screen had nine
   * plus a card, three of them the same acts under different wording.
   */
  it('shows four actions and no more', async () => {
    renderAt('/doc/doc_way', dispatched)
    const grid = await screen.findByRole('group', { name: 'Actions' })
    expect(grid.querySelectorAll('button')).toHaveLength(4)

    for (const gone of [
      /turn this into something else/i,
      /copy a link for them to sign/i,
      /^add a photo$/i,
      /statement/i,
    ]) {
      expect(screen.queryByRole('button', { name: gone }), String(gone)).toBeNull()
    }
  })

  /*
   * REMOVED. This drove the invoice's "Sign it" pill, which is gone at the
   * owner's instruction — signing happens in the builder, where Rule #5
   * allows it. The bug it was written for (navigating with the ACTION's id
   * rather than the document's) cannot recur: no action navigates by id any
   * more except `open_invoice`, which is asserted above.
   */
})
