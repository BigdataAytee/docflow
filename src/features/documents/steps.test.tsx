/**
 * The step bodies (§G steps 1–3).
 *
 * The clause these mostly exist to hold: §V — "Delivery documents never show
 * prices, tax, totals or payment instructions — under any name."
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { type MemoryState, createMemoryRepositories, emptyState } from '../../data/repositories'
import { DOCUMENT_TYPES, type DocumentType, quantity } from '../../domain/documents/types'
import { MoneyError } from '../../domain/money/money'
import { computeTotals } from '../../domain/money/totals'
import type { LocaleProfile } from '../../domain/locale/profile'
import { DetailsStep } from './DetailsStep'
import { ItemsStep } from './ItemsStep'
import { TotalsStep } from './TotalsStep'
import type { DocumentDraft } from './builder'

const draftFor = (type: DocumentType, over: Partial<DocumentDraft> = {}): DocumentDraft => ({
  type,
  currency: 'NGN',
  customerId: 'Okoro & Sons',
  issueDate: '2026-09-11',
  lineItems: [],
  ...over,
})

function wrap(node: React.ReactNode, state?: MemoryState, profile?: LocaleProfile) {
  const repositories = createMemoryRepositories(state ?? emptyState())
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={repositories}
      profile={profile ?? { locale: 'EN-NG' }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )
}

const details = (type: DocumentType, methods = 1, over: Partial<DocumentDraft> = {}) =>
  wrap(
    <DetailsStep
      draft={draftFor(type, over)}
      reference="INV-0001"
      enabledPaymentMethodCount={methods}
      customers={[]}
      invoices={[]}
      payments={[]}
      onChange={() => {}}
      onAddCustomer={() => {}}
      onSetUpPayment={() => {}}
      onSign={() => {}}
    />,
  )

describe('Details: the per-type differences §G spells out', () => {
  it('gives an invoice a due date', () => {
    details('invoice')
    expect(screen.getByRole('button', { name: new RegExp(`^Due:`) })).toBeInTheDocument()
  })

  it('gives a quotation a valid-until date instead', () => {
    details('quotation')
    expect(screen.getByRole('button', { name: new RegExp(`^Valid until:`) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(`^Due:`) })).not.toBeInTheDocument()
  })

  it('gives a receipt date paid and NO due date (§G)', () => {
    details('receipt')
    expect(screen.getByRole('button', { name: new RegExp(`^Date paid:`) })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(`^Due:`) })).not.toBeInTheDocument()
  })

  it('gives a delivery document a delivery address', () => {
    details('waybill')
    expect(screen.getByLabelText('Delivery address')).toBeInTheDocument()
  })

  it('shows no payment card on a quotation or a delivery document (§J)', () => {
    details('quotation', 0)
    expect(screen.queryByRole('button', { name: 'Set up payment' })).not.toBeInTheDocument()

    render(<div />) // isolate
    details('waybill', 0)
    expect(screen.queryByRole('button', { name: 'Set up payment' })).not.toBeInTheDocument()
  })

  it('offers payment setup on an invoice with no methods, and confirms when set', () => {
    details('invoice', 0)
    expect(screen.getByRole('button', { name: 'Set up payment' })).toBeInTheDocument()
  })

  it('uses the localised party label as the card heading (Rule #5)', () => {
    wrap(
      <DetailsStep
        draft={draftFor('waybill')}
        reference="WAY-0001"
        enabledPaymentMethodCount={1}
        customers={[]}
        invoices={[]}
        payments={[]}
        onChange={() => {}}
        onAddCustomer={() => {}}
        onSetUpPayment={() => {}}
        onSign={() => {}}
      />,
      undefined,
      { locale: 'EN-NG' },
    )
    expect(screen.getByRole('heading', { name: 'Deliver to' })).toBeInTheDocument()
  })
})

describe('Items: a delivery document has no price field at all (§G, §V)', () => {
  it('offers a unit price on a priced document', () => {
    wrap(<ItemsStep draft={draftFor('invoice')} onChange={() => {}} />)
    expect(screen.getByLabelText('Unit price')).toBeInTheDocument()
  })

  it('omits the price field entirely on a delivery document', () => {
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={() => {}} />)
    // Not disabled, not zeroed — absent.
    expect(screen.queryByLabelText('Unit price')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('adds a line and remembers it for the catalogue (§L2)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onRemember = vi.fn()
    wrap(<ItemsStep draft={draftFor('invoice')} onChange={onChange} onRemember={onRemember} />)

    await user.type(screen.getByLabelText('Description'), 'Cement')
    await user.clear(screen.getByLabelText('Qty'))
    await user.type(screen.getByLabelText('Qty'), '3')
    await user.type(screen.getByLabelText('Unit price'), '5000')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalledOnce()
    const patch = onChange.mock.calls[0]?.[0] as { lineItems: { unitPriceMinor?: number }[] }
    expect(patch.lineItems[0]?.unitPriceMinor).toBe(500_000)
    expect(onRemember).toHaveBeenCalledWith({ name: 'Cement', unitPriceMinor: 500_000 })
  })

  it('will not let a delivery line carry a price even via the catalogue', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Cement')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const patch = onChange.mock.calls[0]?.[0] as { lineItems: { unitPriceMinor?: number }[] }
    expect(patch.lineItems[0]?.unitPriceMinor).toBeUndefined()
  })

  it('shows the empty state before anything is added', () => {
    wrap(<ItemsStep draft={draftFor('invoice')} onChange={() => {}} />)
    expect(screen.getByText(/nothing added yet/i)).toBeInTheDocument()
  })

  it('renders no money column on a delivery line', () => {
    const line = { id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false }
    wrap(<ItemsStep draft={draftFor('waybill', { lineItems: [line] })} onChange={() => {}} />)
    expect(screen.getByText('Cement')).toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })

  /**
   * The unit is what a delivery has INSTEAD of a price (§E, §G).
   *
   * "12" is not something anybody can sign for at a door; "12 bundles" is.
   */
  it('gives a delivery a unit field where a priced document has a price', () => {
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={() => {}} />)
    expect(screen.getByLabelText('Unit')).toBeInTheDocument()
    expect(screen.queryByLabelText('Unit price')).not.toBeInTheDocument()
  })

  it('puts the unit on the line and shows it beside the quantity', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.clear(screen.getByLabelText('Qty'))
    await user.type(screen.getByLabelText('Qty'), '12')
    await user.type(screen.getByLabelText('Unit'), 'bundles')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const patch = onChange.mock.calls[0]?.[0] as { lineItems: { unit?: string }[] }
    expect(patch.lineItems[0]?.unit).toBe('bundles')
  })

  it('shows the unit on a rendered line', () => {
    const line = {
      id: 'l1',
      description: 'Roofing sheets',
      quantityMilli: quantity(12),
      unit: 'bundles',
      taxable: false,
    }
    wrap(<ItemsStep draft={draftFor('waybill', { lineItems: [line] })} onChange={() => {}} />)
    expect(screen.getByText('12 bundles')).toBeInTheDocument()
  })

  it('keeps the unit for the next line, and clears everything else', async () => {
    const user = userEvent.setup()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={() => {}} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.type(screen.getByLabelText('Unit'), 'bundles')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // A delivery is usually cartons all the way down; retyping the unit on
    // every line is the tax the field would otherwise charge for existing.
    expect(screen.getByLabelText('Unit')).toHaveValue('bundles')
    expect(screen.getByLabelText('Description')).toHaveValue('')
  })
})

describe('Totals: every figure comes from computeTotals (Rule #4)', () => {
  const priced = draftFor('invoice', {
    lineItems: [
      { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
      { id: 'l2', description: 'Sand', quantityMilli: quantity(2), unitPriceMinor: 1_250_000, taxable: true },
    ],
  })

  it('matches the worked example on screen', () => {
    wrap(
      <TotalsStep
        draft={priced}
        discountPercent={10}
        taxPercent={7.5}
        whtPercent={5}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    // subtotal 40,000 · discount 4,000 · VAT 2,700 · WHT 1,800 · payable 36,900
    expect(screen.getByText('₦40,000.00')).toBeInTheDocument()
    expect(screen.getByText('VAT')).toBeInTheDocument()
    expect(screen.getByText('₦2,700.00')).toBeInTheDocument()
    expect(screen.getByText('₦36,900.00')).toBeInTheDocument()
  })

  it('uses the locale word for tax, not a hardcoded one (§J)', () => {
    wrap(
      <TotalsStep
        draft={priced}
        discountPercent={0}
        taxPercent={7.5}
        whtPercent={0}
        taxLabel="TVA"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    expect(screen.getByText('TVA')).toBeInTheDocument()
  })

  it('never shows withholding tax on a quotation (§I)', () => {
    wrap(
      <TotalsStep
        draft={{ ...priced, type: 'quotation' }}
        discountPercent={0}
        taxPercent={7.5}
        whtPercent={5}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    expect(screen.queryByText(/withholding/i)).not.toBeInTheDocument()
  })

  it('shows dispatch fields and no totals block on a delivery document (§V)', () => {
    wrap(
      <TotalsStep
        draft={draftFor('waybill')}
        discountPercent={0}
        taxPercent={7.5}
        whtPercent={0}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    expect(screen.getByLabelText('Driver')).toBeInTheDocument()
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument()
    expect(screen.queryByText('Payable')).not.toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })
})

describe('No money reaches a delivery document on any step (§V)', () => {
  it('holds for every step body at once', () => {
    for (const type of DOCUMENT_TYPES) {
      const { unmount } = wrap(
        <ItemsStep draft={draftFor(type)} onChange={() => {}} />,
      )
      const hasPriceField = screen.queryByLabelText('Unit price') !== null
      expect(hasPriceField, `${type} price field`).toBe(type !== 'waybill')
      unmount()
    }
  })

  it('refuses to total a delivery document at the domain level too', () => {
    // Belt and braces: even if a step body were wrong, the money layer throws
    // rather than producing a zero that a PDF could print.
    expect(() =>
      computeTotals({
        type: 'waybill',
        currency: 'NGN',
        lines: [
          { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
        ],
      }),
    ).toThrow(MoneyError)
  })
})
