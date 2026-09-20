/**
 * Adding a payment method, and the country that decides its fields (§J, §K).
 *
 * Two things were wrong with "How you get paid", and both were about asking
 * the wrong question at the wrong time.
 *
 *  · THE FORM CAME BEFORE THE DECISION. The screen opened with three empty
 *    bank fields at the top, above the list of methods where the actual
 *    choice is — so somebody who only takes cash on delivery still had to
 *    scroll past somebody else's bank account. The fields belong to bank
 *    transfer; they come out when it does.
 *  · THE QUESTION WAS THE CURRENCY. §J keys its table to the currency, which
 *    is the right key for a lookup and the wrong question for a person:
 *    nobody knows their account as "an NGN account", they know it is a
 *    Nigerian one. The screen asks where the bank is and resolves the
 *    currency from it — §J's definition unchanged, still the only source of
 *    field sets, so nothing here invents a banking rule.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { PaymentSettings, currencyForCountry } from './PaymentSettings'

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

const methods = (bankOn: boolean) => [
  { id: 'bank_transfer', name: 'Bank transfer', enabled: bankOn },
  { id: 'cash_on_delivery', name: 'Cash on delivery', enabled: false },
]

const screenWith = (over: Partial<React.ComponentProps<typeof PaymentSettings>> = {}) =>
  wrap(
    <PaymentSettings
      currency="NGN"
      region="NG"
      bankValues={{}}
      methods={methods(false)}
      onBankValue={vi.fn()}
      onAccountCountry={vi.fn()}
      onToggleMethod={vi.fn()}
      {...over}
    />,
  )

describe('The account form comes out when the method does (§J, Rule #1)', () => {
  /**
   * THE ONE THIS IS FOR. An owner arriving to switch on cash on delivery was
   * met by an empty bank form they had not asked for and did not want.
   */
  it('shows no bank fields until somebody asks for them', () => {
    screenWith()

    expect(screen.queryByLabelText('Bank')).toBeNull()
    expect(screen.queryByLabelText('Account number')).toBeNull()
    // The methods are the screen, and they are all there.
    expect(screen.getByText('Bank transfer')).toBeInTheDocument()
    expect(screen.getByText('Cash on delivery')).toBeInTheDocument()
  })

  it('opens them on Add, and shuts them again', async () => {
    const user = userEvent.setup()
    screenWith()

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    expect(screen.getByLabelText('Bank')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save and close' }))
    expect(screen.queryByLabelText('Bank')).toBeNull()
  })

  /**
   * ALREADY OPEN WHEN THERE IS SOMETHING WRONG. A method switched on with no
   * account behind it is a promise with nothing behind it, and leaving
   * somebody to discover which row to tap is the wrong way to say so.
   */
  it('opens itself when the method is on with no account behind it', () => {
    screenWith({ methods: methods(true) })

    expect(screen.getByLabelText('Bank')).toBeInTheDocument()
    expect(screen.getByText('Bank is needed.')).toBeInTheDocument()
  })

  /** And stays shut when the account is already there. */
  it('stays shut when there is an account to show', () => {
    screenWith({
      methods: methods(true),
      bankValues: {
        bank_name: 'Guaranty Trust Bank',
        account_number: '0123456789',
        account_name: 'Sola Ventures',
      },
    })

    expect(screen.queryByLabelText('Bank')).toBeNull()
    // §J: "the bank-transfer row shows the live account details."
    expect(screen.getByText(/Guaranty Trust Bank · 0123456789/)).toBeInTheDocument()
  })

  /**
   * FINISHING THE FORM SWITCHES IT ON. Somebody who filled in an account and
   * pressed "Save and close" has said what they want; sending them back to
   * find a chip is asking a question they already answered.
   */
  it('switches the method on when the account is complete', async () => {
    const user = userEvent.setup()
    const onToggleMethod = vi.fn()
    screenWith({
      bankValues: {
        bank_name: 'Guaranty Trust Bank',
        account_number: '0123456789',
        account_name: 'Sola Ventures',
      },
      onToggleMethod,
    })

    // Off, so the row invites rather than offers to edit: Add opens the
    // account, and finishing it is what switches the method on.
    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onToggleMethod).toHaveBeenCalledWith('bank_transfer', true)
  })

  /** But never on an account that is not filled in — that is the promise. */
  it('does not switch it on behind an incomplete account', async () => {
    const user = userEvent.setup()
    const onToggleMethod = vi.fn()
    screenWith({ bankValues: { bank_name: 'Guaranty Trust Bank' }, onToggleMethod })

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    await user.click(screen.getByRole('button', { name: 'Save and close' }))

    expect(onToggleMethod).not.toHaveBeenCalled()
  })
})

describe('The country is the question, and the fields follow it (§J)', () => {
  /** The lookup, which is all this is: §J still owns every field set. */
  it('resolves a country to its currency, and an unknown one to the fallback', () => {
    expect(currencyForCountry('NG', 'USD')).toBe('NGN')
    expect(currencyForCountry('gb', 'USD')).toBe('GBP')
    expect(currencyForCountry('ZZ', 'USD')).toBe('USD')
  })

  /**
   * THE COUNTRY IS ASKED FIRST, and pre-answered from the business's own
   * region — the app already knows it, and Rule #1 forbids asking twice.
   */
  it('asks where the account is, already set to the business’s country', async () => {
    const user = userEvent.setup()
    screenWith()
    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))

    expect(screen.getByLabelText('Which country is the account in?')).toHaveValue('NG')
  })

  /**
   * THE ONE THIS IS FOR. Pick the United Kingdom and the form becomes §J's
   * GBP set — Bank · Sort code · Account number · Account name — because that
   * is what a customer paying into a British account needs.
   */
  it('renders the fields the chosen country’s banks use', async () => {
    const user = userEvent.setup()
    screenWith({ accountCountry: 'GB' })

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    expect(screen.getByLabelText('Sort code')).toBeInTheDocument()
    expect(screen.queryByLabelText('Routing number')).toBeNull()
  })

  /**
   * §J: "switching currency re-renders the fields and says so."
   *
   * AND IT READS AS ENGLISH FOR EVERY COUNTRY. The line said "banks in
   * United Kingdom use" on the phone: the definite article belongs to a
   * handful of names and to nothing else, and an article table for 240
   * countries would be inventing linguistic data in every language §D has to
   * carry. The name leads and "there" points back at it, which is correct
   * for all of them — so this asserts the awkward one, not the easy one.
   */
  it('names the country without tripping over its article', async () => {
    const user = userEvent.setup()
    screenWith({ accountCountry: 'GB' })

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    expect(screen.getByText(/United Kingdom — the details banks there ask for/)).toBeInTheDocument()
    expect(
      screen.queryByText(/in United Kingdom/),
      'the line needs an article it cannot know',
    ).toBeNull()
  })

  /** Choosing one is a change to the company, not to this screen's state. */
  it('reports a chosen country to be stored', async () => {
    const user = userEvent.setup()
    const onAccountCountry = vi.fn()
    screenWith({ onAccountCountry })

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    await user.selectOptions(
      screen.getByLabelText('Which country is the account in?'),
      'GH',
    )

    expect(onAccountCountry).toHaveBeenCalledWith('GH')
  })

  /**
   * AND THE BUSINESS'S OWN CURRENCY IS NOT TOUCHED. What a business PRICES in
   * and where its money LANDS are two facts: a Nigerian business billing in
   * sterling has both, and this screen only ever answers the second.
   */
  it('leaves an unlisted country on the business’s currency', async () => {
    const user = userEvent.setup()
    // Antarctica has no currency in the table; the business's own stands.
    screenWith({ accountCountry: 'AQ', currency: 'GBP' })

    await user.click(screen.getByRole('button', { name: 'Add bank transfer' }))
    expect(screen.getByLabelText('Sort code')).toBeInTheDocument()
  })
})

/**
 * The seam between the two halves of this screen (§J).
 *
 * FOUND ON THE PHONE, and invisible to every test above it. `PaymentSettings`
 * told `PaymentLinkSection` which providers were on by filtering `methods` —
 * the curated set §J calls always available, bank transfer and cash on
 * delivery — and a link provider is never in that list. So switching Paystack
 * on wrote `paystack_page` into `enabledPaymentMethods` and the chip read
 * back "Off", because it was asking a list that could not contain the answer.
 *
 * The link tests passed `enabled` straight into the section, which is exactly
 * why they could not see it: the bug was in who computes that prop, and they
 * supplied it themselves. Asserted here, one level up, where the two halves
 * actually meet.
 */
describe('A switched-on link reads back as on (§J)', () => {
  const LINK = { provider: 'paystack_page' as const, value: 'paystack.com/pay/dynamic' }

  it('shows On for a link the company has enabled', () => {
    screenWith({
      paymentLinks: [LINK],
      enabledMethodIds: ['paystack_page'],
      onPaymentLinks: vi.fn(),
    })

    expect(
      screen.getByRole('button', { name: 'Paystack' }),
      'the chip asked a list that cannot contain a link provider',
    ).toHaveTextContent('On')
  })

  it('shows Off for one it has not', () => {
    screenWith({ paymentLinks: [LINK], enabledMethodIds: [], onPaymentLinks: vi.fn() })
    expect(screen.getByRole('button', { name: 'Paystack' })).toHaveTextContent('Off')
  })

  /** And the methods above it are unaffected by any of this. */
  it('still reads the methods’ own state', () => {
    screenWith({
      methods: methods(true),
      paymentLinks: [LINK],
      enabledMethodIds: ['bank_transfer'],
      onPaymentLinks: vi.fn(),
    })

    expect(screen.getByRole('button', { name: 'Bank transfer' })).toHaveTextContent('On')
    expect(screen.getByRole('button', { name: 'Paystack' })).toHaveTextContent('Off')
  })
})
