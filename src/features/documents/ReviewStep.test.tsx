/**
 * Step 5 — Review (§G).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { quantity } from '../../domain/documents/types'
import { freezeLabels, type LocaleProfile } from '../../domain/locale/profile'
import type { ComposableDocument } from '../../pdf/compose'
import type { IssueProblem } from './builder'
import { ReviewStep } from './ReviewStep'
import { ReviewBand } from './ReviewBand'

const composeOptions = {
  branding: {
    name: 'Dynamic Renaissance Business Enterprises Ltd',
    nameStyle: 'classic' as const,
    logoSize: 'M' as const,
    showLogo: true,
  },
  columnLabels: { description: 'Description', quantity: 'Qty', unit: 'Unit', amount: 'Amount' },
  bankValues: { bank_name: 'GTB', account_number: '0123456789', account_name: 'Ltd' },
}

const invoice: ComposableDocument = {
  type: 'invoice',
  status: 'draft',
  currency: 'NGN',
  reference: 'INV-0042',
  issueDate: '2026-09-11',
  party: { name: 'Okoro & Sons' },
  frozenLabels: null,
  lineItems: [
    { id: 'l1', description: 'Cement', quantityMilli: quantity(3), unitPriceMinor: 500_000, taxable: true },
  ],
}

function setup(
  document: ComposableDocument,
  problems: IssueProblem[] = [],
  profile: LocaleProfile = { locale: 'EN-NG' },
) {
  const onGoToStep = vi.fn()
  const onSetUpPayment = vi.fn()
  const repositories = createMemoryRepositories(emptyState())
  render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={profile} language="en">
      <ReviewStep
        document={document}
        templateId="classic"
        problems={problems}
        onGoToStep={onGoToStep}
        onSetUpPayment={onSetUpPayment}
        composeOptions={composeOptions}
      />
    </CompanyProvider>,
  )
  return { onGoToStep, onSetUpPayment }
}

describe('The page and the band are both readable (§G step 5)', () => {
  it('shows the amber band above a still-visible document', () => {
    setup(invoice, [{ step: 0, field: 'party' }])

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Choose who this is for.')).toBeInTheDocument()
    // The document is not hidden behind the band.
    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.getByText('Cement')).toBeInTheDocument()
  })

  it('shows the page alone when nothing is missing', () => {
    setup(invoice, [])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('links each missing item back to its step', async () => {
    const user = userEvent.setup()
    const { onGoToStep } = setup(invoice, [{ step: 1, field: 'line_price' }])
    await user.click(screen.getByRole('button', { name: /fix this/i }))
    expect(onGoToStep).toHaveBeenCalledWith(1)
  })

  /**
   * §J puts payment setup in Settings, so "each item links to its step" has
   * no useful answer for these two — and the band had been sending people to
   * the Totals step, which cannot fix either of them.
   */
  it('sends a payment problem to the panel that can fix it, not to a step', async () => {
    const user = userEvent.setup()
    const { onGoToStep, onSetUpPayment } = setup(invoice, [
      { step: 2, field: 'payment_details', fixIn: 'payment_settings' },
    ])

    expect(screen.getByText(/the method is on, but the account is empty/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /set up payment/i }))
    expect(onSetUpPayment).toHaveBeenCalledOnce()
    expect(onGoToStep).not.toHaveBeenCalled()
  })

  /** Without a router to detour through, the step is still better than nothing. */
  it('falls back to the step when there is nowhere to send them', async () => {
    const user = userEvent.setup()
    const onGoToStep = vi.fn()
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <ReviewBand
          problems={[{ step: 2, field: 'payment_details', fixIn: 'payment_settings' }]}
          onGoToStep={onGoToStep}
        />
      </CompanyProvider>,
    )
    await user.click(screen.getByRole('button', { name: /fix this/i }))
    expect(onGoToStep).toHaveBeenCalledWith(2)
  })

  it('discards nothing that was typed, even while incomplete', () => {
    // §G: "nothing typed is discarded". The lines still render under the band.
    setup(invoice, [{ step: 0, field: 'party' }, { step: 2, field: 'payment_method' }])
    expect(screen.getByText('Cement')).toBeInTheDocument()
    // Once in the line row and once in the totals: a single ₦15,000 line means
    // subtotal and payable are the same figure, and both must still render.
    expect(screen.getAllByText('₦15,000.00').length).toBeGreaterThanOrEqual(2)
  })
})

describe('The preview is the real document (§H shared state)', () => {
  it('renders a delivery document with no money in the preview either', () => {
    setup({
      ...invoice,
      type: 'waybill',
      reference: 'WAY-0001',
      lineItems: [{ id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false }],
    })
    expect(screen.getByText('RECEIVED BY')).toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })

  it('previews an issued document in its frozen wording', () => {
    setup({
      ...invoice,
      type: 'waybill',
      reference: 'WAY-0001',
      frozenLabels: freezeLabels({ locale: 'EN-NG' }, 'waybill'),
      lineItems: [{ id: 'l1', description: 'Cement', quantityMilli: quantity(3), taxable: false }],
    }, [], { locale: 'EN-GB' })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('WAYBILL')
  })

  it('paginates a long document into several pages', () => {
    setup({
      ...invoice,
      lineItems: Array.from({ length: 40 }, (_, i) => ({
        id: `l${i}`,
        description: `Item ${i}`,
        quantityMilli: quantity(1),
        unitPriceMinor: 100_000,
        taxable: true,
      })),
    })
    expect(screen.getAllByRole('article').length).toBeGreaterThan(1)
  })
})
