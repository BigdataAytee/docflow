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
import { type DocumentDraft, primaryAction, stepKeysFor, stepNames } from './builder'

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
      currencies={['NGN', 'GBP']}
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
        currencies={['NGN', 'GBP']}
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
        currencies={['NGN', 'GBP']}
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

/**
 * §G's pencil, and the half of it that was still inert (§G, §K, §M).
 *
 * The control existed and did nothing for as long as it had existed. The
 * WRITE was fixed — `referenceOverride` lands on the draft and `issueDocument`
 * uses it verbatim, which `reference-override.test.ts` covers thoroughly.
 *
 * None of that is visible. The field printed the PROVISIONAL reference
 * unconditionally, so somebody typed DR-INV-0413, pressed Enter, and watched
 * it turn back into "INV-…". From the owner's side the pencil was exactly as
 * inert as before, and no test here could tell — because there were no tests
 * here at all. The unit tests proved the rule; nothing proved the screen.
 */
describe('The pencil on the document number (§G)', () => {
  const detailsWith = (over: Partial<DocumentDraft>, onChange = vi.fn()) => {
    wrap(
      <DetailsStep
        currencies={['NGN', 'GBP']}
        draft={draftFor('invoice', over)}
        reference="INV-…"
        enabledPaymentMethodCount={1}
        customers={[]}
        invoices={[]}
        payments={[]}
        onChange={onChange}
        onAddCustomer={() => {}}
        onSetUpPayment={() => {}}
        onSign={() => {}}
      />,
    )
    return onChange
  }

  it('stores what was typed, exactly as typed', async () => {
    const user = userEvent.setup()
    const onChange = detailsWith({})

    await user.click(screen.getByRole('button', { name: 'Edit reference' }))
    // By ROLE: the pencil and the field it opens share an accessible name, so
    // `getByLabelText` matches both and the query is ambiguous.
    await user.type(screen.getByRole('textbox', { name: 'Edit reference' }), 'DR-INV-0413{Enter}')

    expect(onChange).toHaveBeenCalledWith({ referenceOverride: 'DR-INV-0413' })
  })

  /**
   * UPPERCASE AS IT IS TYPED (§M).
   *
   * A reference is an identifier a customer reads back over the phone and a
   * colleague searches for, and `dr-inv-0413` and `DR-INV-0413` are the same
   * number written two ways — which is how one document comes to look like
   * two. Phone keyboards start lower case, so left alone this is what
   * everybody would get.
   */
  it('puts the number in capitals as it is typed', async () => {
    const user = userEvent.setup()
    const onChange = detailsWith({})

    await user.click(screen.getByRole('button', { name: 'Edit reference' }))
    const box = screen.getByRole('textbox', { name: 'Edit reference' })
    await user.type(box, 'dr-inv-0413')

    expect(box, 'the owner cannot see it being capitalised').toHaveValue('DR-INV-0413')
    await user.type(box, '{Enter}')
    expect(onChange).toHaveBeenCalledWith({ referenceOverride: 'DR-INV-0413' })
  })

  /** THE ONE THIS IS FOR. */
  it('shows the owner their own number back, not the provisional one', () => {
    detailsWith({ referenceOverride: 'DR-INV-0413' })
    expect(
      screen.getByText('DR-INV-0413'),
      'the field went back to the generated reference',
    ).toBeInTheDocument()
    expect(screen.queryByText('INV-…'), 'the provisional number is still shown').toBeNull()
  })

  it('shows the provisional number when no override is set', () => {
    detailsWith({})
    expect(screen.getByText('INV-…')).toBeInTheDocument()
  })

  /** A refused value stays in the box so it can be fixed, and is not stored. */
  it('keeps a bad reference in the field rather than writing it', async () => {
    const user = userEvent.setup()
    const onChange = detailsWith({})

    await user.click(screen.getByRole('button', { name: 'Edit reference' }))
    await user.type(screen.getByRole('textbox', { name: 'Edit reference' }), 'INV/2026/1{Enter}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Edit reference' })).toHaveValue('INV/2026/1')
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  /** Clearing it asks for the app's numbering back — a choice, not an error. */
  it('clears back to the generated sequence', async () => {
    const user = userEvent.setup()
    const onChange = detailsWith({ referenceOverride: 'DR-INV-0413' })

    await user.click(screen.getByRole('button', { name: 'Edit reference' }))
    await user.clear(screen.getByRole('textbox', { name: 'Edit reference' }))
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith({ referenceOverride: undefined })
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
  /*
   * CHANGED DELIBERATELY. These asserted that a delivery got a UNIT field
   * where a priced document gets a price — §I's "deliveries swap amount for
   * unit". The owner decided against the unit on waybills having used it, so
   * a delivery row is description and quantity, and the column is simply not
   * drawn rather than drawn empty.
   *
   * The half of §V that matters is unchanged and still asserted: a delivery
   * never shows a price field.
   */
  it('gives a delivery neither a price field nor a unit field', () => {
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={() => {}} />)
    expect(screen.queryByLabelText('Unit price')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Unit')).not.toBeInTheDocument()
  })

  it('still records description and quantity on the line', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.clear(screen.getByLabelText('Qty'))
    await user.type(screen.getByLabelText('Qty'), '12')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const patch = onChange.mock.calls[0]?.[0] as {
      lineItems: { description: string; quantityMilli: number }[]
    }
    expect(patch.lineItems[0]?.description).toBe('Roofing sheets')
    expect(patch.lineItems[0]?.quantityMilli).toBe(quantity(12))
  })

  it('clears the row after adding, ready for the next line', async () => {
    const user = userEvent.setup()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={() => {}} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByLabelText('Description')).toHaveValue('')
  })

  /**
   * THE UNIT MUST NOT ARRIVE BY THE BACK DOOR EITHER.
   *
   * The field is not drawn for a delivery, which is what "dropped from the
   * Goods step" meant — but the component still held a `unit` state, and
   * taking a suggestion from the saved-item catalogue still filled it on
   * exactly that branch, left over from when a waybill did have the field.
   *
   * So picking a catalogue item put a unit on a delivery line the owner
   * could not see, could not clear and would never have typed. Invisible on
   * the PDF, which drops the column — and VISIBLE in the row summary right
   * beside it, which read "3 cartons" under a document that prints "3".
   */
  it('puts no unit on a delivery line taken from the catalogue', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onRemember = vi.fn()
    /*
     * A REAL catalogue behind a REAL suggestion. The first version of this
     * passed a `savedItems` prop that does not exist — suggestions come from
     * `repositories.items.suggest` through the context — so the click path
     * was never exercised and `unit` was undefined for the dullest possible
     * reason. A fixture that cannot reach the code proves nothing.
     */
    const state = emptyState()
    state.items.push({
      id: 'si1',
      companyId: 'co_1',
      name: 'Cement 50kg',
      unit: 'cartons',
      timesUsed: 4,
    })
    wrap(
      <ItemsStep draft={draftFor('waybill')} onChange={onChange} onRemember={onRemember} />,
      state,
    )

    await user.type(screen.getByLabelText('Description'), 'Cement')
    // The suggestion has to actually be there, or this is the vacuous version.
    const suggestion = await screen.findByRole('button', { name: /Cement 50kg/ })
    await user.click(suggestion)
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const patch = onChange.mock.calls[0]?.[0] as { lineItems: { unit?: string }[] }
    expect(patch.lineItems[0]?.unit, 'a delivery line carried a unit').toBeUndefined()
    // And the catalogue is not taught one out of a field this screen never drew.
    expect(onRemember.mock.calls[0]?.[0]).not.toHaveProperty('unit')
  })

  /** The same path on an invoice DOES carry it — proof the click works. */
  it('takes the unit from the catalogue on a priced document', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const state = emptyState()
    state.items.push({
      id: 'si1',
      companyId: 'co_1',
      name: 'Cement 50kg',
      unit: 'bags',
      lastPrice: money('NGN', 500_000),
      timesUsed: 4,
    })
    wrap(<ItemsStep draft={draftFor('invoice')} onChange={onChange} />, state)

    await user.type(screen.getByLabelText('Description'), 'Cement')
    await user.click(await screen.findByRole('button', { name: /Cement 50kg/ }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const patch = onChange.mock.calls[0]?.[0] as { lineItems: { unit?: string }[] }
    expect(patch.lineItems[0]?.unit, 'the suggestion click never filled anything').toBe('bags')
  })

  /**
   * The summary has to match the paper. It printed the unit on every type, so
   * a delivery row read "3 cartons" in the builder while the page it composes
   * prints "3" — the builder promising a column the document does not have.
   */
  it('summarises a delivery line without a unit, even if the line has one', () => {
    const line = {
      id: 'l1',
      description: 'Cement',
      quantityMilli: quantity(3),
      unit: 'cartons',
      taxable: false,
    }
    wrap(<ItemsStep draft={draftFor('waybill', { lineItems: [line] })} onChange={() => {}} />)
    expect(screen.getByText('Cement')).toBeInTheDocument()
    expect(screen.queryByText(/cartons/), 'the builder shows a unit the page will not').toBeNull()
  })

  /** And a priced document keeps it, because that half never changed. */
  it('still summarises an invoice line with its unit', () => {
    const line = {
      id: 'l1',
      description: 'Cement',
      quantityMilli: quantity(3),
      unit: 'bags',
      unitPriceMinor: 500_000,
      taxable: true,
    }
    wrap(<ItemsStep draft={draftFor('invoice', { lineItems: [line] })} onChange={() => {}} />)
    expect(screen.getByText(/bags/)).toBeInTheDocument()
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

/**
 * A LINE THAT WAS TYPED IS A LINE THE OWNER MEANT (§G, Rule #1).
 *
 * `+` was the only way a line became real, so somebody who filled the goods
 * in and went straight to Next lost them — the commonest way to lose work in
 * the builder, and the kind of loss Rule #1 is about: the app asking for a
 * gesture that carries no information.
 */
describe('Goods register without pressing Add', () => {
  it('commits the typed line when focus leaves the row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.clear(screen.getByLabelText('Qty'))
    await user.type(screen.getByLabelText('Qty'), '12')

    // Away, without ever touching `+`.
    await user.tab()
    await user.tab()
    await user.tab()

    const patch = onChange.mock.calls.at(-1)?.[0] as
      | { lineItems: { description: string; quantityMilli: number }[] }
      | undefined
    expect(patch?.lineItems.at(-1)?.description).toBe('Roofing sheets')
    expect(patch?.lineItems.at(-1)?.quantityMilli).toBe(quantity(12))
  })

  /**
   * MOVING BETWEEN THE BOXES IS STILL BEING IN THE ROW. Committing on the way
   * from Description to Qty would file half a line and clear the boxes under
   * the owner's hands — which is worse than the bug it fixes.
   */
  it('does not commit while moving between the fields', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Roofing sheets')
    await user.click(screen.getByLabelText('Qty'))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Description')).toHaveValue('Roofing sheets')
  })

  /** Nothing typed, nothing filed — an empty row leaving focus is not a line. */
  it('files nothing when the row is empty', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.click(screen.getByLabelText('Description'))
    await user.tab()
    await user.tab()
    await user.tab()

    expect(onChange).not.toHaveBeenCalled()
  })

  /** `+` still works, and still returns the cursor for the next line. */
  it('keeps Add as the shortcut for the next line', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    wrap(<ItemsStep draft={draftFor('waybill')} onChange={onChange} />)

    await user.type(screen.getByLabelText('Description'), 'Cement')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('Description')).toHaveValue('')
  })
})

/**
 * A receipt that settles an invoice asks for no items (§G, Rule #1).
 *
 * The owner's instruction: "the items were already described on the invoice
 * the customer holds; re-entering them is work the invoice already did, and
 * risks contradicting it." Two lists of the same goods can disagree, and then
 * the receipt contradicts the thing it is evidence for.
 *
 * A CASH receipt is the opposite case and keeps the step: there is no prior
 * document, so the receipt is the only record of what was bought.
 */
describe('Which steps a receipt actually runs (§G)', () => {
  const profile = { locale: 'EN-NG' } as const

  it('drops the items step when it settles an invoice', () => {
    const keys = stepKeysFor({ type: 'receipt', linkedInvoiceId: 'doc_inv' })
    expect(keys).not.toContain('items')
    expect(keys).toEqual(['details', 'design', 'review'])
  })

  it('keeps it on a cash receipt, which is the only record of the sale', () => {
    expect(stepKeysFor({ type: 'receipt' })).toContain('items')
  })

  /**
   * A RECEIPT SETTLING AN INVOICE COMPUTES NOTHING. The price was set on the
   * document the customer is holding, and a step offering to adjust it here
   * would be offering to disagree with the bill it is evidence against. That
   * is Path A, and it is why signing sits immediately before Save there.
   */
  it('gives a receipt settling an invoice no totals step', () => {
    expect(stepKeysFor({ type: 'receipt', linkedInvoiceId: 'doc_inv' })).not.toContain('totals')
  })

  /**
   * A CASH SALE DOES. Its goods were typed on that screen and nowhere else,
   * so the subtotal, anything knocked off at the counter and the tax are all
   * decisions being made right now — and all three have to print. It is also
   * the only screen where "what the goods cost" and "what they handed over"
   * are different numbers.
   */
  it('gives a cash receipt a totals step', () => {
    const keys = stepKeysFor({ type: 'receipt' })
    expect(keys).toContain('totals')
    expect(keys).toEqual(['details', 'items', 'totals', 'design', 'review'])
  })

  it('leaves the totals step on everything that computes one', () => {
    for (const type of ['invoice', 'quotation'] as const) {
      expect(stepKeysFor({ type })).toContain('totals')
    }
  })

  it.each(['invoice', 'quotation', 'waybill'] as const)('leaves a %s alone', (type) => {
    expect(stepKeysFor({ type })).toHaveLength(5)
  })

  /** The NAMES drop with the key, or the bar would label four steps with five. */
  it('drops the name too, not just the body', () => {
    const named = stepNames(profile, 'receipt', { type: 'receipt', linkedInvoiceId: 'doc_inv' })
    expect(named).toHaveLength(3)
    expect(named).not.toContain('Items')
    expect(named).not.toContain('Totals')
  })

  /**
   * AND THE LAST STEP IS STILL THE LAST ONE. `primaryAction` did not take the
   * count, so on a four-step flow the button saved while still reading
   * "Next" — doing one thing and announcing another.
   */
  it('says Save on the last step of a shortened flow', () => {
    expect(primaryAction(3, 4)).toBe('save')
    expect(primaryAction(2, 4)).toBe('next')
  })
})
