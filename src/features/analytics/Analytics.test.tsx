/**
 * The analytics page (§G, §L6, §Q Phase 2.5).
 *
 * The gate clause this file exists for: "Kept" moves the moment an expense is
 * added — proved through the screen, not only through the arithmetic.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { quantity } from '../../domain/documents/types'
import type { Payment } from '../../domain/payments/ledger'
import { Analytics, type AnalyticsProps, type AnalyticsRecord } from './Analytics'

const NGN = (m: number) => money('NGN', m)
const TODAY = '2026-09-11'

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: 'cus_1',
  paidAt: '2026-09-05T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const invoice = (over: Partial<AnalyticsRecord> & Pick<AnalyticsRecord, 'id'>): AnalyticsRecord => ({
  type: 'invoice',
  status: 'issued',
  currency: 'NGN',
  total: NGN(100_000_00),
  issueDate: '2026-09-02',
  lineItems: [
    { id: 'li_1', description: 'Bag of cement', quantityMilli: quantity(20), unitPriceMinor: 5_000_00, taxable: true },
  ],
  ...over,
})

function renderPage(over: Partial<AnalyticsProps> = {}) {
  const props: AnalyticsProps = {
    documents: [],
    payments: [],
    expenses: [],
    expenseLines: [],
    customerNames: new Map(),
    customerOf: new Map(),
    today: TODAY,
    defaultCurrency: 'NGN',
    knownCategories: [],
    onAddExpense: vi.fn(),
    ...over,
  }
  const repositories = createMemoryRepositories(emptyState())
  render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }} language="en">
      <Analytics {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('In / Out / Kept on screen (§G)', () => {
  it('shows the three cards with the help line that says what Kept is', () => {
    renderPage({
      payments: [payment({ id: 'pay_1', amount: NGN(150_000_00) })],
      expenses: [{ id: 'exp_1', amount: NGN(40_000_00), spentOn: '2026-09-06' }],
    })

    expect(screen.getByLabelText('In')).toHaveTextContent('₦150,000.00')
    expect(screen.getByLabelText('Out')).toHaveTextContent('₦40,000.00')
    expect(screen.getByLabelText('Kept')).toHaveTextContent('₦110,000.00')
    expect(screen.getByText(/Kept is the money you recorded coming in/)).toBeInTheDocument()
  })

  it('moves Kept the moment an expense is added — the Phase 2.5 gate clause', async () => {
    const user = userEvent.setup()
    const added: unknown[] = []

    // The page is a pure view of what it is handed, so "the moment" is modelled
    // the way the app models it: the sheet saves, the store changes, the page
    // re-renders from the new list. Nothing is stored as a running total.
    const { rerender } = render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <Analytics
          documents={[]}
          payments={[payment({ id: 'pay_1', amount: NGN(150_000_00) })]}
          expenses={[]}
          expenseLines={[]}
          customerNames={new Map()}
          customerOf={new Map()}
          today={TODAY}
          defaultCurrency="NGN"
          knownCategories={[]}
          onAddExpense={(input) => added.push(input)}
        />
      </CompanyProvider>,
    )

    expect(screen.getByLabelText('Kept')).toHaveTextContent('₦150,000.00')

    await user.click(screen.getByLabelText('Add an expense'))
    await user.type(screen.getByLabelText('Amount'), '9500')
    await user.type(screen.getByLabelText('What was it for?'), 'Diesel')
    await user.click(screen.getByRole('button', { name: 'Add it' }))

    expect(added).toEqual([
      expect.objectContaining({ amount: NGN(9_500_00), spentOn: TODAY, description: 'Diesel' }),
    ])

    rerender(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <Analytics
          documents={[]}
          payments={[payment({ id: 'pay_1', amount: NGN(150_000_00) })]}
          expenses={[{ id: 'exp_1', amount: NGN(9_500_00), spentOn: TODAY }]}
          expenseLines={[
            { id: 'exp_1', description: 'Diesel', amount: NGN(9_500_00), spentOn: TODAY },
          ]}
          customerNames={new Map()}
          customerOf={new Map()}
          today={TODAY}
          defaultCurrency="NGN"
          knownCategories={[]}
          onAddExpense={vi.fn()}
        />
      </CompanyProvider>,
    )

    expect(screen.getByLabelText('Kept')).toHaveTextContent('₦140,500.00')
    expect(screen.getByLabelText('Out')).toHaveTextContent('₦9,500.00')
    expect(screen.getByLabelText('In')).toHaveTextContent('₦150,000.00')
  })

  it('will not let the sheet save an expense with no amount', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByLabelText('Add an expense'))
    await user.type(screen.getByLabelText('What was it for?'), 'Diesel')
    expect(screen.getByRole('button', { name: 'Add it' })).toBeDisabled()
  })

  it('tells the owner the photo is proof, not a source of figures', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByLabelText('Add an expense'))
    expect(screen.getByText(/Type the amount yourself/)).toBeInTheDocument()
  })
})

describe('The rest of the page (§G)', () => {
  it('names the worst ageing bucket', () => {
    renderPage({
      documents: [
        invoice({ id: 'doc_1', total: NGN(300_00), dueDate: '2026-06-01' }),
        invoice({ id: 'doc_2', total: NGN(100_00), dueDate: '2026-09-05' }),
      ],
    })
    expect(screen.getByText(/Most of what is late sits in Over 60 days late/)).toBeInTheDocument()
  })

  it('says nothing is late rather than showing an empty chart', () => {
    renderPage({ documents: [invoice({ id: 'doc_1', dueDate: '2026-12-01' })] })
    expect(screen.getByText('Nothing is late.')).toBeInTheDocument()
  })

  it('ranks what sells best by value', () => {
    renderPage({
      documents: [
        invoice({ id: 'doc_1' }),
        invoice({
          id: 'doc_2',
          lineItems: [
            { id: 'li_2', description: 'Generator', quantityMilli: quantity(1), unitPriceMinor: 400_000_00, taxable: true },
          ],
        }),
      ],
    })
    const section = screen.getByText('What sells best').closest('section')
    expect(section).not.toBeNull()
    const names = within(section as HTMLElement).getAllByRole('listitem').map((li) => li.textContent)
    expect(names?.[0]).toContain('Generator')
  })

  it('answers a chip from the phone copy, and says free-form needs the offline tools', async () => {
    const user = userEvent.setup()
    renderPage({
      documents: [invoice({ id: 'doc_1', total: NGN(90_000_00) })],
      customerOf: new Map([['doc_1', 'cus_1']]),
      customerNames: new Map([['cus_1', 'Ade Stores']]),
    })

    await user.click(screen.getByRole('button', { name: 'Who owes me the most?' }))
    expect(screen.getByRole('status')).toHaveTextContent('Ade Stores — ₦90,000.00')
    expect(screen.getByText('Answered on this phone, offline.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Your question' }), 'why?')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent(/need the offline tools installed/)
  })

  it('shows an empty state rather than a blank page', () => {
    renderPage()
    expect(screen.getByText('Nothing to show yet')).toBeInTheDocument()
  })

  it('shows skeletons, never a spinner, while loading', () => {
    renderPage({ loading: true })
    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true')
  })

  it('labels a photo-only expense instead of leaving the row blank', () => {
    renderPage({
      expenses: [{ id: 'exp_1', amount: NGN(5_000_00), spentOn: TODAY }],
      expenseLines: [{ id: 'exp_1', description: '', amount: NGN(5_000_00), spentOn: TODAY }],
    })
    expect(screen.getByText('From the receipt photo')).toBeInTheDocument()
  })
})
