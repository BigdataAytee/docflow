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
  onToggle = vi.fn(),
  enabled: readonly string[] = links.map((link) => link.provider),
) => {
  wrap(
    <PaymentLinkSection
      country={country}
      links={links}
      onChange={onChange}
      enabled={enabled}
      onToggle={onToggle}
    />,
  )
  return onChange
}

/**
 * Every provider row on screen.
 *
 * A row is one button now — the whole thing opens that method's fields — so
 * its accessible name is composed from what it shows: the provider, the line
 * under it, and the state. Reading the provider off the front of that is what
 * these assertions want.
 */
const listed = (): string =>
  screen
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .join(' | ')

/**
 * Opens one provider's fields by tapping its row.
 *
 * By ACCESSIBLE NAME, not `textContent`: the lettered fallback badge is
 * `aria-hidden`, so a row for Paystack reads "PPaystack …" to `textContent`
 * and "Paystack …" to anybody using the page. The second one is the row.
 */
const openRow = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}\\.`) }))
}

describe('Only what can receive money here is offered (§J, §N)', () => {
  /**
   * THE ONE THE OWNER ASKED FOR. No popup, no warning, no region selector —
   * the wrong options are simply not there.
   */
  it('offers a Nigerian trader Paystack and Flutterwave, and not PayPal', () => {
    section('NG')

    expect(listed()).toContain('Paystack')
    expect(listed()).toContain('Flutterwave')
    expect(
      listed(),
      'a service that cannot receive in Nigeria was offered by default',
    ).not.toContain('PayPal')
  })

  it('offers a German trader PayPal, Wise, Revolut and Stripe', () => {
    section('DE')
    const names = listed()
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
    const names = listed()
    for (const provider of ['PayPal', 'Wise', 'Paystack', 'Payment link']) {
      expect(names, `${provider} unreachable from ${country}`).toContain(provider)
    }
  })

  /** And it shuts again, because a list nobody needs should not stay open. */
  it('opens and closes the rest of the list', async () => {
    const user = userEvent.setup()
    section('NG')

    await user.click(screen.getByRole('button', { name: 'Use a different service' }))
    expect(listed()).toContain('PayPal')

    await user.click(screen.getByRole('button', { name: 'Hide the other services' }))
    expect(listed()).not.toContain('PayPal')
  })

  /**
   * A SAVED ONE NEVER HIDES. Somebody who added PayPal from "Use a different
   * service" last month must not open Settings and find it gone — what they
   * set up is theirs, and hiding it reads as losing it.
   */
  it('keeps showing a link added from the full list', () => {
    section('NG', [{ provider: 'paypal_me', value: 'paypal.me/ade' }])

    expect(listed()).toContain('PayPal')
    expect(screen.getByText('paypal.me/ade')).toBeInTheDocument()
  })

  /**
   * AND SAYS SO when one that cannot receive here is opened anyway. Told,
   * not argued with: they reached it deliberately (§N).
   */
  it('notes that a provider may not receive where the trader is', async () => {
    const user = userEvent.setup()
    section('NG', [{ provider: 'paypal_me', value: 'paypal.me/ade' }])

    await openRow(user, 'PayPal')
    expect(screen.getByText(/may not be able to receive money in Nigeria/)).toBeInTheDocument()
  })

  it('says nothing of the kind about one that can', async () => {
    const user = userEvent.setup()
    section('NG')

    await openRow(user, 'Paystack')
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

    await openRow(user, 'Paystack')
    expect(screen.getByLabelText('Paystack link')).toHaveAttribute(
      'placeholder',
      'paystack.com/pay/your-page',
    )
  })

  /** One tap, not a long-press and a cursor to fight with. */
  it('offers a Paste button', async () => {
    const user = userEvent.setup()
    section('NG')

    await openRow(user, 'Paystack')
    expect(screen.getByRole('button', { name: 'Paste' })).toBeInTheDocument()
  })

  /**
   * THE ONE THIS IS FOR. A full URL with tracking on it stores the same value
   * as the bare handle would, because both are the same account.
   */
  it('stores one value whatever shape was pasted', async () => {
    const user = userEvent.setup()
    const onChange = section('NG')

    await openRow(user, 'Paystack')
    await user.type(
      screen.getByLabelText('Paystack link'),
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

    await openRow(user, 'Paystack')
    await user.type(screen.getByLabelText('Paystack link'), 'dynamic')

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

    await openRow(user, 'Paystack')
    await user.type(screen.getByLabelText('Paystack link'), 'wise.com/pay/me/ade')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(screen.getByLabelText('Paystack link')).toHaveValue('wise.com/pay/me/ade')
    expect(screen.getByRole('alert').textContent).toContain('Paystack')
    expect(onChange, 'a link that was refused was saved anyway').not.toHaveBeenCalled()
  })

  /** One sentence on where to find it, in the app — never a help article. */
  it('says where to find the link', async () => {
    const user = userEvent.setup()
    section('DE')

    await openRow(user, 'PayPal')
    expect(screen.getByText(/Send & Request/)).toBeInTheDocument()
  })

  /** Clearing the field removes the method rather than saving an empty one. */
  it('removes a link when the field is emptied', async () => {
    const user = userEvent.setup()
    const onChange = section('NG', [
      { provider: 'paystack_page', value: 'paystack.com/pay/dynamic' },
    ])

    await openRow(user, 'Paystack')
    await user.clear(screen.getByLabelText('Paystack link'))
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onChange).toHaveBeenCalledWith([])
  })
})

/**
 * Saved and switched on are two different things (§J).
 *
 * The owner's rule: "the on and off determines the ones that shows". A trader
 * who pasted their PayPal link has not necessarily decided every invoice
 * should carry it, and §J says the same of every other method — "each off
 * until added". Both were one button, so "On" only meant "has a value", and
 * the only way to stop printing a link was to delete it and paste it back.
 */
describe('On and off decides what prints (§J)', () => {
  /**
   * THE SWITCH MOVED, and the rule did not.
   *
   * The row is one tap target now — it opens the method's fields — so the
   * switch lives inside them, beside the account it governs. Two competing
   * targets in a 56px row is how somebody switches a method off while
   * reaching for its details.
   */
  it('switches a saved link off from inside its fields', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onToggle = vi.fn()
    section('NG', [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }], onChange, onToggle)

    await openRow(user, 'Paystack')
    await user.click(screen.getByRole('switch'))

    expect(onToggle).toHaveBeenCalledWith('paystack_page', false)
    expect(onChange, 'switching it off deleted the link').not.toHaveBeenCalled()
  })

  /** The row says which state it is in, without being the control. */
  it('shows Off, and the link, when one is saved but not switched on', () => {
    section(
      'NG',
      [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }],
      vi.fn(),
      vi.fn(),
      [],
    )

    expect(listed(), 'the row does not say it is off').toContain('Off')
    expect(screen.getByText('paystack.com/pay/dynamic')).toBeInTheDocument()
  })

  it('shows On when it is', () => {
    section('NG', [{ provider: 'paystack_page', value: 'paystack.com/pay/dynamic' }])
    expect(listed()).toContain('Paystack. paystack.com/pay/dynamic. On')
  })

  /** Pasting one is saying you want it used; a second step would be a toll. */
  it('switches a newly pasted link on', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    section('NG', [], vi.fn(), onToggle, [])

    await openRow(user, 'Paystack')
    await user.type(screen.getByLabelText('Paystack link'), 'paystack.com/pay/dynamic')
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onToggle).toHaveBeenCalledWith('paystack_page', true)
  })

  /** And a row with no link yet has nothing to switch. */
  it('offers no switch before there is a link', async () => {
    const user = userEvent.setup()
    section('NG', [], vi.fn(), vi.fn(), [])

    await openRow(user, 'Paystack')
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
