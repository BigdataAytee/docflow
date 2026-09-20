/**
 * Offering the right links, and letting somebody paste one (§J, §K, §N).
 *
 * Two properties, and the second is the one that decides whether the feature
 * is used at all.
 *
 *  · WHAT IS OFFERED follows the country the app already detected. A Nigerian
 *    trader sees Paystack and Flutterwave; nothing that cannot receive money
 *    where they are appears by default. And nothing is locked away: one quiet
 *    line reaches every provider from anywhere, because an automatic choice
 *    is a default and not a gate.
 *  · PASTING has to survive whatever landed on the clipboard, and say what is
 *    wrong without taking anything away (§K).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { PaymentLinkSection } from './PaymentLinkSection'
import type { SavedPaymentLink } from '../../domain/payments/links'

const wrap = (node: React.ReactNode) =>
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )

const section = (
  country: string,
  links: readonly SavedPaymentLink[] = [],
  onChange = vi.fn(),
) => {
  wrap(<PaymentLinkSection country={country} links={links} onChange={onChange} />)
  return onChange
}

const listed = (): string[] =>
  screen
    .queryAllByRole('button', { name: /^Add |^Remove /i })
    .map((button) => button.getAttribute('aria-label') ?? '')

describe('Only what can receive money here is offered (§J, §N)', () => {
  /**
   * THE ONE THE OWNER ASKED FOR. No popup, no warning, no region selector —
   * the wrong options are simply not there.
   */
  it('offers a Nigerian trader Paystack and Flutterwave, and not PayPal', () => {
    section('NG')

    expect(listed().join(' ')).toContain('Paystack')
    expect(listed().join(' ')).toContain('Flutterwave')
    expect(
      listed().join(' '),
      'a service that cannot receive in Nigeria was offered by default',
    ).not.toContain('PayPal')
  })

  it('offers a German trader PayPal, Wise, Revolut and Stripe', () => {
    section('DE')
    const names = listed().join(' ')
    for (const provider of ['PayPal', 'Wise', 'Revolut', 'Stripe']) {
      expect(names, `${provider} was missing in Germany`).toContain(provider)
    }
  })

  /**
   * AND NOTHING IS LOCKED AWAY. The country list that shipped with thirteen
   * entries is the lesson: detection that cannot be overridden is a bug
   * waiting for the first person it is wrong about.
   */
  it.each(['NG', 'DE', 'ZZ'])('reaches every provider from %s', async (country) => {
    const user = userEvent.setup()
    section(country)

    await user.click(screen.getByRole('button', { name: 'Use a different service' }))
    const names = listed().join(' ')
    for (const provider of ['PayPal', 'Wise', 'Paystack', 'Payment link']) {
      expect(names, `${provider} unreachable from ${country}`).toContain(provider)
    }
  })

  /** And it shuts again, because a list nobody needs should not stay open. */
  it('opens and closes the rest of the list', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: 'Use a different service' }))
    expect(listed().join(' ')).toContain('PayPal')

    await user.click(screen.getByRole('button', { name: 'Hide the other services' }))
    expect(listed().join(' ')).not.toContain('PayPal')
  })

  /**
   * A SAVED ONE NEVER HIDES. Somebody who added PayPal from "Use a different
   * service" last month must not open Settings and find it gone — what they
   * set up is theirs, and hiding it reads as losing it.
   */
  it('keeps showing a link added from the full list', () => {
    section('NG', [{ provider: 'paypal_me', value: 'paypal.me/ade' }])

    expect(listed().join(' ')).toContain('PayPal')
    expect(screen.getByText('paypal.me/ade')).toBeInTheDocument()
  })

  /**
   * AND SAYS SO when one that cannot receive here is opened anyway. Told,
   * not argued with: they reached it deliberately (§N).
   */
  it('notes that a provider may not receive where the trader is', async () => {
    const user = userEvent.setup()
    section('NG', [{ provider: 'paypal_me', value: 'paypal.me/ade' }])

    await user.click(screen.getByRole('button', { name: /Remove PayPal/ }))
    expect(screen.getByText(/may not be able to receive money in Nigeria/)).toBeInTheDocument()
  })

  it('says nothing of the kind about one that can', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    expect(screen.queryByText(/may not be able to receive/)).toBeNull()
  })
})

describe('Pasting a link, and being told what is wrong (§J, §K)', () => {
  /**
   * THE PLACEHOLDER IS THE SHAPE. `paypal.me/yourname` says everything a
   * sentence of instructions would, and it is the same string the normaliser
   * completes a bare handle with — one declaration, not two.
   */
  it('shows the expected shape in the field', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    expect(screen.getByLabelText('Paystack')).toHaveAttribute(
      'placeholder',
      'paystack.com/pay/your-page',
    )
  })

  /** One tap, not a long-press and a cursor to fight with. */
  it('offers a Paste button', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument()
  })

  /**
   * THE ONE THIS IS FOR. A full URL with tracking on it stores the same value
   * as the bare handle would, because both are the same account.
   */
  it('stores one value whatever shape was pasted', async () => {
    const user = userEvent.setup()
    const onChange = section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    await user.type(
      screen.getByLabelText('Paystack'),
      'https://www.paystack.com/pay/dynamic/?utm_source=wa',
    )
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onChange).toHaveBeenCalledWith([
      { provider: 'paystack_page', value: 'paystack.com/pay/dynamic' },
    ])
  })

  /**
   * WHAT PRINTS IS SHOWN WHILE THEY TYPE — and it is the same function the
   * composed page calls, so it is the line, not a preview of one (§J).
   */
  it('shows the printed line before anything is generated', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    await user.type(screen.getByLabelText('Paystack'), 'dynamic')

    const preview = document.querySelector('[data-link-preview]')
    expect(preview?.textContent).toContain('Paystack — paystack.com/pay/dynamic')
  })

  /**
   * §K: "a specific inline message beside the field, input retained". The
   * second half is the one that gets broken, so it is asserted first.
   */
  it('keeps what was typed when it cannot be used', async () => {
    const user = userEvent.setup()
    const onChange = section('NG')

    await user.click(screen.getByRole('button', { name: /Add Paystack/ }))
    await user.type(screen.getByLabelText('Paystack'), 'wise.com/pay/me/ade')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(screen.getByLabelText('Paystack')).toHaveValue('wise.com/pay/me/ade')
    expect(screen.getByRole('alert').textContent).toContain('Paystack')
    expect(onChange, 'a link that was refused was saved anyway').not.toHaveBeenCalled()
  })

  /** One sentence on where to find it, in the app — never a help article. */
  it('says where to find the link', async () => {
    const user = userEvent.setup()
    section('DE')

    await user.click(screen.getByRole('button', { name: /Add PayPal/ }))
    expect(screen.getByText(/Send & Request/)).toBeInTheDocument()
  })

  /** Clearing the field removes the method rather than saving an empty one. */
  it('removes a link when the field is emptied', async () => {
    const user = userEvent.setup()
    const onChange = section('NG', [
      { provider: 'paystack_page', value: 'paystack.com/pay/dynamic' },
    ])

    await user.click(screen.getByRole('button', { name: /Remove Paystack/ }))
    await user.clear(screen.getByLabelText('Paystack'))
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onChange).toHaveBeenCalledWith([])
  })
})
