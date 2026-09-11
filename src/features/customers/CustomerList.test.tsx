/**
 * The customers screen (§C: "Every screen ships with skeleton, empty state,
 * toast feedback, dark-mode-safe tokens, a11y labels. No spinners, no blank
 * screens.").
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { type MemoryState, createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import { CustomerList } from './CustomerList'
import type { BilledInvoice } from './balance'

const COMPANY = 'co_1'
const NGN = (m: number) => money('NGN', m)

function setup(options: {
  customers?: MemoryState['customers']
  invoices?: BilledInvoice[]
  payments?: Payment[]
}) {
  const state = emptyState()
  state.customers = options.customers ?? []
  const repositories = createMemoryRepositories(state)
  return render(
    <CompanyProvider companyId={COMPANY} repositories={repositories} profile={{ locale: 'EN-NG' }}>
      <CustomerList invoices={options.invoices ?? []} payments={options.payments ?? []} />
    </CompanyProvider>,
  )
}

const customer = (id: string, name: string, address?: string) => ({
  id,
  companyId: COMPANY,
  kind: 'person' as const,
  name,
  labels: [],
  ...(address === undefined ? {} : { address }),
})

describe('It never shows a spinner or a blank frame (§C)', () => {
  it('shows a skeleton before the rows arrive', () => {
    setup({ customers: [customer('c1', 'Okoro & Sons')] })
    // Present on the very first paint, before any await.
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('replaces the skeleton with rows', async () => {
    setup({ customers: [customer('c1', 'Okoro & Sons', '12 Balogun St')] })
    expect(await screen.findByText('Okoro & Sons')).toBeInTheDocument()
    expect(screen.getByText('12 Balogun St')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument()
  })
})

describe('Two different empty states (§L8)', () => {
  it('offers the first action when there are no customers at all', async () => {
    setup({ customers: [] })
    expect(await screen.findByText(/no customers yet/i)).toBeInTheDocument()
  })

  it('says nothing matched when a search excludes everyone', async () => {
    const user = userEvent.setup()
    setup({ customers: [customer('c1', 'Okoro & Sons')] })
    await screen.findByText('Okoro & Sons')

    await user.type(screen.getByRole('searchbox'), 'zzzz')

    expect(await screen.findByText(/nothing matched/i)).toBeInTheDocument()
    // Crucially NOT the "no customers yet" state — the difference is whether
    // the user has work to find or work to start.
    expect(screen.queryByText(/no customers yet/i)).not.toBeInTheDocument()
  })
})

describe('Search matches more than the name', () => {
  it('finds a customer by address', async () => {
    const user = userEvent.setup()
    setup({
      customers: [customer('c1', 'Okoro & Sons', '12 Balogun St'), customer('c2', 'Adeola Ltd')],
    })
    await screen.findByText('Okoro & Sons')

    await user.type(screen.getByRole('searchbox'), 'balogun')

    expect(screen.getByText('Okoro & Sons')).toBeInTheDocument()
    expect(screen.queryByText('Adeola Ltd')).not.toBeInTheDocument()
  })
})

describe('Balances on the card (§G, §V)', () => {
  const invoices: BilledInvoice[] = [
    { id: 'inv-1', customerId: 'c1', status: 'issued', total: NGN(145_000_00), issueDate: '2026-09-01' },
  ]
  const part: Payment[] = [
    {
      id: 'p1',
      customerId: 'c1',
      amount: NGN(50_000_00),
      paidAt: '2026-09-11T10:00:00Z',
      method: 'bank_transfer',
      source: 'manual',
      allocations: [{ id: 'a1', paymentId: 'p1', invoiceId: 'inv-1', amount: NGN(50_000_00) }],
    },
  ]

  it('shows what is still owed after a part payment', async () => {
    setup({ customers: [customer('c1', 'Okoro & Sons')], invoices, payments: part })
    expect(await screen.findByText('Owes ₦95,000.00')).toBeInTheDocument()
  })

  it('says settled when nothing is owed', async () => {
    setup({ customers: [customer('c1', 'Okoro & Sons')], invoices: [], payments: [] })
    expect(await screen.findByText('Settled')).toBeInTheDocument()
  })

  it('shows each currency separately rather than one total (§G)', async () => {
    setup({
      customers: [customer('c1', 'Okoro & Sons')],
      invoices: [
        ...invoices,
        { id: 'inv-2', customerId: 'c1', status: 'issued', total: money('USD', 500_00), issueDate: '2026-09-01' },
      ],
      payments: part,
    })
    expect(await screen.findByText('Owes ₦95,000.00')).toBeInTheDocument()
    expect(screen.getByText('Owes $500.00')).toBeInTheDocument()
  })
})

describe('Accessibility (§L9)', () => {
  it('gives the search field and every row an accessible name', async () => {
    setup({ customers: [customer('c1', 'Okoro & Sons')] })
    expect(screen.getByRole('searchbox', { name: /search customers/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Okoro & Sons/ })).toBeInTheDocument()
  })
})
