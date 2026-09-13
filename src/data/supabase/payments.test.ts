/**
 * The payments repository, asserted on the requests it builds.
 *
 * `record_payment` itself is tested against real Postgres in
 * `supabase/tests/payments.test.ts` — atomicity and RLS are SQL facts and are
 * not visible from here. What IS only visible from here is the call: whether
 * the allocations reach the function at all, whether the embed that carries
 * them back is actually requested, and whether the invoice filter is an inner
 * join rather than a nullable one.
 */

import { describe, expect, it } from 'vitest'

import { harness } from './harness'
import { createPaymentRepository } from './payments'
import { RepositoryError } from '../repositories'
import { money } from '../../domain/money/money'

const ACME = '11111111-1111-1111-1111-111111111111'
const ctx = (idempotencyKey: string) => ({ idempotencyKey })

const paymentRow = {
  id: 'pay_1',
  company_id: ACME,
  customer_id: 'cus_1',
  currency: 'NGN',
  amount_minor: 50_000_00,
  paid_at: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
}

const allocationRow = {
  id: 'alloc_1',
  payment_id: 'pay_1',
  invoice_id: 'doc_inv',
  amount_minor: 30_000_00,
}

const newPayment = {
  customerId: 'cus_1',
  amount: money('NGN', 50_000_00),
  paidAt: '2026-09-11T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual' as const,
  allocations: [
    {
      id: 'local:doc_inv',
      paymentId: 'local',
      invoiceId: 'doc_inv',
      amount: money('NGN', 30_000_00),
    },
  ],
}

describe('A payment is never read without what it settled (§K)', () => {
  it('asks for the allocations in the same request', async () => {
    const h = harness([[{ ...paymentRow, payment_allocations: [allocationRow] }]])
    const [payment] = await createPaymentRepository(h.db).listForCompany(ACME)

    // Fetched separately, there would be a window where a payment has been
    // read and its allocations have not — and a payment rendered without them
    // reads as unallocated money, a different fact about a balance.
    expect(h.calls).toHaveLength(1)
    expect(h.call(0).params.get('select')).toContain('payment_allocations(*)')
    expect(payment?.allocations).toHaveLength(1)
    expect(payment?.allocations[0]?.amount).toEqual(money('NGN', 30_000_00))
  })

  it('gives an allocation the payment currency, which its own row does not carry', async () => {
    const h = harness([[{ ...paymentRow, currency: 'GHS', payment_allocations: [allocationRow] }]])
    const [payment] = await createPaymentRepository(h.db).listForCompany(ACME)
    expect(payment?.allocations[0]?.amount.currency).toBe('GHS')
  })

  it('scopes the list to the company and orders it totally', async () => {
    const h = harness([[paymentRow]])
    await createPaymentRepository(h.db).listForCompany(ACME)

    expect(h.call(0).params.get('company_id')).toBe(`eq.${ACME}`)
    // Two payments recorded in the same second must not swap places between
    // reads, so the order does not stop at the timestamp.
    expect(h.call(0).params.get('order')).toBe('paid_at.desc,id.desc')
  })

  it('filters an invoice list with an INNER join, not a nullable embed', async () => {
    const h = harness([[{ ...paymentRow, payment_allocations: [allocationRow] }]])
    await createPaymentRepository(h.db).listForInvoice(ACME, 'doc_inv')

    // Without `!inner` every payment comes back, each carrying an empty
    // allocation list, and the invoice looks settled by money that never
    // touched it.
    expect(h.call(0).params.get('select')).toContain('payment_allocations!inner(*)')
    expect(h.call(0).params.get('payment_allocations.invoice_id')).toBe('eq.doc_inv')
  })
})

describe('Recording goes through the one statement that cannot half-succeed (§E)', () => {
  it('calls the function rather than the table, and sends the allocations with it', async () => {
    const h = harness([{ json: { payment: paymentRow, allocations: [allocationRow] } }])
    const recorded = await createPaymentRepository(h.db).record(newPayment, ctx('pay:1'))

    expect(h.call(0).method).toBe('POST')
    expect(h.call(0).table).toBe('rpc/record_payment')
    expect(h.call(0).body).toMatchObject({
      p_idempotency_key: 'pay:1',
      p_payment: { currency: 'NGN', amount_minor: 50_000_00, method: 'bank_transfer' },
      p_allocations: [{ invoice_id: 'doc_inv', amount_minor: 30_000_00 }],
    })
    expect(recorded.allocations[0]?.paymentId).toBe('pay_1')
  })

  it('sends no company, because the function reads it from the caller', async () => {
    const h = harness([{ json: { payment: paymentRow, allocations: [] } }])
    await createPaymentRepository(h.db).record({ ...newPayment, allocations: [] }, ctx('pay:2'))

    // A company argument would be a company the client chooses. There must be
    // nothing here for an attack to land on.
    expect(h.call(0).body).not.toHaveProperty('p_company_id')
  })

  it('re-stamps the allocations with the id the database minted', async () => {
    // The caller builds allocations against a local handle, because the real
    // id does not exist until the write. Left alone, every allocation names a
    // payment that is not there.
    const h = harness([{ json: { payment: paymentRow, allocations: [allocationRow] } }])
    const recorded = await createPaymentRepository(h.db).record(newPayment, ctx('pay:3'))

    expect(recorded.allocations[0]?.paymentId).toBe(recorded.id)
    expect(recorded.allocations[0]?.paymentId).not.toBe('local')
    // And the money is untouched by the re-stamping.
    expect(recorded.allocations[0]?.amount).toEqual(money('NGN', 30_000_00))
  })

  it('reports a refusal from the function rather than returning a half-record', async () => {
    const h = harness([{ error: { message: 'Allocations (6000000) exceed the payment (5000000).' } }])
    await expect(
      createPaymentRepository(h.db).record(newPayment, ctx('pay:over')),
    ).rejects.toThrow(/exceed the payment/)
  })
})

describe('A payment is reversed, never edited (§E)', () => {
  it('reads the original, then writes a reversal pointing at it', async () => {
    const h = harness([[paymentRow], [{ ...paymentRow, id: 'pay_2', reversal_of_id: 'pay_1' }]])
    const reversal = await createPaymentRepository(h.db).reverse('pay_1', ctx('rev:pay_1'))

    expect(h.call(1).method).toBe('POST')
    expect(h.call(1).table).toBe('payments')
    expect(h.call(1).body).toMatchObject({
      reversal_of_id: 'pay_1',
      amount_minor: 50_000_00,
      idempotency_key: 'rev:pay_1',
    })
    expect(reversal.reversalOfId).toBe('pay_1')
    // Nothing is written to the original: it is a ledger record, and the pair
    // nets to zero rather than the first row changing.
    expect(h.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })

  it('carries no allocations — nothing was settled by money that came back', async () => {
    const h = harness([
      [{ ...paymentRow, payment_allocations: [allocationRow] }],
      [{ ...paymentRow, id: 'pay_2', reversal_of_id: 'pay_1' }],
    ])
    const reversal = await createPaymentRepository(h.db).reverse('pay_1', ctx('rev:pay_1'))

    expect(reversal.allocations).toEqual([])
    expect(h.call(1).body).not.toHaveProperty('payment_allocations')
  })

  it('refuses to reverse a reversal, on the domain rule rather than its own', async () => {
    const h = harness([[{ ...paymentRow, reversal_of_id: 'pay_0' }]])
    await expect(createPaymentRepository(h.db).reverse('pay_1', ctx('rev:again'))).rejects.toThrow(
      /reversal cannot itself be reversed/,
    )
    // Refused before anything is written.
    expect(h.calls).toHaveLength(1)
  })

  it('says plainly when the database refuses a second reversal', async () => {
    // A second reversal under a DIFFERENT key gets past the idempotency
    // index and lands on `payments_reversal_unique`. The raw constraint name
    // is not something an owner can act on.
    const h = harness([
      [paymentRow],
      { error: { message: 'duplicate key value violates unique constraint "payments_reversal_unique"' } },
    ])
    await expect(createPaymentRepository(h.db).reverse('pay_1', ctx('rev:other'))).rejects.toThrow(
      /already been reversed/,
    )
  })

  it('says so when there is no such payment', async () => {
    const h = harness([[]])
    await expect(createPaymentRepository(h.db).reverse('pay_gone', ctx('rev:x'))).rejects.toThrow(
      RepositoryError,
    )
  })
})
