/**
 * The Currency & Payment card (§G step 1, §J).
 *
 * Two things were wrong with it, and both were the card failing to be what
 * §G already said it was.
 *
 *  · THE CURRENCY PICKER WAS NOT A PICKER. §G: "currency picker left
 *    (defaulted from region, freely changeable)". The card printed the code
 *    as plain text, so the default was there and the control was not — a
 *    trader billing a customer abroad had the first field on the card and no
 *    way to change it.
 *  · THE + BELONGED IN SETTINGS. An inline list of payment links was tried
 *    here and was wrong: it put a business-wide setting inside one document's
 *    editing area, where a change reads as belonging to the document in front
 *    of you. It is the same `+` as BILL TO's now, and it goes where that is
 *    set up.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { DetailsStep } from './DetailsStep'
import type { DocumentDraft } from './builder'

const draft: DocumentDraft = {
  type: 'invoice',
  currency: 'NGN',
  lineItems: [],
}

const card = (over: Partial<React.ComponentProps<typeof DetailsStep>> = {}) => {
  const onChange = vi.fn()
  const onSetUpPayment = vi.fn()
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <DetailsStep
        draft={draft}
        reference="INV-0001"
        enabledPaymentMethodCount={0}
        currencies={['GBP', 'NGN', 'USD']}
        customers={[]}
        invoices={[]}
        payments={[]}
        onChange={onChange}
        onAddCustomer={vi.fn()}
        onSetUpPayment={onSetUpPayment}
        onSign={vi.fn()}
        {...over}
      />
    </CompanyProvider>,
  )
  return { onChange, onSetUpPayment }
}

describe('§G’s currency picker is a picker', () => {
  /**
   * THE ONE THIS IS FOR. `getByRole('combobox')` rather than reading the
   * text: the old card DID show "NGN", correctly, and was still missing the
   * control §G asks for. Asserting the value would have passed on it.
   */
  it('offers every currency, not just the one already chosen', () => {
    card()

    const picker = screen.getByRole('combobox', { name: 'Currency' })
    expect(picker).toHaveValue('NGN')
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
      'the card names the currency without offering any other',
    ).toEqual(['GBP', 'NGN', 'USD'])
  })

  it('changes the document’s currency when one is picked', async () => {
    const user = userEvent.setup()
    const { onChange } = card()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Currency' }), 'GBP')
    expect(onChange).toHaveBeenCalledWith({ currency: 'GBP' })
  })
})

describe('The + goes where payment is set up (§G, §J)', () => {
  /**
   * The same control BILL TO carries, doing the same kind of thing. Not an
   * inline list: what a business can be paid through is a fact about the
   * business, and editing it inside one invoice reads as editing that
   * invoice.
   */
  it('takes the trader to Settings rather than opening a list here', async () => {
    const user = userEvent.setup()
    const { onSetUpPayment } = card()

    await user.click(screen.getByRole('button', { name: 'Add a payment method' }))

    expect(onSetUpPayment).toHaveBeenCalled()
    expect(
      screen.queryByText('Use a different service'),
      'the payment-link list opened inside the document',
    ).toBeNull()
  })

  /** And it is there whether or not anything is set up yet. */
  it.each([0, 2])('offers the + with %i methods ready', async (count) => {
    const user = userEvent.setup()
    const { onSetUpPayment } = card({ enabledPaymentMethodCount: count })

    await user.click(screen.getByRole('button', { name: 'Add a payment method' }))
    expect(onSetUpPayment).toHaveBeenCalled()
  })

  /** The chip still says what the state is, which is the card's other job. */
  it('says how many ways there are to be paid', () => {
    card({ enabledPaymentMethodCount: 2 })
    expect(screen.getByText(/2 payment/i)).toBeInTheDocument()
  })

  it('asks for setup when there are none', () => {
    card({ enabledPaymentMethodCount: 0 })
    expect(screen.getByRole('button', { name: /Set up payment/i })).toBeInTheDocument()
  })
})
