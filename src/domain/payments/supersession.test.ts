/**
 * ONE DEBT, IN ONE PLACE, AT EVERY STAGE (§K, Rule #3).
 *
 * This is the guard that should have existed when "Invoice the balance"
 * shipped. The one that did exist asserted that the original invoice's ledger
 * was UNTOUCHED — which is true, and is precisely the wrong property to lock
 * in, because the bug was that both documents then billed the same money.
 *
 * Measured before the fix, on a ₦145,000 invoice with ₦50,000 paid and
 * ₦95,000 billed on a follow-up:
 *
 *     follow-up issued  → ₦190,000 outstanding   (owed: ₦95,000)
 *     follow-up settled → ₦95,000 outstanding    (owed: ₦0)
 *
 * So the assertion here is the TOTAL — what the customer actually owes, and
 * what Home shows — through every stage the pair can be in. Never each
 * document's isolated balance, which is what let a sum of two right numbers
 * be a wrong answer.
 */

import { describe, expect, it } from 'vitest'

import { money } from '../money/money'
import { type Payment, invoiceOutstanding } from './ledger'
import { canBillBalance, liveFollowUpFor, supersededBalanceIds } from './supersession'

const NGN = (minor: number) => money('NGN', minor)

const TOTAL = 145_000_00
const PAID = 50_000_00
const BALANCE = TOTAL - PAID

const original = { id: 'doc_orig', type: 'invoice', status: 'issued' }
const followUp = (status: string) => ({
  id: 'doc_follow',
  type: 'invoice',
  status,
  billsBalanceOfId: 'doc_orig',
})

const partPayment: Payment = {
  id: 'p1',
  customerId: 'cus_1',
  amount: NGN(PAID),
  paidAt: '2026-09-10',
  method: 'cash',
  source: 'manual',
  allocations: [{ id: 'a1', paymentId: 'p1', invoiceId: 'doc_orig', amount: NGN(PAID) }],
}

const settlesFollowUp: Payment = {
  id: 'p2',
  customerId: 'cus_1',
  amount: NGN(BALANCE),
  paidAt: '2026-09-20',
  method: 'cash',
  source: 'manual',
  allocations: [{ id: 'a2', paymentId: 'p2', invoiceId: 'doc_follow', amount: NGN(BALANCE) }],
}

/**
 * What the customer owes across every document — the figure behind the
 * customer balance, Home's Outstanding and the ageing report alike.
 *
 * An invoice whose balance is billed on a LIVE follow-up contributes nothing:
 * the follow-up is the document asking, and it contributes instead. This is
 * the one place that rule is applied in the test, mirroring the one place it
 * is applied in the app.
 */
const owedInTotal = (
  documents: readonly { id: string; type: string; status: string; billsBalanceOfId?: string }[],
  totals: Readonly<Record<string, number>>,
  payments: readonly Payment[],
): number => {
  const superseded = supersededBalanceIds(documents)
  return documents
    .filter((d) => d.type === 'invoice' && d.status !== 'draft' && d.status !== 'void')
    .filter((d) => !superseded.has(d.id))
    .reduce((sum, d) => sum + invoiceOutstanding(d.id, NGN(totals[d.id] ?? 0), payments).minor, 0)
}

const TOTALS = { doc_orig: TOTAL, doc_follow: BALANCE }

describe('The total owed is right at every stage', () => {
  it('issued and untouched: the whole invoice is owed', () => {
    expect(owedInTotal([original], TOTALS, [])).toBe(TOTAL)
  })

  it('part paid: what is left is owed, once', () => {
    expect(owedInTotal([original], TOTALS, [partPayment])).toBe(BALANCE)
  })

  /**
   * A DRAFT FOLLOW-UP CHANGES NOTHING. It has asked for nothing, so the
   * original still carries the debt — and because a draft counts towards no
   * total anywhere, there is no window in which both do.
   */
  it('follow-up drafted: still owed once, still on the original', () => {
    const docs = [original, followUp('draft')]
    expect(owedInTotal(docs, TOTALS, [partPayment])).toBe(BALANCE)
    expect(supersededBalanceIds(docs).has('doc_orig')).toBe(false)
  })

  /** THE FIRST HALF OF THE BUG: this used to be ₦190,000. */
  it('follow-up issued: owed once, and now on the follow-up', () => {
    const docs = [original, followUp('issued')]
    expect(owedInTotal(docs, TOTALS, [partPayment])).toBe(BALANCE)
    expect(supersededBalanceIds(docs).has('doc_orig')).toBe(true)
  })

  /** THE SECOND HALF: this used to leave ₦95,000 owed after it was paid. */
  it('follow-up settled: nothing is owed', () => {
    const docs = [original, followUp('issued')]
    expect(owedInTotal(docs, TOTALS, [partPayment, settlesFollowUp])).toBe(0)
  })

  /**
   * REVERSIBILITY — the owner's second condition. Cancelling a follow-up must
   * return the balance to the original, not erase it. A real debt quietly
   * disappearing is worse than the double count it was meant to fix.
   */
  it('follow-up cancelled: the balance comes back to the original', () => {
    const docs = [original, followUp('void')]
    expect(owedInTotal(docs, TOTALS, [partPayment])).toBe(BALANCE)
    expect(supersededBalanceIds(docs).has('doc_orig')).toBe(false)
  })

  /** And cancelling it after it was paid does not resurrect a settled debt twice. */
  it('follow-up cancelled after payment: only what is genuinely unpaid', () => {
    const docs = [original, followUp('void')]
    // The payment against the follow-up stays in the ledger; the original's
    // own balance is what returns, less nothing — the money went elsewhere.
    expect(owedInTotal(docs, TOTALS, [partPayment, settlesFollowUp])).toBe(BALANCE)
  })
})

describe('One follow-up at a time', () => {
  /**
   * The owner's third condition, and it is the same double count by another
   * route: two live follow-ups would each claim the same balance.
   */
  it('refuses a second while the first is live', () => {
    expect(canBillBalance('doc_orig', [original, followUp('issued')])).toBe(false)
  })

  it('allows one when there is none', () => {
    expect(canBillBalance('doc_orig', [original])).toBe(true)
  })

  /** A cancelled one does not block: the balance came back, so asking again is right. */
  it('allows another once the first is cancelled', () => {
    expect(canBillBalance('doc_orig', [original, followUp('void')])).toBe(true)
  })

  /** A draft does not block either — it has asked for nothing yet. */
  it('allows one while a draft is still being written', () => {
    expect(canBillBalance('doc_orig', [original, followUp('draft')])).toBe(true)
  })
})

describe('Naming the document the balance moved to', () => {
  /**
   * The owner's first condition depends on this: an invoice where ₦50,000 of
   * ₦145,000 arrived must never show a word implying the money came in, so
   * the screen has to be able to say WHERE the rest is.
   */
  it('finds the live follow-up', () => {
    expect(liveFollowUpFor('doc_orig', [original, followUp('issued')])?.id).toBe('doc_follow')
  })

  it('finds none when it is cancelled or still a draft', () => {
    expect(liveFollowUpFor('doc_orig', [original, followUp('void')])).toBeUndefined()
    expect(liveFollowUpFor('doc_orig', [original, followUp('draft')])).toBeUndefined()
  })
})
