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
import { MoneyError, money } from '../../domain/money/money'
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

describe('A delivery never shows what the customer owes (§V, §G)', () => {
  /**
   * "Owes ₦95,000" beside a delivery address is a money surface on a
   * moneyless document — and one a driver hands to a recipient at a gate.
   *
   * The reference calls the balance chips in the shared picker a prototype
   * inconsistency and says production should omit financial balance
   * information while keeping the selector geometry.
   *
   * The customer here genuinely OWES: an issued invoice with nothing paid
   * against it. A fixture with no debt would pass whatever the picker did.
   */
  const owingCustomer = {
    id: 'cus_1',
    companyId: 'co_1',
    kind: 'company' as const,
    name: 'Okoro & Sons',
    labels: [] as string[],
  }

  const unpaidInvoice = [
    {
      id: 'doc_inv',
      customerId: 'cus_1',
      status: 'issued',
      total: money('NGN', 95_000_00),
      issueDate: '2026-09-01',
    },
  ]

  const withDebt = (type: DocumentType) =>
    wrap(
      <DetailsStep
        draft={draftFor(type, { customerId: 'cus_1' })}
        reference="WB-0007"
        enabledPaymentMethodCount={1}
        customers={[owingCustomer]}
        invoices={unpaidInvoice}
        payments={[]}
        onChange={() => {}}
        onAddCustomer={() => {}}
        onSetUpPayment={() => {}}
        onSign={() => {}}
      />,
    )

  /** The control: the debt is real and an invoice does show it. */
  it('shows the balance on an invoice, so the fixture is live', () => {
    withDebt('invoice')
    expect(screen.getByText(/Owes/)).toBeInTheDocument()
    expect(screen.getByText(/95,000/)).toBeInTheDocument()
  })

  it('shows no balance, no amount and no settled chip on a delivery', () => {
    withDebt('waybill')

    expect(screen.queryByText(/Owes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/95,000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
    // "Settled" is a money statement too — silence about money, not good news.
    expect(screen.queryByText(/settled/i)).not.toBeInTheDocument()
  })

  /** The selector geometry stays: it is the money that goes, not the picker. */
  it('still shows the recipient', () => {
    withDebt('waybill')
    expect(screen.getByText('Okoro & Sons')).toBeInTheDocument()
  })
})

describe('A delivery is dated by dispatch and arrival (§E, §G)', () => {
  /**
   * §E's waybill field group lists `expected_delivery_date`, and
   * `0002_customers_documents.sql` has carried the column since Phase 1. Only
   * the draft and the screen were missing it — the same gap `vehicleNumber`
   * had — so the one date a recipient actually cares about could not be set.
   *
   * The reference's own branch is explicit:
   *   cur==='way' ? dfield(0,'Dispatch') + dfield(1,'Expected')
   */
  it('asks for Dispatch first and Expected second', async () => {
    details('waybill')

    expect(await screen.findByRole('button', { name: /^Dispatch/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Expected/ })).toBeInTheDocument()
  })

  /** Neither of a money document's date words appears on a delivery. */
  it('shows no issue date and no due date on a delivery', () => {
    details('waybill')

    expect(screen.queryByRole('button', { name: /Due:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Valid until/ })).not.toBeInTheDocument()
  })

  /**
   * And the other direction, with the field SET rather than absent.
   *
   * A fixture that omits `expectedDate` would pass whatever the screen did.
   * This one carries a real value, so the assertion is about the type and not
   * about an empty draft.
   */
  it.each(['invoice', 'quotation', 'receipt'] as const)(
    'never shows an expected arrival on a %s, even when one is set',
    (type) => {
      details(type, 1, { expectedDate: '2026-09-30' })

      expect(screen.queryByRole('button', { name: /^Expected/ })).not.toBeInTheDocument()
      expect(screen.queryByText('2026-09-30')).not.toBeInTheDocument()
    },
  )
})

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

describe('Dispatch REPLACES Totals, whatever the rates say (§G, §V)', () => {
  /**
   * The existing cases below pass zeros for every rate, so they would pass
   * unchanged if a calculator appeared under another heading — nothing to
   * compute means nothing to show.
   *
   * This one hands the step a priced, taxable line and live discount, VAT and
   * withholding percentages: every input the money branch needs. §G says
   * Dispatch replaces Totals entirely, so all of it must still produce
   * nothing.
   */
  const withEveryRate = () =>
    wrap(
      <TotalsStep
        draft={draftFor('waybill', {
          lineItems: [
            {
              id: 'l1',
              description: 'Cement 50kg',
              quantityMilli: quantity(10),
              unitPriceMinor: 25_000_00,
              unit: 'cartons',
              taxable: true,
            },
          ],
        })}
        discountPercent={7.5}
        taxPercent={7.5}
        whtPercent={5}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )

  it('shows no calculator under any heading', () => {
    withEveryRate()

    for (const word of [/subtotal/i, /payable/i, /VAT/, /withholding/i, /discount/i, /total/i]) {
      expect(screen.queryByText(word)).not.toBeInTheDocument()
    }
  })

  it('shows no currency and no amount at all', () => {
    withEveryRate()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
    // The line's own price, had anything decided to print it.
    expect(screen.queryByText(/25,000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/250,000/)).not.toBeInTheDocument()
  })

  /** What it does show instead — absence of money, not of the step. */
  it('shows the dispatch card and its two fields', () => {
    withEveryRate()
    expect(screen.getByLabelText('Driver')).toBeInTheDocument()
    expect(screen.getByLabelText('Vehicle')).toBeInTheDocument()
  })
})

describe('Dispatch: a delivery gets a driver and a vehicle, and no money (§G)', () => {
  it('offers both fields', () => {
    wrap(
      <TotalsStep
        draft={draftFor('waybill')}
        discountPercent={0}
        taxPercent={0}
        whtPercent={0}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    expect(screen.getByLabelText('Driver')).toBeInTheDocument()
    expect(screen.getByLabelText('Vehicle')).toBeInTheDocument()
  })

  it('puts the vehicle on the draft, which nothing could do before', async () => {
    // The column, the row mappers and the PDF have carried `vehicleNumber`
    // since Phase 2. Only the DRAFT was missing it, so §G's "deliveries get
    // driver and vehicle" was half true and the field could never be filled.
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(
      <TotalsStep
        draft={draftFor('waybill')}
        discountPercent={0}
        taxPercent={0}
        whtPercent={0}
        taxLabel="VAT"
        onChange={onChange}
        onRates={() => {}}
      />,
    )

    await user.type(screen.getByLabelText('Vehicle'), 'LAG-441-KJA')
    expect(onChange).toHaveBeenCalled()
    const patches = onChange.mock.calls.map((call) => call[0] as { vehicleNumber?: string })
    expect(patches.some((patch) => patch.vehicleNumber !== undefined)).toBe(true)
  })

  it('shows no money anywhere on the dispatch card (§V)', () => {
    wrap(
      <TotalsStep
        draft={draftFor('waybill', {
          lineItems: [
            { id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false },
          ],
        })}
        discountPercent={10}
        taxPercent={7.5}
        whtPercent={5}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )
    // Not a zero total, not a disabled field — no totals block at all, even
    // with rates supplied and lines on the draft.
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Subtotal/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Payable/i)).not.toBeInTheDocument()
  })
})

describe('The total says what the document IS (§H)', () => {
  const render = (type: 'invoice' | 'quotation' | 'receipt') =>
    wrap(
      <TotalsStep
        draft={draftFor(type, {
          lineItems: [
            {
              id: 'l1',
              description: 'Cement',
              quantityMilli: quantity(1),
              unitPriceMinor: 100_000,
              taxable: true,
            },
          ],
        })}
        discountPercent={0}
        taxPercent={0}
        whtPercent={0}
        taxLabel="VAT"
        onChange={() => {}}
        onRates={() => {}}
      />,
    )

  it('asks an invoice to be paid', () => {
    render('invoice')
    expect(screen.getByText('Payable')).toBeInTheDocument()
  })

  it('only ESTIMATES on a quotation, because an offer is not a demand', () => {
    render('quotation')
    expect(screen.getByText('Estimated total')).toBeInTheDocument()
    expect(screen.queryByText('Payable')).not.toBeInTheDocument()
  })

  it('states what a receipt RECEIVED, because the money already arrived', () => {
    render('receipt')
    expect(screen.getByText('Received')).toBeInTheDocument()
    expect(screen.queryByText('Payable')).not.toBeInTheDocument()
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
    // The row now carries the RATE beside the word — "VAT 7.5%" — so no
    // figure on this card is unexplained. The word is still the locale's.
    expect(screen.getByText(/^VAT /)).toBeInTheDocument()
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
    expect(screen.getByText(/^TVA /)).toBeInTheDocument()
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
