/**
 * Adding a way to be paid without leaving the invoice (§J, §G, Rule #5).
 *
 * The trader is mid-invoice and realises this customer should pay by MoMo.
 * Four screens away and back is four chances to lose the draft they were
 * halfway through, so the same list opens here.
 *
 * Three properties, and the third is the one that would quietly ruin a
 * business's other invoices if it went the other way:
 *
 *  · what is ADDED here is usable on this document at once;
 *  · what is REMOVED here is removed here and nowhere else;
 *  · an addition reaches the defaults, and one tap takes it back — but a
 *    REMOVAL never does, because switching a method off for one awkward
 *    customer must not delete that account from every future invoice.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { DocumentPaymentLinks } from './DocumentPaymentLinks'
import type { SavedPaymentLink } from '../../domain/payments/links'

const PAYSTACK: SavedPaymentLink = {
  provider: 'paystack_page',
  value: 'paystack.com/pay/dynamic',
}
const FLUTTERWAVE: SavedPaymentLink = {
  provider: 'flutterwave_page',
  value: 'flutterwave.com/pay/dynamic',
}

const open = async (
  over: Partial<React.ComponentProps<typeof DocumentPaymentLinks>> = {},
) => {
  const onDocument = vi.fn()
  const onDefaults = vi.fn()
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <DocumentPaymentLinks
        country="NG"
        defaults={[PAYSTACK]}
        own={undefined}
        onDocument={onDocument}
        onDefaults={onDefaults}
        {...over}
      />
    </CompanyProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: /Add a payment method/ }))
  return { onDocument, onDefaults }
}

describe('The + on the document opens the same list (§J, §G)', () => {
  /** Rule #1: a mid-invoice afterthought costs a button, not a section. */
  it('shows nothing but a button until it is asked for', () => {
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <DocumentPaymentLinks
          country="NG"
          defaults={[]}
          own={undefined}
          onDocument={vi.fn()}
          onDefaults={vi.fn()}
        />
      </CompanyProvider>,
    )
    expect(screen.queryByRole('button', { name: /Add Paystack/ })).toBeNull()
  })

  /**
   * THE SAME ORDER AS SETTINGS, because it is the same component. A Nigerian
   * trader sees what a Nigerian trader sees, wherever they opened it.
   */
  it('offers the country’s providers, in the same order', async () => {
    await open()
    const names = screen
      .getAllByRole('button', { name: /^Add |^Remove /i })
      .map((button) => button.getAttribute('aria-label') ?? '')
      .join(' ')

    expect(names).toContain('Paystack')
    expect(names).toContain('Flutterwave')
    expect(names, 'a service that cannot receive in Nigeria was offered').not.toContain('PayPal')
  })

  it('says the changes belong to this document', async () => {
    await open()
    expect(screen.getByText(/this document only/i)).toBeInTheDocument()
  })

  /**
   * INHERITED UNTIL TOUCHED. A document with no list of its own shows the
   * business's — which is what keeps a document that never thinks about
   * payment links costing nothing (Rule #1).
   */
  it('starts from the business’s defaults', async () => {
    await open()
    expect(screen.getByText('paystack.com/pay/dynamic')).toBeInTheDocument()
  })
})

describe('Added here, and kept as a default unless they say otherwise (§J)', () => {
  /**
   * THE ONE THIS IS FOR. Pasting a link and then being asked a question about
   * future documents is a form where no decision was needed, so it is saved
   * and SAID, with one tap to take it back.
   */
  it('puts a new link on the document and in the defaults', async () => {
    const user = userEvent.setup()
    const { onDocument, onDefaults } = await open()

    await user.click(screen.getByRole('button', { name: /Add Flutterwave/ }))
    await user.type(screen.getByLabelText('Flutterwave'), 'flutterwave.com/pay/dynamic')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onDocument).toHaveBeenCalledWith([PAYSTACK, FLUTTERWAVE])
    expect(onDefaults, 'the default was not saved').toHaveBeenCalledWith([PAYSTACK, FLUTTERWAVE])
  })

  it('says so, rather than saving it silently', async () => {
    const user = userEvent.setup()
    await open()

    await user.click(screen.getByRole('button', { name: /Add Flutterwave/ }))
    await user.type(screen.getByLabelText('Flutterwave'), 'flutterwave.com/pay/dynamic')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(screen.getByRole('status').textContent).toContain('future documents')
  })

  /** One tap back to this-document-only, and the link stays on the document. */
  it('takes the default back without taking the link off the document', async () => {
    const user = userEvent.setup()
    const { onDocument, onDefaults } = await open()

    await user.click(screen.getByRole('button', { name: /Add Flutterwave/ }))
    await user.type(screen.getByLabelText('Flutterwave'), 'flutterwave.com/pay/dynamic')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))
    await user.click(screen.getByRole('button', { name: 'Just this one' }))

    // The defaults go back to what they were …
    expect(onDefaults).toHaveBeenLastCalledWith([PAYSTACK])
    // … and the document keeps it: the last thing written to it still has it.
    expect(onDocument).toHaveBeenLastCalledWith([PAYSTACK, FLUTTERWAVE])
  })
})

describe('Switched off here stays off here (§J, Rule #5)', () => {
  /**
   * THE ONE THAT WOULD HAVE HURT. A trader who takes Paystack off one invoice
   * for one awkward customer must not find it gone from every future
   * invoice — a per-document decision pushed into the defaults deletes an
   * account from a business because of one job.
   */
  it('removes a method from the document and leaves the defaults alone', async () => {
    const user = userEvent.setup()
    const { onDocument, onDefaults } = await open({ own: [PAYSTACK, FLUTTERWAVE] })

    await user.click(screen.getByRole('button', { name: /Remove Flutterwave/ }))
    await user.clear(screen.getByLabelText('Flutterwave'))
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onDocument).toHaveBeenCalledWith([PAYSTACK])
    expect(onDefaults, 'a removal on one document changed the business').not.toHaveBeenCalled()
  })

  /** And a document already carrying its own list is what gets shown. */
  it('shows the document’s own list, not the business’s', async () => {
    await open({ own: [FLUTTERWAVE], defaults: [PAYSTACK] })

    expect(screen.getByText('flutterwave.com/pay/dynamic')).toBeInTheDocument()
    expect(screen.queryByText('paystack.com/pay/dynamic')).toBeNull()
  })
})
