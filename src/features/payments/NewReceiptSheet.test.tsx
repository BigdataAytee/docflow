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
/*
 * SOMEBODY WHO OWES NOTHING, which the fixture had no one of — both customers
 * carried an invoice, so "no card when there is nothing to apply it to" could
 * not be tested at all and the first attempt at it passed for the wrong
 * reason: it picked a customer who owed ₦5,000.
 */
const CHIKE = { id: 'cus_3', companyId: 'co_1', kind: 'person' as const, name: 'Chike', labels: [] }

function renderSheet(over: Partial<React.ComponentProps<typeof NewReceiptSheet>> = {}) {
  const props: React.ComponentProps<typeof NewReceiptSheet> = {
    currency: 'NGN',
    today: '2026-09-12',
    customers: [ADE, BISI, CHIKE],
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
  /*
   * A customer who owes NOTHING. It used to say this to everybody, because
   * the note sat under a select that was always drawn; now a customer with
   * unpaid invoices gets the card instead, and this line is what the other
   * case says.
   */
  it('says what happens to money nothing is billed for', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_3')
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

/**
 * What they owe, said out loud (§G, §K).
 *
 * This was a `<select>` labelled "Against" with a faint line under it — a
 * control somebody had to already know about to notice, offering the one act
 * that makes a receipt do more than acknowledge cash. A first-time owner
 * never found it, which is the complaint these cases are written from.
 */
describe('The invoice link is a card, not a hidden select (§G)', () => {
  const card = () => document.querySelector('[data-owes-card]')

  it('says nothing about invoices until the payer is named', () => {
    renderSheet()
    expect(card()).toBeNull()
    expect(
      screen.getByText('Say who paid, and anything they still owe appears here.'),
    ).toBeInTheDocument()
  })

  /** THE ONE THIS IS FOR: a statement, in plain words, that cannot be missed. */
  it('states what this customer owes, and offers one control', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')

    expect(card()).not.toBeNull()
    expect(card()?.textContent).toContain('Ade Stores owes ₦95,000.00 on 1 invoice')
    expect(screen.getByRole('button', { name: 'Apply this to an invoice' })).toBeInTheDocument()
  })

  /** No card at all when there is nothing to apply it to. */
  it('offers no card to a customer who owes nothing', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_3')
    expect(card()).toBeNull()
    expect(
      screen.getByText('Nothing is billed for it. The money sits as customer credit.'),
    ).toBeInTheDocument()
  })

  it('offers this payer’s own balance and not another customer’s', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))

    expect(screen.getByRole('button', { name: /INV-0042/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /INV-0043/ })).not.toBeInTheDocument()
  })

  it('shows what is still owed beside each one', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    expect(screen.getByRole('button', { name: /INV-0042.*₦95,000.00 left/ })).toBeInTheDocument()
  })

  /**
   * PAYING IN FULL COSTS NO TYPING — the spec's point. Choosing an invoice
   * fills the amount when the field is still empty.
   */
  it('fills the amount with the full balance when nothing has been typed', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    await user.click(screen.getByRole('button', { name: /INV-0042/ }))

    expect(screen.getByLabelText('How much came in?')).toHaveValue('95000')
  })

  /**
   * AND NEVER OVERWRITES ONE. A part payment is the ordinary case, and
   * replacing a figure somebody has already typed would silently change what
   * they said came in.
   */
  it('leaves an amount already typed exactly as it was', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.type(screen.getByLabelText('How much came in?'), '5000')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    await user.click(screen.getByRole('button', { name: /INV-0042/ }))

    expect(screen.getByLabelText('How much came in?')).toHaveValue('5000')
  })

  it('passes the chosen balance through when there is one', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    await user.click(screen.getByRole('button', { name: /INV-0042/ }))
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBe('doc_a')
  })

  /** Choosing none leaves an ordinary receipt. */
  it('records no allocation when none of them is chosen', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    await user.click(screen.getByRole('button', { name: 'None of them — this stands on its own' }))
    await user.type(screen.getByLabelText('How much came in?'), '5000')
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBeUndefined()
  })

  it('drops a balance chosen for the previous payer when the payer changes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_1')
    await user.click(screen.getByRole('button', { name: 'Apply this to an invoice' }))
    await user.click(screen.getByRole('button', { name: /INV-0042/ }))

    // Second thoughts about who paid. The allocation belonged to the customer
    // who is no longer selected, and must not follow them.
    await user.selectOptions(screen.getByLabelText('Who paid?'), 'cus_3')
    expect(
      screen.getByText('Nothing is billed for it. The money sits as customer credit.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].customerId).toBe('cus_3')
    expect(vi.mocked(props.onRecord).mock.calls[0]?.[0].invoiceId).toBeUndefined()
  })
})

describe('A failure is said, not swallowed', () => {
  it('announces the reason it could not be recorded', () => {
    renderSheet({ error: 'That could not be recorded: no space left' })
    expect(screen.getByRole('alert')).toHaveTextContent('no space left')
  })
})
