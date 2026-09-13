/**
 * The payments repository over Supabase (§E, §K, §M).
 *
 * The ledger is the one place where a half-written record is worse than no
 * record, so `record` goes through the `record_payment` function rather than
 * through PostgREST's table endpoints: a payment and its allocations are two
 * tables and one fact, and two calls can leave the money recorded with nothing
 * saying what it settled — an invoice that reads unpaid after it was paid.
 * See `0010_record_payment.sql`.
 *
 * Two differences from the in-memory store, both deliberate:
 *
 *  · **Payments are scoped by `company_id`, not by their customer.** The
 *    memory store derives the scope from the customer because the `Payment`
 *    type carries no company, and that is right for a `Map`. The table has
 *    the column, so using it means a standalone payment from a customer who
 *    was later deleted still belongs to the company that received it — under
 *    the memory rule, that money would quietly vanish from the ledger.
 *  · **Ids are minted by the database.** The memory store re-stamps the
 *    caller's local allocation handles after minting; here the function does
 *    it, because the payment id does not exist until the insert returns.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { type Payment, type PaymentRepository, RepositoryError } from '../repositories'
import { reversalOf } from '../../domain/payments/ledger'
import { type Row, fromPayment, toPayment } from './rows'
import { insertOnce } from './mutate'

/** The shape `record_payment` returns: the row, and the rows it wrote beside it. */
interface Recorded {
  readonly payment: Row
  readonly allocations: readonly Row[]
}

export function createPaymentRepository(db: SupabaseClient): PaymentRepository {
  /**
   * Payments with their allocations, in one round trip.
   *
   * The embed is not an optimisation. Fetching allocations separately means a
   * window where a payment has been read and its allocations have not, and a
   * payment rendered without them reads as unallocated money — a different
   * fact about someone's balance than the truth.
   */
  const withAllocations = 'id, company_id, customer_id, currency, amount_minor, paid_at, method, reference, source, external_event_id, reversal_of_id, payment_allocations(*)'

  const read = async (build: (from: ReturnType<typeof db.from>) => unknown): Promise<Payment[]> => {
    const { data, error } = (await build(db.from('payments'))) as {
      data: Row[] | null
      error: { message: string } | null
    }
    if (error !== null) throw new RepositoryError(`Could not read payments: ${error.message}`)
    return (data ?? []).map((row) =>
      toPayment(row, (row['payment_allocations'] as Row[] | null) ?? []),
    )
  }

  return {
    async listForCompany(companyId) {
      return read((from) =>
        from
          .select(withAllocations)
          .eq('company_id', companyId)
          // Newest money first, and by id within a moment so the order is
          // total — two payments recorded in the same second must not swap
          // places between reads.
          .order('paid_at', { ascending: false })
          .order('id', { ascending: false }),
      )
    },

    async listForInvoice(companyId, invoiceId) {
      // An inner join through the allocations: only payments that actually
      // settled this invoice. `!inner` is what makes it a filter rather than
      // a nullable embed — without it every payment comes back, each carrying
      // an empty allocation list, and the invoice would look settled by money
      // that never touched it.
      return read((from) =>
        from
          .select(
            'id, company_id, customer_id, currency, amount_minor, paid_at, method, reference, source, external_event_id, reversal_of_id, payment_allocations!inner(*)',
          )
          .eq('company_id', companyId)
          .eq('payment_allocations.invoice_id', invoiceId)
          .order('paid_at', { ascending: false })
          .order('id', { ascending: false }),
      )
    },

    async record(payment, ctx) {
      // No company is passed. The function reads it from the caller's own
      // claims, so there is no argument a client could point at someone
      // else's ledger — and nothing for this layer to get wrong.
      const { data, error } = await db.rpc('record_payment', {
        p_idempotency_key: ctx.idempotencyKey,
        p_payment: fromPayment(payment),
        p_allocations: payment.allocations.map((allocation) => ({
          invoice_id: allocation.invoiceId,
          amount_minor: allocation.amount.minor,
        })),
      })
      if (error !== null) {
        throw new RepositoryError(`Could not record the payment: ${error.message}`)
      }
      const recorded = data as Recorded
      return toPayment(recorded.payment, recorded.allocations)
    },

    async reverse(paymentId, ctx) {
      const found = await db
        .from('payments')
        .select(withAllocations)
        .eq('id', paymentId)
        .maybeSingle()
      if (found.error !== null) {
        throw new RepositoryError(`Could not read payment ${paymentId}: ${found.error.message}`)
      }
      if (found.data === null) throw new RepositoryError(`No payment ${paymentId}.`)

      const row = found.data as Row
      const original = toPayment(row, (row['payment_allocations'] as Row[] | null) ?? [])
      // The domain decides whether this CAN be reversed — a reversal cannot
      // itself be reversed — and the id and moment are handed to it, because
      // a repository that invented the rule would be a second opinion on it.
      const reversal = reversalOf(original, '', new Date().toISOString())

      // A reversal carries no allocations (nothing was settled by money that
      // came back), so it needs no transaction and no function: one insert.
      // `payments_reversal_unique` still stands behind it, so a second
      // reversal under a DIFFERENT key is refused by the database rather than
      // by this code remembering.
      try {
        const written = await insertOnce(db, 'payments', String(row['company_id']), ctx, {
          ...fromPayment(reversal),
          // `reversalOf` returns the domain shape; the column is what the
          // unique index is built on, so it is set explicitly rather than
          // left to the spread.
          reversal_of_id: paymentId,
        })
        return toPayment(written, [])
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        if (/payments_reversal_unique|duplicate key/i.test(message)) {
          throw new RepositoryError(
            `Payment ${paymentId} has already been reversed. Record a replacement instead (v6 §E).`,
          )
        }
        throw cause
      }
    },
  }
}
