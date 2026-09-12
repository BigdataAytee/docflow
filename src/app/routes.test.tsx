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
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories, type MemoryState } from '../data/repositories'
import { money } from '../domain/money/money'
import { quantity } from '../domain/documents/types'

const NGN = (m: number) => money('NGN', m)

function seeded(over: (state: MemoryState) => void = () => undefined) {
  const state = devState()
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
          enabledPaymentMethods: ['bank_transfer'],
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

    expect(await screen.findByText('INV-0001')).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: 'Invoice1' })).toBeInTheDocument()
    expect(screen.getByLabelText('Needs attention')).toBeInTheDocument()

    const user = await type('cement')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Invoice1' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByLabelText('Needs attention')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Documents')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search/i }))
    expect(await screen.findByRole('button', { name: 'Invoice1' })).toBeInTheDocument()
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
    expect(await screen.findByRole('button', { name: 'Share the PDF' })).toBeInTheDocument()
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
    expect(screen.queryByRole('button', { name: 'Share the PDF' })).not.toBeInTheDocument()
  })

  it('composes the message from the document, the customer and the ledger', async () => {
    const user = userEvent.setup()
    renderAt('/doc/doc_issued', issued)
    await user.click(await screen.findByRole('button', { name: 'Share the PDF' }))

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

    await user.click(await screen.findByRole('button', { name: 'Share the PDF' }))
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

    await user.click(await screen.findByRole('button', { name: 'Share the PDF' }))
    const sheet = screen.getByLabelText('Send this document')
    expect(sheet).toHaveTextContent('Waybill WB-0007')
    expect(sheet).not.toHaveTextContent('Delivery note')
  })

  it('records the handoff against the document, and never a delivery', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_issued', issued)
    await user.click(await screen.findByRole('button', { name: 'Share the PDF' }))

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

    await user.click(await screen.findByRole('button', { name: 'Share the PDF' }))
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
        seed.companies[0] = { ...company, enabledPaymentMethods: ['bank_transfer'] }
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
      await screen.findByRole('button', { name: 'Turn this into something else' }),
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
    expect(await screen.findByText('REC-0003')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Turn this into something else' }),
    ).not.toBeInTheDocument()
  })

  it('makes a draft invoice from a quotation, leaving the quotation untouched', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', (state) => quote(state))

    await user.click(await screen.findByRole('button', { name: 'Turn this into something else' }))
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

    await user.click(await screen.findByRole('button', { name: 'Turn this into something else' }))
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

    await user.click(await screen.findByRole('button', { name: 'Turn this into something else' }))
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
    expect(await screen.findByText('QUO-0009')).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: 'Cancel this document' }))
    await user.type(screen.getByLabelText('Why?'), 'Raised twice by mistake')
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
    expect(await screen.findByText('WB-0007')).toBeInTheDocument()
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

    it('writes the payment, then the draft derived from it, and opens the builder', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await user.selectOptions(await screen.findByLabelText('Who paid?'), 'cus_1')
      await user.type(screen.getByLabelText('How much came in?'), '45000')
      await user.selectOptions(screen.getByLabelText('Against'), 'doc_inv')
      await user.click(screen.getByRole('button', { name: 'Record it' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      const payment = state.payments[0]
      expect(payment?.amount).toEqual(NGN(45_000_00))
      expect(payment?.allocations[0]?.invoiceId).toBe('doc_inv')
      // The allocation names the payment that actually exists (§E).
      expect(payment?.allocations[0]?.paymentId).toBe(payment?.id)

      await waitFor(() => expect(state.documents).toHaveLength(2))
      const receipt = state.documents.find((document) => document.type === 'receipt')
      expect(receipt?.status).toBe('draft')
      expect(receipt?.paymentId).toBe(payment?.id)
      expect(receipt?.linkedInvoiceId).toBe('doc_inv')
      expect(receipt?.totalMinor).toBe(45_000_00)
      expect(receipt?.customerId).toBe('cus_1')

      // And the builder took over on the draft's own URL.
      expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
    })

    it('records money standing alone without billing anybody for it (§G, §K)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await user.selectOptions(await screen.findByLabelText('Who paid?'), 'cus_1')
      await user.type(screen.getByLabelText('How much came in?'), '10000')
      await user.click(screen.getByRole('button', { name: 'Record it' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      expect(state.payments[0]?.allocations).toEqual([])
      // No second invoice appeared from nowhere: still the one that was seeded.
      expect(state.documents.filter((document) => document.type === 'invoice')).toHaveLength(1)
      const receipt = state.documents.find((document) => document.type === 'receipt')
      expect(receipt?.linkedInvoiceId).toBeUndefined()
    })

    it('moves the balance once for a double tap, not twice (§M, §V)', async () => {
      const user = userEvent.setup()
      const state = renderAt('/new/receipt', billed)

      await user.selectOptions(await screen.findByLabelText('Who paid?'), 'cus_1')
      await user.type(screen.getByLabelText('How much came in?'), '45000')
      // An impatient owner on a slow phone. Two taps land BEFORE the first
      // write comes back, which `userEvent` cannot reproduce — it yields
      // between events, so the screen has already moved on by the second.
      // Money is the one place a retry must never add (Rule #3, §M).
      const button = screen.getByRole('button', { name: 'Record it' })
      fireEvent.click(button)
      fireEvent.click(button)

      // Let the whole gesture settle — both taps — before counting. A
      // `waitFor(length === 1)` would pass on the first write and never see
      // the second, which is the bug being guarded against.
      expect(await screen.findByRole('button', { name: /Next/ })).toBeInTheDocument()
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

      await user.selectOptions(await screen.findByLabelText('Who paid?'), 'cus_1')
      await user.type(screen.getByLabelText('How much came in?'), '45000')
      await user.click(screen.getByRole('button', { name: 'Record it' }))

      await waitFor(() => expect(state.payments).toHaveLength(1))
      expect(state.documents.filter((document) => document.type === 'receipt')).toHaveLength(1)
    })

    it('never offers a balance belonging to somebody else (§G, §K)', async () => {
      const user = userEvent.setup()
      renderAt('/new/receipt', (state) => {
        billed(state)
        state.customers.push(customer('cus_2', 'Bisi'))
      })

      await user.selectOptions(await screen.findByLabelText('Who paid?'), 'cus_2')
      expect(screen.queryByRole('option', { name: /INV-0042/ })).not.toBeInTheDocument()
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

      // The payment supplied the party, the date, the line and the total, so
      // nothing is missing and nothing had to be retyped (Rule #1).
      for (let step = 0; step < 4; step += 1) {
        await user.click(await screen.findByRole('button', { name: 'Next' }))
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
      expect(line?.description).toBe('Payment received against INV-0042')
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
      expect(await screen.findByText('REC-0003')).toBeInTheDocument()
      expect(state.documents).toHaveLength(2)
    })
  })
})
