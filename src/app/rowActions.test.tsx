/**
 * The action a list row offers, and the one it must never take (§G, §V).
 *
 * §G's list page is a page of documents, and the commonest next move for an
 * unpaid invoice is not "open it and read it" — it is "the money came in".
 * Making somebody open the document to reach a button they were always going
 * to press is three taps for one decision.
 *
 * THE RULE THIS FILE EXISTS FOR: a row action NAVIGATES and never writes. A
 * list that marks an invoice paid is a status changed by a thumb brushing a
 * scroll, on the one screen where the document itself is not in front of
 * anybody — and §V's evidence rules mean a receipt records a real payment,
 * which a row cannot know about.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories } from '../data/repositories'
import type { MemoryState } from '../data/repositories'
import { money } from '../domain/money/money'
import { rowActionFor } from '../features/documents/rowAction'

const NGN = (minor: number) => money('NGN', minor)

/*
 * A FRESH INSTALL PER TEST.
 *
 * The first-run hint remembers itself in `localStorage`, which persists for
 * the whole file — so without this the hint's own test depends on which
 * tests ran before it, which is the kind of order dependency that passes
 * locally and fails in CI on a different shard.
 */
beforeEach(() => {
  try {
    globalThis.localStorage?.clear()
  } catch {
    // A runner without storage is a runner where the hint never shows.
  }
})

const seeded = (over?: (state: MemoryState) => void) => {
  const state = devState()
  const company = state.companies[0]
  if (company !== undefined) state.companies[0] = { ...company, name: 'Sola Ventures' }
  over?.(state)
  return { state, repositories: createMemoryRepositories(state) }
}

const renderAt = (path: string, over?: (state: MemoryState) => void) => {
  const { state, repositories } = seeded(over)
  render(
    <App repositories={repositories} companyId={DEV_COMPANY_ID} router="memory" initialPath={path} />,
  )
  return state
}

const customer = () => ({
  id: 'cus_1',
  companyId: DEV_COMPANY_ID,
  kind: 'company' as const,
  name: 'Ade Stores',
  labels: [],
})

const doc = (over: Record<string, unknown>) => ({
  id: 'doc_1',
  companyId: DEV_COMPANY_ID,
  customerId: 'cus_1',
  currency: 'NGN',
  lineItems: [
    {
      id: 'li_1',
      description: 'Cement',
      quantityMilli: 3_000,
      unitPriceMinor: 5_000_00,
      taxable: false,
    },
  ],
  issueDate: '2026-09-01',
  frozenLabels: null,
  totalMinor: 15_000_00,
  ...over,
})

const unpaidInvoice = (state: MemoryState) => {
  state.customers.push(customer())
  state.documents.push(
    doc({ type: 'invoice', status: 'issued', issuedReference: 'INV-0001' }) as never,
  )
}

const undeliveredWaybill = (state: MemoryState) => {
  state.customers.push(customer())
  state.documents.push(
    doc({
      id: 'doc_way',
      type: 'waybill',
      status: 'dispatched',
      issuedReference: 'WAY-0001',
      totalMinor: 0,
      lineItems: [
        { id: 'li_1', description: 'Cement', quantityMilli: 3_000, unit: 'bags', taxable: false },
      ],
    }) as never,
  )
}

describe('Which rows offer what (§G)', () => {
  /**
   * NOT "ANYTHING NOT PAID". A draft has asked for nothing, a void has been
   * withdrawn, and a balance billed elsewhere is somebody else's row now —
   * offering to record a payment against any of those invites money the
   * ledger would refuse, or worse, accept against the wrong debt.
   */
  it.each([
    ['unpaid', 'record_payment'],
    ['partially_paid', 'record_payment'],
    ['overdue', 'record_payment'],
    ['paid', null],
    ['draft', null],
    ['void', null],
    ['balance_billed', null],
  ] as const)('an invoice that is %s offers %s', (status, expected) => {
    expect(rowActionFor({ type: 'invoice', status })).toBe(expected)
  })

  /** `delivered` is terminal and carries its evidence: signing again is not on. */
  it.each([
    ['issued', 'sign'],
    ['dispatched', 'sign'],
    ['in_transit', 'sign'],
    ['delivered', null],
    ['draft', null],
    ['void', null],
  ] as const)('a delivery that is %s offers %s', (status, expected) => {
    expect(rowActionFor({ type: 'waybill', status })).toBe(expected)
  })

  /** Quotations and receipts have no next move a row can guess at. */
  it.each(['quotation', 'receipt'] as const)('a %s offers nothing', (type) => {
    expect(rowActionFor({ type, status: 'issued' })).toBeNull()
  })
})

describe('The row draws its action, and the status drives it (§G)', () => {
  it('offers Record payment on an unpaid invoice row', async () => {
    renderAt('/list/invoice', unpaidInvoice)

    const action = await screen.findByRole('button', { name: /Record a payment/i })
    expect(action.getAttribute('data-row-action')).toBe('record_payment')
  })

  it('offers Sign on an undelivered waybill row', async () => {
    renderAt('/list/waybill', undeliveredWaybill)

    const action = await screen.findByRole('button', { name: 'Sign' })
    expect(action.getAttribute('data-row-action')).toBe('sign')
  })

  /**
   * THE DERIVED STATUS, not the stored one. Both of these are stored as
   * `issued`; one has been paid in full. Reading the stored word would offer
   * "Record payment" on a settled invoice.
   */
  it('offers nothing once the invoice is settled', async () => {
    renderAt('/list/invoice', (state) => {
      unpaidInvoice(state)
      state.payments.push({
        id: 'pay_1',
        customerId: 'cus_1',
        amount: NGN(15_000_00),
        paidAt: '2026-09-05T09:00:00Z',
        method: 'bank_transfer',
        source: 'manual',
        allocations: [
          { id: 'pay_1:a', paymentId: 'pay_1', invoiceId: 'doc_1', amount: NGN(15_000_00) },
        ],
      })
    })

    await screen.findByText('INV-0001')
    expect(screen.queryByRole('button', { name: /Record a payment/i })).toBeNull()
  })

  /** And the row still opens the document, as its own target. */
  it('keeps opening the document a separate tap from the action', async () => {
    const user = userEvent.setup()
    renderAt('/list/invoice', unpaidInvoice)

    await user.click(await screen.findByText('INV-0001'))
    expect(await screen.findByText(/Share PDF/)).toBeInTheDocument()
  })
})

describe('A row action never changes a status (§G, §V)', () => {
  /**
   * THE ONE THIS FILE IS FOR.
   *
   * Pressing the row's button must leave the record exactly as it was. What
   * it does is TAKE somebody somewhere; the status moves when they finish
   * what they were taken to, with the document on screen in front of them.
   */
  it('leaves the invoice untouched when Record payment is pressed', async () => {
    const user = userEvent.setup()
    const state = renderAt('/list/invoice', unpaidInvoice)
    const before = state.documents[0]

    await user.click(await screen.findByRole('button', { name: /Record a payment/i }))

    expect(state.documents[0], 'the row wrote to the document').toBe(before)
    expect(state.payments, 'the row invented a payment').toHaveLength(0)
  })

  it('leaves the delivery untouched when Sign is pressed', async () => {
    const user = userEvent.setup()
    const state = renderAt('/list/waybill', undeliveredWaybill)
    const before = state.documents[0]

    await user.click(await screen.findByRole('button', { name: 'Sign' }))

    expect(state.documents[0], 'the row signed for the customer').toBe(before)
    expect(state.assets, 'the row invented a mark').toHaveLength(0)
  })

  /** It takes them to the document, which is where the real control is. */
  it('opens the document with the action waiting', async () => {
    const user = userEvent.setup()
    renderAt('/list/waybill', undeliveredWaybill)

    await user.click(await screen.findByRole('button', { name: 'Sign' }))

    // The document is on screen, which is where the real control lives —
    // rather than a status quietly moved on a list.
    expect((await screen.findAllByText('WAY-0001')).length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: /Record a payment/i }),
      'a delivery offered a money action',
    ).toBeNull()
  })
})

describe('The first-run hint is shown once (§G, Rule #1)', () => {
  /** A hint that comes back every week is not a hint, it is a nag. */
  it('shows it the first time and not the second', async () => {
    renderAt('/list/invoice', unpaidInvoice)
    expect(await screen.findByText(/use the button to go straight there/i)).toBeInTheDocument()

    /*
     * A SECOND VISIT, same install. Unmounted first, so the two renders
     * cannot both be in the document at once — counting across two live
     * trees would pass whether the hint returned or not.
     */
    cleanup()
    renderAt('/list/invoice', unpaidInvoice)
    await screen.findByText('INV-0001')

    expect(
      screen.queryByText(/use the button to go straight there/i),
      'the hint came back on a second visit',
    ).toBeNull()
  })
})
