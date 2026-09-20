/**
 * The remaining Settings essentials (§G, §J, §L2).
 */

import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { type MemoryState, createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { fieldsFor, paymentBoxRows } from '../../domain/locale/bank-fields'
import { CompanySettings } from './CompanySettings'
import { PaymentSettings } from './PaymentSettings'
import { SavedItems } from './SavedItems'
import { TaxSettings } from './TaxSettings'

const wrap = (node: React.ReactNode, state?: MemoryState) => {
  const repositories = createMemoryRepositories(state ?? emptyState())
  return render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }} language="en">
      {node}
    </CompanyProvider>,
  )
}

const METHODS = [
  { id: 'bank_transfer', name: 'Bank transfer', enabled: true },
  { id: 'paystack', name: 'Paystack', enabled: false },
]

/**
 * The account fields live behind the method now (§J, Rule #1).
 *
 * The screen used to open with three empty bank fields above the list of
 * methods — a form nobody had asked for, above where the decision actually
 * is. They belong to bank transfer and they come out when it does, so every
 * test about the FIELDS opens the form first. The property each one asserts
 * is unchanged; only the door in front of it is new.
 *
 * Already open when bank transfer is on with nothing behind it: an enabled
 * method with no account is a promise with nothing behind it, and §J has the
 * row showing live details for the same reason.
 */
const openAccountForm = async (): Promise<void> => {
  const edit = screen.queryByRole('button', { name: /account details|Add bank transfer/i })
  if (edit !== null && edit.getAttribute('aria-expanded') === 'false') {
    await userEvent.click(edit)
  }
}

describe('One definition drives the form and the printed box (§J)', () => {
  it('renders NGN as exactly three fields, no sort code', () => {
    wrap(
      <PaymentSettings
        region="NG"
        onAccountCountry={vi.fn()}
        currency="NGN"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Bank')).toBeInTheDocument()
    expect(screen.getByLabelText('Account number')).toBeInTheDocument()
    expect(screen.getByLabelText('Account name')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sort code')).not.toBeInTheDocument()
  })

  it('renders GBP with a sort code', () => {
    wrap(
      <PaymentSettings
        region="GB"
        onAccountCountry={vi.fn()}
        currency="GBP"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Sort code')).toBeInTheDocument()
  })

  it('shows the same fields the PDF will print', async () => {
    const values = { bank_name: 'GTB', account_number: '0123456789', account_name: 'Ltd' }
    wrap(
      <PaymentSettings
        region="NG"
        onAccountCountry={vi.fn()}
        currency="NGN"
        bankValues={values}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    await openAccountForm()
    // The form and paymentBoxRows read one definition, so the labels match.
    const printed = paymentBoxRows({ currency: 'NGN', values }).map((row) => row.label)
    for (const label of printed) expect(screen.getByLabelText(label)).toBeInTheDocument()
  })

  it('says so when the currency changed the fields (§J)', () => {
    wrap(
      <PaymentSettings
        region="GB"
        onAccountCountry={vi.fn()}
        currency="GBP"
        currencyJustChanged
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/currency changed/i)
  })

  it('keeps an account number as text so a leading zero survives (§K)', async () => {
    wrap(
      <PaymentSettings
        region="NG"
        onAccountCountry={vi.fn()}
        currency="NGN"
        bankValues={{ account_number: '0001234567' }}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    await openAccountForm()
    const field = screen.getByLabelText('Account number')
    expect(field).toHaveAttribute('type', 'text')
    expect(field).toHaveValue('0001234567')
  })

  it('counts what is switched on, for the builder chip (§J)', () => {
    wrap(
      <PaymentSettings
        region="NG"
        onAccountCountry={vi.fn()}
        currency="NGN"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    expect(screen.getByText('1 switched on')).toBeInTheDocument()
  })

  it('starts every provider off until it is added (§J)', async () => {
    const user = userEvent.setup()
    const onToggleMethod = vi.fn()
    wrap(
      <PaymentSettings
        region="NG"
        onAccountCountry={vi.fn()}
        currency="NGN"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={onToggleMethod}
      />,
    )
    // The chip says what tapping it will do: Add when off, On when on (§J).
    const paystack = screen.getByRole('button', { name: 'Paystack' })
    expect(paystack).toHaveAttribute('aria-pressed', 'false')
    expect(paystack).toHaveTextContent('Add')
    expect(screen.getByRole('button', { name: 'Bank transfer' })).toHaveTextContent('On')
    await user.click(paystack)
    expect(onToggleMethod).toHaveBeenCalledWith('paystack', true)
  })
})

describe('The tax worked example is computed, never written twice (Rule #4)', () => {
  it('shows the figures computeTotals produces', () => {
    wrap(
      <TaxSettings
        taxLabel="VAT"
        currency="NGN"
        taxPercent={7.5}
        whtPercent={5}
        onTaxPercent={vi.fn()}
        onWhtPercent={vi.fn()}
      />,
    )
    // ₦10,000 · VAT 7.5% = ₦750 · WHT 5% = ₦500 · payable ₦10,250
    expect(screen.getByRole('status')).toHaveTextContent(
      'On ₦10,000.00 you would charge ₦750.00 and withhold ₦500.00, leaving ₦10,250.00.',
    )
  })

  it('uses the locale word for tax, not a fixed one (§D)', () => {
    wrap(
      <TaxSettings
        taxLabel="GST"
        currency="NGN"
        taxPercent={18}
        whtPercent={0}
        onTaxPercent={vi.fn()}
        onWhtPercent={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('GST rate')).toBeInTheDocument()
  })
})

describe('The user’s numbering prefix always wins (§D)', () => {
  it('shows the regional suggestion as a placeholder, not a value', () => {
    wrap(
      <CompanySettings
        businessPhone=""
        businessEmail=""
        businessWebsite=""
        onBusinessPhone={vi.fn()}
        onBusinessEmail={vi.fn()}
        onBusinessWebsite={vi.fn()}
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{}}
        businessAddress=""
        onBusinessName={vi.fn()}
        onBusinessAddress={vi.fn()}
        onLogo={vi.fn()}
        onNameStyle={vi.fn()}
        onLogoSize={vi.fn()}
        onPrefix={vi.fn()}
      />,
    )
    const field = screen.getByLabelText('Waybill')
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', 'WAY')
  })

  it('keeps a configured prefix over the suggestion', () => {
    wrap(
      <CompanySettings
        businessPhone=""
        businessEmail=""
        businessWebsite=""
        onBusinessPhone={vi.fn()}
        onBusinessEmail={vi.fn()}
        onBusinessWebsite={vi.fn()}
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{ waybill: 'DR' }}
        businessAddress=""
        onBusinessName={vi.fn()}
        onBusinessAddress={vi.fn()}
        onLogo={vi.fn()}
        onNameStyle={vi.fn()}
        onLogoSize={vi.fn()}
        onPrefix={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Waybill')).toHaveValue('DR')
  })

  it('previews the name style live, including the monogram', () => {
    const { unmount } = wrap(
      <CompanySettings
        businessPhone=""
        businessEmail=""
        businessWebsite=""
        onBusinessPhone={vi.fn()}
        onBusinessEmail={vi.fn()}
        onBusinessWebsite={vi.fn()}
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{}}
        businessAddress=""
        onBusinessName={vi.fn()}
        onBusinessAddress={vi.fn()}
        onLogo={vi.fn()}
        onNameStyle={vi.fn()}
        onLogoSize={vi.fn()}
        onPrefix={vi.fn()}
      />,
    )
    expect(screen.getByTestId('name-preview')).toHaveTextContent('Dynamic Renaissance')
    unmount()

    wrap(
      <CompanySettings
        businessPhone=""
        businessEmail=""
        businessWebsite=""
        onBusinessPhone={vi.fn()}
        onBusinessEmail={vi.fn()}
        onBusinessWebsite={vi.fn()}
        businessName="Dynamic Renaissance"
        nameStyle="monogram"
        logoSize="M"
        prefixes={{}}
        businessAddress=""
        onBusinessName={vi.fn()}
        onBusinessAddress={vi.fn()}
        onLogo={vi.fn()}
        onNameStyle={vi.fn()}
        onLogoSize={vi.fn()}
        onPrefix={vi.fn()}
      />,
    )
    expect(screen.getByTestId('name-preview')).toHaveTextContent('D')
  })
})

describe('Saved items are a view of what the builder remembered (§L2)', () => {
  it('offers no way to add one here — there is exactly one path in', async () => {
    wrap(<SavedItems />)
    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })

  it('lists what was typed, with its last price and use count', async () => {
    const state = emptyState()
    state.items = [
      { id: 'i1', companyId: 'co_1', name: 'Cement', lastPrice: money('NGN', 500_000), timesUsed: 4 },
    ]
    wrap(<SavedItems />, state)
    expect(await screen.findByText('Cement')).toBeInTheDocument()
    expect(screen.getByText('₦5,000.00')).toBeInTheDocument()
    expect(screen.getByText('used 4×')).toBeInTheDocument()
  })
})

/**
 * Changing the COUNTRY changes the fields (§J).
 *
 * §J keys its table to the currency, which is the right key for a lookup and
 * the wrong question for a person: nobody knows their account as "an NGN
 * account", they know it is a Nigerian one. So the screen asks where the bank
 * is and resolves the currency from it — §J's definition unchanged, still the
 * only source of field sets.
 *
 * The property being proved is the same one as before the question changed: a
 * single NGN case could not catch a screen that renders a fixed set and never
 * looks again, and §J's "one definition feeds the form and the printed box"
 * only means anything if changing the answer actually re-reads it.
 */
describe('Selecting a country re-renders the bank fields (§J)', () => {
  const renderAt = (country: string) => {
    const repositories = createMemoryRepositories(emptyState())
    return render(
      <CompanyProvider
        companyId="co_1"
        repositories={repositories}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <PaymentSettings
          region={country}
          onAccountCountry={vi.fn()}
          currency="NGN"
          bankValues={{}}
          methods={METHODS}
          onBankValue={vi.fn()}
          onToggleMethod={vi.fn()}
        />
      </CompanyProvider>,
    )
  }

  const labels = (): string[] =>
    screen.getAllByRole('textbox').map((input) => input.getAttribute('aria-label') ?? '')

  it.each([
    ['NG', ['Bank', 'Account number', 'Account name'], ['Sort code', 'Routing number', 'IBAN']],
    ['GB', ['Bank', 'Sort code', 'Account number'], ['Routing number', 'IBAN']],
    ['US', ['Bank', 'Routing number', 'Account number'], ['Sort code', 'IBAN']],
    ['FR', ['Bank', 'IBAN', 'BIC/SWIFT'], ['Sort code', 'Routing number']],
  ])('%s shows its own fields and none of the others', async (country, present, absent) => {
    cleanup()
    renderAt(country as string)
    await openAccountForm()
    for (const label of present as string[]) {
      expect(screen.getByLabelText(label), `${country} is missing ${label}`).toBeInTheDocument()
    }
    for (const label of absent as string[]) {
      expect(
        screen.queryByLabelText(label),
        `${country} shows ${label}, which belongs to another market`,
      ).toBeNull()
    }
  })

  /**
   * THE RE-RENDER. Same mounted component, new currency prop — this is what a
   * device does when the country picker writes a new currency onto the
   * company. A screen holding a fixed set built at mount passes every test
   * above and fails this one.
   */
  it('swaps the fields on a live component, not only on a fresh mount', async () => {
    cleanup()
    const repositories = createMemoryRepositories(emptyState())
    const view = (country: string) => (
      <CompanyProvider
        companyId="co_1"
        repositories={repositories}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <PaymentSettings
          region={country}
          onAccountCountry={vi.fn()}
          currency="NGN"
          bankValues={{}}
          methods={METHODS}
          onBankValue={vi.fn()}
          onToggleMethod={vi.fn()}
        />
      </CompanyProvider>
    )

    const { rerender } = render(view('NG'))
    await openAccountForm()
    expect(screen.queryByLabelText('Sort code')).toBeNull()

    rerender(view('GB'))
    expect(screen.getByLabelText('Sort code')).toBeInTheDocument()

    rerender(view('US'))
    expect(screen.getByLabelText('Routing number')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sort code')).toBeNull()

    rerender(view('NG'))
    // Back to the home market's three, with nothing left over from the others.
    expect(labels()).toEqual(['Bank', 'Account number', 'Account name'])
  })

  /**
   * The form and the printed box read the SAME definition. If they ever
   * diverge, an owner fills in fields the invoice does not print, or the
   * invoice prints a row nobody was asked for.
   */
  it.each([
    ['NG', 'NGN'],
    ['GB', 'GBP'],
    ['US', 'USD'],
    ['FR', 'EUR'],
    ['KE', 'KES'],
  ])('prints exactly the fields it asked for, in %s', async (country, currency) => {
    cleanup()
    const values = Object.fromEntries(
      fieldsFor(currency).map((field) => [field.kind, 'x'] as const),
    )
    const printed = paymentBoxRows({ currency, values }).map((row) => row.label)
    renderAt(country)
    await openAccountForm()
    expect(labels()).toEqual(printed)
  })
})
