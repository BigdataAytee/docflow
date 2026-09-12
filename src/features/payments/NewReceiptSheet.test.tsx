/**
 * Starting a receipt (§G, §K).
 *
 * The sheet is a PAYMENT form. These hold that it cannot produce anything
 * without the money, that "standing alone" is said out loud, and that it never
 * offers a balance this money could not settle.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { NewReceiptSheet } from './NewReceiptSheet'

const NGN = (m: number) => money('NGN', m)

const ADE = { id: 'cus_1', companyId: 'co_1', kind: 'company' as const, name: 'Ade Stores', labels: [] }
const BISI = { id: 'cus_2', companyId: 'co_1', kind: 'person' as const, name: 'Bisi', labels: [] }

function renderSheet(over: Partial<React.ComponentProps<typeof NewReceiptSheet>> = {}) {
  const props: React.ComponentProps<typeof NewReceiptSheet> = {
    currency: 'NGN',
    today: '2026-09-12',
    customers: [ADE, BISI],
    invoices: [
      { id: 'doc_a', customerId: 'cus_1', reference: 'INV-0042', outstanding: NGN(95_000_00) },
      { id: 'doc_b', customerId: 'cus_2', reference: 'INV-0043', outstanding: NGN(5_000_00) },
    ],
    methods: [{ id: 'bank_transfer', name: 'Bank transfer' }],
    onRecord: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <NewReceiptSheet {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('Nothing is recorded without an amount and a payer (§G)', () => {
  it('will not record on an empty form', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Record it' })).toBeDisabled()
  })

  it('will not record an amount from nobody', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText('How much came in?'), '5000')
    expect(screen.getByRole('button', { name: 'Record it' })).toBeDisabled()
  })

  it('will not record nothing from somebody', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    expect(screen.getByRole('button', { name: 'Record it' })).toBeDisabled()
  })

  it('records money in minor units, never a float (Rule #3)', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.type(screen.getByLabelText('How much came in?'), '50,000.50')
    await user.click(screen.getByRole('button', { name: 'Record it' }))

    expect(props.onRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_1',
        amount: NGN(50_000_50),
        paidAt: '2026-09-12',
        method: 'bank_transfer',
      }),
    )
  })
})

describe('Standing alone is a choice, said out loud (§G, §K)', () => {
  it('says what happens to money nothing is billed for', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    expect(
      screen.getByText('Nothing is billed for it. The money sits as customer credit.'),
    ).toBeInTheDocument()
  })

  it('records no allocation when it stands alone', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.type(screen.getByLabelText('How much came in?'), '5000')
    await user.click(screen.getByRole('button', { name: 'Record it' }))

    expect(props.onRecord).toHaveBeenCalledTimes(1)
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBeUndefined()
  })

  it('leaves the reference off rather than sending an empty one', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.type(screen.getByLabelText('How much came in?'), '5000')
    await user.type(screen.getByLabelText('Their reference'), '   ')
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].reference).toBeUndefined()
  })
})

describe('The picker offers only what this money could settle (§G)', () => {
  it('offers nothing to settle until the payer is named, and says why', () => {
    renderSheet()
    expect(screen.getByLabelText('Against')).toBeDisabled()
    expect(
      screen.getByText('Say who paid, and anything they still owe appears here.'),
    ).toBeInTheDocument()
  })

  it('offers this payer own balance and not another customer', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')

    const against = screen.getByLabelText('Against')
    expect(against).toBeEnabled()
    expect(screen.getByRole('option', { name: /INV-0042/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /INV-0043/ })).not.toBeInTheDocument()
  })

  it('drops a balance chosen for the previous payer when the payer changes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.selectOptions(screen.getByLabelText('Against'), 'doc_a')
    await user.type(screen.getByLabelText('How much came in?'), '5000')

    // Second thoughts about who paid. The field has to show the truth, not a
    // balance belonging to the customer who is no longer selected — and it
    // has to say again that this money now stands alone.
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_2')
    expect(screen.getByLabelText('Against')).toHaveValue('')
    expect(
      screen.getByText('Nothing is billed for it. The money sits as customer credit.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].customerId).toBe('cus_2')
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBeUndefined()
  })

  it('passes the chosen balance through when there is one', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.type(screen.getByLabelText('How much came in?'), '95000')
    await user.selectOptions(screen.getByLabelText('Against'), 'doc_a')
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBe('doc_a')
  })

  it('shows what is still owed beside each one, so the amount is obvious', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    expect(screen.getByRole('option', { name: 'INV-0042 · ₦95,000.00' })).toBeInTheDocument()
  })
})

describe('A failure is said, not swallowed', () => {
  it('announces the reason it could not be recorded', () => {
    renderSheet({ error: 'That could not be recorded: no space left' })
    expect(screen.getByRole('alert')).toHaveTextContent('no space left')
  })
})
