/**
 * The remaining Settings essentials (§G, §J, §L2).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { type MemoryState, createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { paymentBoxRows } from '../../domain/locale/bank-fields'
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

describe('One definition drives the form and the printed box (§J)', () => {
  it('renders NGN as exactly three fields, no sort code', () => {
    wrap(
      <PaymentSettings
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
        currency="GBP"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Sort code')).toBeInTheDocument()
  })

  it('shows the same fields the PDF will print', () => {
    const values = { bank_name: 'GTB', account_number: '0123456789', account_name: 'Ltd' }
    wrap(
      <PaymentSettings
        currency="NGN"
        bankValues={values}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    // The form and paymentBoxRows read one definition, so the labels match.
    const printed = paymentBoxRows({ currency: 'NGN', values }).map((row) => row.label)
    for (const label of printed) expect(screen.getByLabelText(label)).toBeInTheDocument()
  })

  it('says so when the currency changed the fields (§J)', () => {
    wrap(
      <PaymentSettings
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

  it('keeps an account number as text so a leading zero survives (§K)', () => {
    wrap(
      <PaymentSettings
        currency="NGN"
        bankValues={{ account_number: '0001234567' }}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={vi.fn()}
      />,
    )
    const field = screen.getByLabelText('Account number')
    expect(field).toHaveAttribute('type', 'text')
    expect(field).toHaveValue('0001234567')
  })

  it('counts what is switched on, for the builder chip (§J)', () => {
    wrap(
      <PaymentSettings
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
        currency="NGN"
        bankValues={{}}
        methods={METHODS}
        onBankValue={vi.fn()}
        onToggleMethod={onToggleMethod}
      />,
    )
    expect(screen.getByRole('switch', { name: 'Paystack' })).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('switch', { name: 'Paystack' }))
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
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{}}
        onBusinessName={vi.fn()}
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
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{ waybill: 'DR' }}
        onBusinessName={vi.fn()}
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
        businessName="Dynamic Renaissance"
        nameStyle="classic"
        logoSize="M"
        prefixes={{}}
        onBusinessName={vi.fn()}
        onNameStyle={vi.fn()}
        onLogoSize={vi.fn()}
        onPrefix={vi.fn()}
      />,
    )
    expect(screen.getByTestId('name-preview')).toHaveTextContent('Dynamic Renaissance')
    unmount()

    wrap(
      <CompanySettings
        businessName="Dynamic Renaissance"
        nameStyle="monogram"
        logoSize="M"
        prefixes={{}}
        onBusinessName={vi.fn()}
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
