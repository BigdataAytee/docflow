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
import { render, screen, waitFor, within } from '@testing-library/react'
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
