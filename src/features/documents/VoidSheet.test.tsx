/**
 * The cancel sheet (Rule #5, §G).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import type { Payment } from '../../domain/payments/ledger'
import { VoidSheet } from './VoidSheet'
import type { VoidableDocument } from './void'

const NGN = (m: number) => money('NGN', m)

const doc = (
  over: Partial<VoidableDocument> & Pick<VoidableDocument, 'type' | 'status'>,
): VoidableDocument => ({
  id: 'doc_1',
  currency: 'NGN',
  total: NGN(145_000_00),
  ...over,
})

const allocated = (minor: number): Payment => ({
  id: 'pay_1',
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt: '2026-09-10T09:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [{ id: 'a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(minor) }],
})

function renderSheet(over: Partial<React.ComponentProps<typeof VoidSheet>> = {}) {
  const props: React.ComponentProps<typeof VoidSheet> = {
    document: doc({ type: 'invoice', status: 'issued' }),
    payments: [],
    onVoid: vi.fn(),
    onCreditInstead: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <VoidSheet {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('It says what cancelling is, before the tap', () => {
  it('promises the document stays, marked cancelled', () => {
    renderSheet()
    expect(
      screen.getByText('It stays on your records, marked cancelled. Nothing is deleted.'),
    ).toBeInTheDocument()
  })

  it('promises recorded payments are untouched', () => {
    renderSheet()
    expect(screen.getByText('Payments already recorded stay exactly as they are.')).toBeInTheDocument()
  })

  it('says it differently for a receipt, whose payment is the ledger (§V)', () => {
    renderSheet({ document: doc({ type: 'receipt', status: 'issued' }) })
    expect(
      screen.getByText('The payment stays on your records — only this receipt is cancelled.'),
    ).toBeInTheDocument()
  })

  /**
   * The warning IS the confirmation.
   *
   * This used to disable the button until a reason was typed, and the text
   * went nowhere — no column, no write, nothing on the document. A required
   * field that is discarded is Rule #1 broken for no gain, so the sheet now
   * explains and asks once.
   */
  it('cancels on one tap, with nothing to type first', async () => {
    const user = userEvent.setup()
    const props = renderSheet()

    const confirm = screen.getByRole('button', { name: 'Cancel it' })
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(props.onVoid).toHaveBeenCalledOnce()
  })

  /** And the explanation it exists to give is still given. */
  it('says what cancelling is not, before the tap', () => {
    renderSheet()
    expect(screen.getByText(/Nothing is deleted/i)).toBeInTheDocument()
  })
})

describe('When money has come in (Rule #3)', () => {
  it('refuses, and explains what would break', () => {
    renderSheet({ payments: [allocated(50_000_00)] })
    expect(screen.getByText(/Money has already come in against this/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel it' })).not.toBeInTheDocument()
  })

  it('offers to credit the balance instead', async () => {
    const user = userEvent.setup()
    const props = renderSheet({ payments: [allocated(50_000_00)] })
    await user.click(screen.getByRole('button', { name: 'Credit the balance back instead' }))
    expect(props.onCreditInstead).toHaveBeenCalledOnce()
  })

  it('mentions reversing the payment, without offering a second route into the ledger', () => {
    renderSheet({ payments: [allocated(50_000_00)] })
    expect(screen.getByText(/Reverse the payment first/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Reverse the payment/ }),
    ).not.toBeInTheDocument()
  })

  it('stops offering to credit a fully settled invoice', () => {
    renderSheet({ payments: [allocated(145_000_00)] })
    expect(
      screen.queryByRole('button', { name: 'Credit the balance back instead' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Reverse the payment first/)).toBeInTheDocument()
  })
})

describe('The other refusals', () => {
  it('says so when it is already cancelled', () => {
    renderSheet({ document: doc({ type: 'invoice', status: 'void' }) })
    expect(screen.getByText('Already cancelled.')).toBeInTheDocument()
  })

  it('says so when the lifecycle has nowhere to go — a delivered delivery', () => {
    renderSheet({ document: doc({ type: 'waybill', status: 'delivered' }) })
    expect(screen.getByText('This one cannot be cancelled from where it is.')).toBeInTheDocument()
  })

  it('shows a failure where it happened', () => {
    renderSheet({ error: 'That could not be cancelled: nope' })
    expect(screen.getByRole('alert')).toHaveTextContent('nope')
  })

  it('closes', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
