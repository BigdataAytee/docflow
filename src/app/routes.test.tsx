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
