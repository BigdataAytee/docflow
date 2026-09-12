/**
 * The contact page (§G — Customers).
 *
 * Each of §G's five parts is a section here, and each has a way it could be
 * wrong: a merged balance, a pays-late line built on one invoice, a dead Chat
 * chip, a private note that reaches a document.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { Customer } from '../../data/repositories'
import { money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import { ContactPage } from './ContactPage'
import type { BilledInvoice } from './balance'

const NGN = (m: number) => money('NGN', m)
const USD = (m: number) => money('USD', m)

const customer: Customer = {
  id: 'cus_1',
  companyId: 'co_1',
  kind: 'company',
  name: 'Ade Stores',
  address: '14 Adeola Odeku, Victoria Island',
  phone: '+234 803 111 2222',
  labels: ['Wholesale'],
}

const invoice = (
  id: string,
  minor: number,
  over: Partial<BilledInvoice> = {},
): BilledInvoice => ({
  id,
  customerId: 'cus_1',
  status: 'issued',
  total: NGN(minor),
  issueDate: '2026-09-01',
  ...over,
})

const allocated = (id: string, invoiceId: string, minor: number, paidAt: string): Payment => ({
  id,
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt,
  method: 'bank_transfer',
  source: 'manual',
  allocations: [{ id: `${id}:a`, paymentId: id, invoiceId, amount: NGN(minor) }],
})

function renderPage(over: Partial<React.ComponentProps<typeof ContactPage>> = {}) {
  const props: React.ComponentProps<typeof ContactPage> = {
    customer,
    invoices: [],
    payments: [],
    history: [],
    onLabels: vi.fn(),
    onNote: vi.fn(),
    onOpenDocument: vi.fn(),
    onStatement: vi.fn(),
    onBack: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <ContactPage {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('The header and its labels (§G)', () => {
  it('shows the name, the address and the labels it has', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Ade Stores' })).toBeInTheDocument()
    expect(screen.getByText('14 Adeola Odeku, Victoria Island')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Labels')).getByText('Wholesale')).toBeInTheDocument()
  })

  it('adds a label', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.type(screen.getByLabelText('New label'), 'VIP')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.onLabels).toHaveBeenCalledWith(['Wholesale', 'VIP'])
  })

  it('does not add a label that differs only in case', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.type(screen.getByLabelText('New label'), 'wholesale')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.onLabels).toHaveBeenCalledWith(['Wholesale'])
  })

  it('ignores an empty label rather than saving one', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.type(screen.getByLabelText('New label'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.onLabels).not.toHaveBeenCalled()
  })

  it('removes a label', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.click(screen.getByRole('button', { name: 'Remove Wholesale' }))
    expect(props.onLabels).toHaveBeenCalledWith([])
  })

  it('goes back to the list', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.click(screen.getByRole('button', { name: 'All customers' }))
    expect(props.onBack).toHaveBeenCalledOnce()
  })
})

describe('Chat / Call / Statement (§G)', () => {
  it('offers real handoffs, not stubs', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute(
      'href',
      'https://wa.me/2348031112222',
    )
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute(
      'href',
      'tel:+234 803 111 2222',
    )
  })

  it('leaves Chat and Call out entirely without a phone number, and says why', () => {
    const { phone, ...noPhone } = customer
    expect(phone).toBeDefined()
    renderPage({ customer: noPhone })
    expect(screen.queryByRole('link', { name: 'Chat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument()
    expect(screen.getByText('Add a phone number to chat or call.')).toBeInTheDocument()
  })

  it('opens the statement', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.click(screen.getByRole('button', { name: 'Statement' }))
    expect(props.onStatement).toHaveBeenCalledOnce()
  })
})

describe('Balance — §G four figures and the progress bar', () => {
  it('shows billed all time, paid and owing now', () => {
    renderPage({
      invoices: [invoice('doc_1', 145_000_00, { dueDate: '2026-09-30' })],
      payments: [allocated('pay_1', 'doc_1', 50_000_00, '2026-09-10T09:00:00Z')],
    })

    const balance = screen.getByLabelText('Balance')
    expect(within(balance).getByText('Billed all time')).toBeInTheDocument()
    expect(balance).toHaveTextContent('₦145,000.00')
    expect(balance).toHaveTextContent('₦50,000.00')
    expect(balance).toHaveTextContent('₦95,000.00')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '34')
  })

  it('never merges currencies — one block each (§G)', () => {
    renderPage({
      invoices: [
        invoice('doc_1', 100_00),
        invoice('doc_2', 200_00, { total: USD(200_00) }),
      ],
    })
    const balance = screen.getByLabelText('Balance')
    expect(within(balance).getByLabelText('NGN')).toBeInTheDocument()
    expect(within(balance).getByLabelText('USD')).toBeInTheDocument()
  })

  it('says settled when nothing was ever billed', () => {
    renderPage()
    expect(within(screen.getByLabelText('Balance')).getByText('Settled')).toBeInTheDocument()
  })
})

describe('The pays-late line (§G)', () => {
  const settled = (id: string, dueDate: string, paidAt: string) => ({
    invoice: invoice(id, 10_000_00, { dueDate }),
    payment: allocated(`pay_${id}`, id, 10_000_00, paidAt),
  })

  it('stays silent on one settled invoice, rather than calling it a pattern', () => {
    const one = settled('doc_1', '2026-09-01', '2026-09-10T09:00:00Z')
    renderPage({ invoices: [one.invoice], payments: [one.payment] })
    expect(screen.queryByText(/Pays on average/)).not.toBeInTheDocument()
  })

  it('names the average and the advice once there is a sample', () => {
    const a = settled('doc_1', '2026-09-01', '2026-09-10T00:00:00Z')
    const b = settled('doc_2', '2026-08-01', '2026-08-09T00:00:00Z')
    renderPage({
      invoices: [a.invoice, b.invoice],
      payments: [a.payment, b.payment],
    })
    expect(screen.getByText(/Pays on average 9 days late\./)).toBeInTheDocument()
    expect(screen.getByText(/Consider part payment up front\./)).toBeInTheDocument()
  })

  it('says so plainly when a customer pays early, with no advice attached', () => {
    const a = settled('doc_1', '2026-09-10', '2026-09-05T00:00:00Z')
    const b = settled('doc_2', '2026-08-10', '2026-08-05T00:00:00Z')
    renderPage({ invoices: [a.invoice, b.invoice], payments: [a.payment, b.payment] })
    expect(screen.getByText(/Pays on average 5 days early\./)).toBeInTheDocument()
    expect(screen.queryByText(/Consider part payment/)).not.toBeInTheDocument()
  })
})

describe('History (§G)', () => {
  it('lists every document and opens one', async () => {
    const user = userEvent.setup()
    const props = renderPage({
      history: [
        { id: 'doc_1', reference: 'INV-0042', status: 'overdue', statusLabel: 'Late', date: '2026-09-01', amount: NGN(95_000_00) },
        { id: 'doc_2', reference: 'WB-0007', status: 'delivered', statusLabel: 'Delivered', date: '2026-08-20' },
      ],
    })

    const history = screen.getByLabelText('History')
    expect(within(history).getByText('INV-0042')).toBeInTheDocument()
    expect(within(history).getByText('Late')).toBeInTheDocument()

    await user.click(within(history).getByText('WB-0007'))
    expect(props.onOpenDocument).toHaveBeenCalledWith('doc_2')
  })

  it('shows no amount on a delivery document row (§G, §I)', () => {
    renderPage({
      history: [
        { id: 'doc_2', reference: 'WB-0007', status: 'delivered', statusLabel: 'Delivered' },
      ],
    })
    expect(screen.getByLabelText('History')).not.toHaveTextContent('₦')
  })

  it('says nothing yet rather than showing a blank box', () => {
    renderPage()
    expect(within(screen.getByLabelText('History')).getByText('Nothing yet')).toBeInTheDocument()
  })
})

describe('Notes — private, never printed (§G)', () => {
  it('says it is private', () => {
    renderPage()
    expect(
      screen.getByText('Only you see this. It never prints on a document.'),
    ).toBeInTheDocument()
  })

  it('saves what was typed when the field is left', async () => {
    const user = userEvent.setup()
    const props = renderPage()
    await user.type(screen.getByLabelText('Notes'), 'Always pays after harvest')
    await user.tab()
    expect(props.onNote).toHaveBeenCalledWith('Always pays after harvest')
  })

  it('does not write when nothing changed', async () => {
    const user = userEvent.setup()
    const props = renderPage({ customer: { ...customer, privateNote: 'Kept' } })
    await user.click(screen.getByLabelText('Notes'))
    await user.tab()
    expect(props.onNote).not.toHaveBeenCalled()
  })
})
