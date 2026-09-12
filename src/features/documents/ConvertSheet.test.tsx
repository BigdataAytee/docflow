/**
 * The convert sheet (§G).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { LocaleProfile } from '../../domain/locale/profile'
import { quantity } from '../../domain/documents/types'
import { ConvertSheet } from './ConvertSheet'
import type { ConvertibleDocument } from './convert'

const source = (
  over: Partial<ConvertibleDocument> & Pick<ConvertibleDocument, 'type' | 'status'>,
): ConvertibleDocument => ({
  id: 'doc_1',
  currency: 'NGN',
  customerId: 'cus_1',
  lineItems: [
    {
      id: 'li_1',
      description: 'Bag of cement',
      quantityMilli: quantity(20),
      unitPriceMinor: 5_000_00,
      taxable: true,
    },
  ],
  ...over,
})

function renderSheet(
  over: Partial<React.ComponentProps<typeof ConvertSheet>> = {},
  profile: LocaleProfile = { locale: 'EN-NG' },
) {
  const props: React.ComponentProps<typeof ConvertSheet> = {
    document: source({ type: 'quotation', status: 'accepted' }),
    existing: {},
    onConvert: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={profile}
      language="en"
    >
      <ConvertSheet {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('It offers only what makes sense (§G)', () => {
  it('offers both targets for an accepted quotation, under their local names', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: 'Turn into Invoice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn into Waybill' })).toBeInTheDocument()
  })

  it('follows the region for the words it offers', () => {
    renderSheet({}, { locale: 'EN-GB' })
    expect(screen.getByRole('button', { name: 'Turn into Delivery note' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn into Waybill' })).not.toBeInTheDocument()
  })

  it('offers only a delivery from an invoice', () => {
    renderSheet({ document: source({ type: 'invoice', status: 'issued' }) })
    expect(screen.getByRole('button', { name: 'Turn into Waybill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Turn into Quotation/ })).not.toBeInTheDocument()
  })

  it('says there is nothing to make, rather than showing dead rows', () => {
    renderSheet({ document: source({ type: 'receipt', status: 'issued' }) })
    expect(screen.getByText('Nothing to make from this one.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Turn into/ })).not.toBeInTheDocument()
  })

  it('says nothing to make from a draft either', () => {
    renderSheet({ document: source({ type: 'quotation', status: 'draft' }) })
    expect(screen.getByText('Nothing to make from this one.')).toBeInTheDocument()
  })
})

describe('It promises the original stays put (§G)', () => {
  it('says so before the tap, not after', () => {
    renderSheet()
    expect(screen.getByText('This document stays exactly as it is.')).toBeInTheDocument()
  })

  it('does not say it on a document with nowhere to go', () => {
    renderSheet({ document: source({ type: 'receipt', status: 'issued' }) })
    expect(screen.queryByText('This document stays exactly as it is.')).not.toBeInTheDocument()
  })
})

describe('Prices, where a delivery carried none (§G)', () => {
  it('warns before the builder does', () => {
    renderSheet({
      document: source({
        type: 'waybill',
        status: 'delivered',
        lineItems: [
          { id: 'li_1', description: 'Bag of cement', quantityMilli: quantity(20), taxable: false },
        ],
      }),
    })
    expect(screen.getByText('Prices needed — the delivery carried none.')).toBeInTheDocument()
  })

  it('says nothing about prices when the lines already have them', () => {
    renderSheet({ document: source({ type: 'invoice', status: 'issued' }) })
    expect(screen.queryByText(/needs prices/)).not.toBeInTheDocument()
  })
})

describe('One conversion, not two (§M)', () => {
  it('offers to open what already exists instead of making another', async () => {
    const user = userEvent.setup()
    const props = renderSheet({ existing: { invoice: 'doc_2' } })

    expect(screen.getByText('Already made: Invoice')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn into Invoice' })).not.toBeInTheDocument()
    // The other target is still available.
    expect(screen.getByRole('button', { name: 'Turn into Waybill' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open it' }))
    expect(props.onOpen).toHaveBeenCalledWith('doc_2')
  })
})

describe('The plumbing', () => {
  it('asks the caller to convert', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Turn into Invoice' }))
    expect(props.onConvert).toHaveBeenCalledWith('invoice')
  })

  it('closes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('shows a failure where it happened', () => {
    renderSheet({ error: 'That could not be made: nope' })
    expect(screen.getByRole('alert')).toHaveTextContent('nope')
  })
})
