/**
 * The builder's customer card (§G, step 1).
 *
 * The clause that matters most: "+ Add…" carries whatever was typed. Somebody
 * halfway through a document who has to retype a name into a blank form is
 * somebody who puts the phone down.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { Customer } from '../../data/repositories'
import { money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import { CustomerPicker } from './CustomerPicker'
import type { BilledInvoice } from './balance'

const NGN = (m: number) => money('NGN', m)

const ade: Customer = {
  id: 'cus_1',
  companyId: 'co_1',
  kind: 'company',
  name: 'Ade Stores',
  address: '14 Adeola Odeku',
  phone: '+234 803 111 2222',
  labels: [],
}

const bisi: Customer = {
  id: 'cus_2',
  companyId: 'co_1',
  kind: 'person',
  name: 'Bisi Okoro',
  labels: [],
}

const invoice: BilledInvoice = {
  id: 'doc_1',
  customerId: 'cus_1',
  status: 'issued',
  total: NGN(145_000_00),
  issueDate: '2026-09-01',
}

const part: Payment = {
  id: 'pay_1',
  customerId: 'cus_1',
  amount: NGN(50_000_00),
  paidAt: '2026-09-10T09:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [{ id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(50_000_00) }],
}

function renderPicker(over: Partial<React.ComponentProps<typeof CustomerPicker>> = {}) {
  const props: React.ComponentProps<typeof CustomerPicker> = {
    customers: [ade, bisi],
    invoices: [],
    payments: [],
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <CustomerPicker {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('The closed row (§G)', () => {
  it('says nobody is chosen rather than showing a blank row', () => {
    renderPicker()
    expect(screen.getByText('Nobody chosen yet')).toBeInTheDocument()
  })

  it('shows the chosen name and address, never the raw id', () => {
    renderPicker({ selectedId: 'cus_1' })
    const row = screen.getByRole('button', { name: 'Choose who this is for' })
    expect(row).toHaveTextContent('Ade Stores')
    expect(row).toHaveTextContent('14 Adeola Odeku')
    expect(row).not.toHaveTextContent('cus_1')
  })

  it('opens and closes the dropdown', async () => {
    const user = userEvent.setup()
    renderPicker()
    const row = screen.getByRole('button', { name: 'Choose who this is for' })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })
})

describe('The searchable dropdown (§G)', () => {
  it('lists everyone until something is typed', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    expect(screen.getByRole('button', { name: /Ade Stores/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bisi Okoro/ })).toBeInTheDocument()
  })

  it('narrows by name, phone and address', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))

    await user.type(screen.getByRole('searchbox'), 'adeola')
    expect(screen.getByRole('button', { name: /Ade Stores/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bisi Okoro/ })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), '803')
    expect(screen.getByRole('button', { name: /Ade Stores/ })).toBeInTheDocument()
  })

  it('chooses somebody and closes', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    await user.click(screen.getByRole('button', { name: /Bisi Okoro/ }))
    expect(props.onSelect).toHaveBeenCalledWith('cus_2')
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})

describe('"+ Add…" carries whatever was typed (§G)', () => {
  it('offers to add the typed name, prefilled', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    await user.type(screen.getByRole('searchbox'), 'Chinedu Motors')

    await user.click(screen.getByRole('button', { name: 'Add "Chinedu Motors"' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Chinedu Motors')
  })

  it('saves the new customer without the name being retyped', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    await user.type(screen.getByRole('searchbox'), 'Chinedu Motors')
    await user.click(screen.getByRole('button', { name: 'Add "Chinedu Motors"' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chinedu Motors', labels: [] }),
    )
  })

  it('offers no add row until something is typed', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    expect(screen.queryByRole('button', { name: /^Add "/ })).not.toBeInTheDocument()
  })

  it('says so when nothing matched and nothing is typed', async () => {
    const user = userEvent.setup()
    renderPicker({ customers: [] })
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    expect(screen.getByText('No match. Type a name and add it.')).toBeInTheDocument()
  })

  it('the card header + goes straight to a blank form', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: 'Add a customer' }))
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })
})

describe('The chips (§G)', () => {
  it('offers Chat and Call as real handoffs', () => {
    renderPicker({ selectedId: 'cus_1' })
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute(
      'href',
      'https://wa.me/2348031112222',
    )
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+234 803 111 2222')
  })

  it('leaves them out for somebody with no phone number', () => {
    renderPicker({ selectedId: 'cus_2' })
    expect(screen.queryByRole('link', { name: 'Chat' })).not.toBeInTheDocument()
  })

  it('shows the real outstanding balance', () => {
    renderPicker({ selectedId: 'cus_1', invoices: [invoice], payments: [part] })
    expect(screen.getByText('Owes ₦95,000.00')).toBeInTheDocument()
  })

  it('says settled when nothing is owed', () => {
    renderPicker({ selectedId: 'cus_1' })
    expect(screen.getByText('Settled')).toBeInTheDocument()
  })

  it('shows one chip per currency rather than a merged figure (§G)', () => {
    renderPicker({
      selectedId: 'cus_1',
      invoices: [invoice, { ...invoice, id: 'doc_2', total: money('USD', 400_00) }],
    })
    expect(screen.getByText('Owes ₦145,000.00')).toBeInTheDocument()
    expect(screen.getByText('Owes $400.00')).toBeInTheDocument()
  })

  it('shows no balance chip on a delivery document, which carries no money', () => {
    renderPicker({
      selectedId: 'cus_1',
      invoices: [invoice],
      payments: [part],
      showBalance: false,
    })
    expect(screen.queryByText(/Owes/)).not.toBeInTheDocument()
    expect(screen.queryByText('Settled')).not.toBeInTheDocument()
    // Chat and Call still belong there — they are not money.
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
  })
})

describe('Nothing is chosen by accident', () => {
  it('does not select anybody just by opening the dropdown', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: 'Choose who this is for' }))
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('leaves the row unchanged when the add form is cancelled', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: 'Add a customer' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onAdd).not.toHaveBeenCalled()
    expect(screen.getByText('Nobody chosen yet')).toBeInTheDocument()
  })
})
