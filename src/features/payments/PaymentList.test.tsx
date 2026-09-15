/**
 * The payments UI (§G, §L3).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { type Payment, reversalOf } from '../../domain/payments/ledger'
import { PaidSoFarBar } from './PaidSoFarBar'
import { PaymentList } from './PaymentList'
import { paidSoFar, recordPayment } from './record'

const NGN = (m: number) => money('NGN', m)
const TOTAL = NGN(145_000_00)
const INVOICE = 'inv-1'

const wrap = (node: React.ReactNode) => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={{ locale: 'EN-NG' }} language="en">
      {node}
    </CompanyProvider>,
  )
}

const part = recordPayment({
  id: 'p1',
  customerId: 'cus_1',
  amount: NGN(50_000_00),
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  reference: 'GTB/8842',
  invoiceId: INVOICE,
  invoiceTotal: TOTAL,
})

describe('The paid-so-far bar reads as §G writes it', () => {
  /**
   * §G writes one sentence — "₦50,000 paid of ₦145,000 · ₦95,000 left" — and
   * the accepted reference LAYS IT OUT at the two ends of the filled card,
   * where the middle dot has nothing left to separate. So this asserts the
   * sentence's content on the line that carries it, rather than the
   * punctuation a one-line rendering needed.
   */
  it('says how much is paid, of how much, and how much is left', () => {
    wrap(<PaidSoFarBar bar={paidSoFar(INVOICE, TOTAL, [part])} />)
    const line = screen.getByText(/paid of/).closest('p')
    expect(line).toHaveTextContent('₦50,000.00 paid of ₦145,000.00')
    expect(line).toHaveTextContent('₦95,000.00 left')
  })

  it('exposes the progress to assistive tech, not colour alone (§K)', () => {
    wrap(<PaidSoFarBar bar={paidSoFar(INVOICE, TOTAL, [part])} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '34')
  })

  it('says settled in full when nothing is left', () => {
    const full = recordPayment({
      id: 'p2',
      customerId: 'cus_1',
      amount: TOTAL,
      paidAt: '2026-09-11T10:00:00Z',
      method: 'cash',
      invoiceId: INVOICE,
      invoiceTotal: TOTAL,
    })
    wrap(<PaidSoFarBar bar={paidSoFar(INVOICE, TOTAL, [full])} />)
    expect(screen.getByText('Settled in full')).toBeInTheDocument()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })
})

describe('Each payment carries its own Receipt button (§G)', () => {
  it('lists date, method and reference', () => {
    wrap(
      <PaymentList payments={[part]} prefill={NGN(95_000_00)} onRecord={() => {}} onReceipt={() => {}} />,
    )
    expect(screen.getByText('₦50,000.00')).toBeInTheDocument()
    expect(screen.getByText(/2026-09-11 · Bank transfer · GTB\/8842/)).toBeInTheDocument()
  })

  it('hands the right payment to the receipt action', async () => {
    const user = userEvent.setup()
    const onReceipt = vi.fn()
    wrap(
      <PaymentList payments={[part]} prefill={NGN(95_000_00)} onRecord={() => {}} onReceipt={onReceipt} />,
    )
    await user.click(screen.getByRole('button', { name: 'Receipt' }))
    expect(onReceipt).toHaveBeenCalledWith(part)
  })

  it('names the button with the region word, not a catalogue string (Rule #4)', () => {
    // A Spanish-speaking market calls it a recibo. The word on the button has
    // to follow the terminology table, or one document has two names in one
    // app (§D).
    const repositories = createMemoryRepositories(emptyState())
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={repositories}
        profile={{ locale: 'ES' }}
        language="en"
      >
        <PaymentList
          payments={[part]}
          prefill={NGN(95_000_00)}
          onRecord={() => {}}
          onReceipt={() => {}}
        />
      </CompanyProvider>,
    )
    expect(screen.getByRole('button', { name: 'Recibo' })).toBeInTheDocument()
  })

  it('hides a reversed payment from the list (§E)', () => {
    const reversal: Payment = reversalOf(part, 'p1r', '2026-09-12T00:00:00Z')
    wrap(
      <PaymentList
        payments={[part, reversal]}
        prefill={TOTAL}
        onRecord={() => {}}
        onReceipt={() => {}}
      />,
    )
    // Both the payment and its reversal drop out — nothing to give a receipt for.
    expect(screen.queryByRole('button', { name: 'Receipt' })).not.toBeInTheDocument()
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument()
  })

  it('shows an empty state rather than a blank panel', () => {
    wrap(<PaymentList payments={[]} prefill={TOTAL} onRecord={() => {}} onReceipt={() => {}} />)
    expect(screen.getByText(/no payments yet/i)).toBeInTheDocument()
  })
})

describe('The sheet prefills to the balance (§G)', () => {
  it('opens with the outstanding amount already filled in', async () => {
    const user = userEvent.setup()
    wrap(
      <PaymentList payments={[part]} prefill={NGN(95_000_00)} onRecord={() => {}} onReceipt={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    expect(screen.getByLabelText('Amount')).toHaveValue('95000')
  })

  it('records the prefilled amount unchanged when accepted', async () => {
    const user = userEvent.setup()
    const onRecord = vi.fn()
    wrap(
      <PaymentList payments={[part]} prefill={NGN(95_000_00)} onRecord={onRecord} onReceipt={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ amount: NGN(95_000_00) }))
  })

  it('treats a reduced amount as a part payment, with no separate control', async () => {
    const user = userEvent.setup()
    const onRecord = vi.fn()
    wrap(
      <PaymentList payments={[]} prefill={TOTAL} onRecord={onRecord} onReceipt={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Record a payment' }))
    const field = screen.getByLabelText('Amount')
    await user.clear(field)
    await user.type(field, '20000')
    await user.click(screen.getByRole('button', { name: 'Record it' }))

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ amount: NGN(20_000_00) }))
    // §G says the sheet explains this rather than hiding it behind a toggle.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
