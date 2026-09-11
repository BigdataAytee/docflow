/**
 * Recording a payment (§G, §L3).
 *
 * Rule #4: payments are ledger records. There is no "mark paid" here that sets
 * a flag — §G says the swipe action "opens a prefilled payment confirmation and
 * never writes a bare flag", so marking an invoice paid and recording a payment
 * are the SAME operation, reached from different places.
 *
 * A receipt is a view of a payment (§G): `receiptDraftFor` derives one from a
 * payment that already exists. It never creates money, and there is no path
 * here that issues a receipt without one.
 */

import {
  type CurrencyCode,
  type Money,
  compare,
  isPositive,
  money,
  subtract,
  sum,
  zero,
} from '../../domain/money/money'
import {
  type CreditNote,
  type Payment,
  type PaymentAllocation,
  LedgerError,
  invoiceOutstanding,
  validatePayment,
} from '../../domain/payments/ledger'

export interface RecordPaymentInput {
  readonly id: string
  readonly customerId: string
  readonly amount: Money
  readonly paidAt: string
  readonly method: string
  readonly reference?: string
  readonly source?: Payment['source']
  readonly externalEventId?: string
  /** The invoice this settles, when there is one. A payment may stand alone. */
  readonly invoiceId?: string
  readonly invoiceTotal?: Money
  readonly existingPayments?: readonly Payment[]
  readonly creditNotes?: readonly CreditNote[]
}

/**
 * §G: the payment sheet opens "prefilled to the balance; a changed amount is a
 * part payment". So the prefill is the outstanding balance, and nothing about
 * changing it is a special case — it is the same command with a smaller number.
 */
export function prefillAmount(
  invoiceId: string,
  invoiceTotal: Money,
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): Money {
  return invoiceOutstanding(invoiceId, invoiceTotal, payments, creditNotes)
}

export function recordPayment(input: RecordPaymentInput): Payment {
  if (!isPositive(input.amount)) {
    throw new LedgerError('A payment must be for more than nothing.')
  }

  const allocations: PaymentAllocation[] = []

  if (input.invoiceId !== undefined) {
    if (input.invoiceTotal === undefined) {
      throw new LedgerError('A document total is needed before anything can be allocated to it.')
    }
    const outstanding = invoiceOutstanding(
      input.invoiceId,
      input.invoiceTotal,
      input.existingPayments ?? [],
      input.creditNotes ?? [],
    )
    // Over-paying an invoice is customer credit, not a larger allocation (§K).
    const allocated = compare(input.amount, outstanding) > 0 ? outstanding : input.amount
    if (isPositive(allocated)) {
      allocations.push({
        id: `${input.id}:${input.invoiceId}`,
        paymentId: input.id,
        invoiceId: input.invoiceId,
        amount: allocated,
      })
    }
  }

  const payment: Payment = {
    id: input.id,
    customerId: input.customerId,
    amount: input.amount,
    paidAt: input.paidAt,
    method: input.method,
    source: input.source ?? 'manual',
    ...(input.reference === undefined ? {} : { reference: input.reference }),
    ...(input.externalEventId === undefined ? {} : { externalEventId: input.externalEventId }),
    allocations,
  }

  // The ledger has the final say, so a command can never slip past its rules.
  const outstandingMap = new Map<string, Money>()
  if (input.invoiceId !== undefined && input.invoiceTotal !== undefined) {
    outstandingMap.set(
      input.invoiceId,
      invoiceOutstanding(
        input.invoiceId,
        input.invoiceTotal,
        input.existingPayments ?? [],
        input.creditNotes ?? [],
      ),
    )
  }
  validatePayment(payment, outstandingMap)

  return payment
}

export interface PaidSoFar {
  readonly total: Money
  readonly paid: Money
  readonly left: Money
  /** 0…1, for the green progress beneath the blue bar (§G). */
  readonly progress: number
  readonly isSettled: boolean
}

/** The figures behind "₦50,000 paid of ₦145,000 · ₦95,000 left" (§G). */
export function paidSoFar(
  invoiceId: string,
  invoiceTotal: Money,
  payments: readonly Payment[],
  creditNotes: readonly CreditNote[] = [],
): PaidSoFar {
  const left = invoiceOutstanding(invoiceId, invoiceTotal, payments, creditNotes)
  const paid = subtract(invoiceTotal, left)
  return {
    total: invoiceTotal,
    paid,
    left,
    progress: invoiceTotal.minor === 0 ? 1 : paid.minor / invoiceTotal.minor,
    isSettled: left.minor === 0,
  }
}

export interface ReceiptDraft {
  readonly paymentId: string
  readonly customerId: string
  readonly amount: Money
  readonly paidAt: string
  readonly method: string
  readonly reference?: string
  readonly linkedInvoiceId?: string
}

/**
 * A receipt derived from a payment that already exists (§G, §K).
 *
 * There is deliberately no `createReceipt(amount)` anywhere: a receipt cannot
 * be the thing that records money, or reissuing one would increment income
 * (§V). This takes a payment and describes it.
 */
export function receiptDraftFor(payment: Payment): ReceiptDraft {
  if (payment.reversalOfId !== undefined) {
    throw new LedgerError('A reversal is not money a customer handed over, so there is nothing to acknowledge.')
  }
  const linked = payment.allocations[0]?.invoiceId
  return {
    paymentId: payment.id,
    customerId: payment.customerId,
    amount: payment.amount,
    paidAt: payment.paidAt,
    method: payment.method,
    ...(payment.reference === undefined ? {} : { reference: payment.reference }),
    ...(linked === undefined ? {} : { linkedInvoiceId: linked }),
  }
}

/** What this payment left unattached — customer credit (§K). */
export function unallocatedCredit(payment: Payment): Money {
  const allocated = sum(
    payment.allocations.map((a) => a.amount),
    payment.amount.currency,
  )
  return subtract(payment.amount, allocated)
}

export const zeroFor = (currency: CurrencyCode): Money => zero(currency)
export const amountOf = (currency: CurrencyCode, minor: number): Money => money(currency, minor)
