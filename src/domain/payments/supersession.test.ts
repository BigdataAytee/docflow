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
import {
  canBillBalance,
  liveFollowUpFor,
  replacedBy,
  replacedFollowUpIds,
  supersededBalanceIds,
} from './supersession'

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
  documents: readonly {
    id: string
    type: string
    status: string
    billsBalanceOfId?: string
    supersedesId?: string
  }[],
  totals: Readonly<Record<string, number>>,
  payments: readonly Payment[],
): number => {
  /*
   * TWO WAYS TO STOP BEING THE DOCUMENT THAT ASKS — an original whose
   * balance moved to a live follow-up, and a follow-up a newer one replaced.
   * Mirrors `supersededIn` in `src/app/derive.ts`, which is the one place
   * the app applies it.
   */
  const notAsking = new Set([
    ...supersededBalanceIds(documents),
    ...replacedFollowUpIds(documents),
  ])
  return documents
    .filter((d) => d.type === 'invoice' && d.status !== 'draft' && d.status !== 'void')
    .filter((d) => !notAsking.has(d.id))
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

/**
 * THREE INSTALMENTS, and the total right after every one of them.
 *
 * The owner's caution, and the reason this block asserts the TOTAL rather
 * than each document: every part payment produces a new balance invoice, so
 * paying in three leaves three follow-ups. Checked one at a time they are
 * each correct — the arithmetic on each document is fine — and added up they
 * said the customer owed nearly three times what they did, because the two
 * replaced ones were still asking for their own stale remainders.
 *
 * ₦145,000, paid ₦50,000 then ₦30,000 then ₦65,000.
 */
describe('Paying in instalments never multiplies the debt (§K, Rule #3)', () => {
  const instalment = (id: string, minor: number, at: string, against: string): Payment => ({
    id,
    customerId: 'cus_1',
    amount: NGN(minor),
    paidAt: at,
    method: 'cash',
    source: 'manual',
    allocations: [{ id: `${id}:a`, paymentId: id, invoiceId: against, amount: NGN(minor) }],
  })

  /** Each balance invoice names the one before it, exactly like Rev 2. */
  const balance = (id: string, supersedes?: string) => ({
    id,
    type: 'invoice',
    status: 'issued',
    billsBalanceOfId: 'doc_orig',
    ...(supersedes === undefined ? {} : { supersedesId: supersedes }),
  })

  const FIRST = 50_000_00
  const SECOND = 30_000_00
  const THIRD = 65_000_00

  const p1 = instalment('p1', FIRST, '2026-09-10', 'doc_orig')
  const p2 = instalment('p2', SECOND, '2026-09-14', 'doc_bal1')
  const p3 = instalment('p3', THIRD, '2026-09-18', 'doc_bal2')

  const bal1 = balance('doc_bal1')
  const bal2 = balance('doc_bal2', 'doc_bal1')
  const bal3 = balance('doc_bal3', 'doc_bal2')

  const TOTALS_BY_ID = {
    doc_orig: TOTAL,
    doc_bal1: TOTAL - FIRST,
    doc_bal2: TOTAL - FIRST - SECOND,
    doc_bal3: TOTAL - FIRST - SECOND - THIRD,
  }

  it('owes the balance after the first instalment', () => {
    expect(owedInTotal([original, bal1], TOTALS_BY_ID, [p1])).toBe(TOTAL - FIRST)
  })

  /** Two follow-ups exist; one of them has been replaced and asks nothing. */
  it('owes the balance after the second', () => {
    expect(owedInTotal([original, bal1, bal2], TOTALS_BY_ID, [p1, p2])).toBe(
      TOTAL - FIRST - SECOND,
    )
  })

  /**
   * THE ONE THAT WOULD HAVE SHIPPED. Three follow-ups, two replaced. Before
   * `replacedFollowUpIds`, this summed ₦95,000 + ₦65,000 + ₦0 = ₦160,000
   * against a real debt of nothing.
   */
  it('owes nothing once the last instalment settles it', () => {
    expect(owedInTotal([original, bal1, bal2, bal3], TOTALS_BY_ID, [p1, p2, p3])).toBe(0)
  })

  it('never counts a replaced follow-up as asking', () => {
    const replaced = replacedFollowUpIds([original, bal1, bal2, bal3])
    expect([...replaced].sort()).toEqual(['doc_bal1', 'doc_bal2'])
  })

  /** And the newest is the one the screen names. */
  it('names the newest follow-up as the live one', () => {
    expect(liveFollowUpFor('doc_orig', [original, bal1, bal2, bal3])?.id).toBe('doc_bal3')
  })
})

/**
 * REPLACING AND VOIDING ARE DIFFERENT ACTS, and the debt lands in a different
 * place for each. Asserted side by side because the whole risk is treating
 * one as the other: voiding on replacement would put the debt on the original
 * AND on the new follow-up at once.
 */
describe('Replaced and cancelled send the debt to different places (§K)', () => {
  const bal1 = { id: 'doc_bal1', type: 'invoice', status: 'issued', billsBalanceOfId: 'doc_orig' }
  const bal2 = {
    id: 'doc_bal2',
    type: 'invoice',
    status: 'issued',
    billsBalanceOfId: 'doc_orig',
    supersedesId: 'doc_bal1',
  }
  const TOTALS_TWO = { doc_orig: TOTAL, doc_bal1: BALANCE, doc_bal2: BALANCE }

  /** REPLACED: the debt is on the new follow-up, and only there. */
  it('leaves the debt on the replacement only', () => {
    const documents = [original, bal1, bal2]
    expect(owedInTotal(documents, TOTALS_TWO, [partPayment])).toBe(BALANCE)
    expect(liveFollowUpFor('doc_orig', documents)?.id).toBe('doc_bal2')
  })

  /** CANCELLED with nothing to take over: the debt goes home to the original. */
  it('returns the debt to the original when the only follow-up is cancelled', () => {
    const documents = [original, { ...bal1, status: 'void' }]
    expect(owedInTotal(documents, TOTALS_TWO, [partPayment])).toBe(BALANCE)
    expect(liveFollowUpFor('doc_orig', documents)).toBeUndefined()
  })

  /**
   * AND CANCELLING THE REPLACEMENT SENDS IT HOME TOO, not back to the one it
   * replaced. The earlier document asks for a figure that is no longer true;
   * the original's outstanding is computed from the ledger, so it is right by
   * construction. "Once replaced, always replaced."
   */
  it('returns the debt to the original, never to the document that was replaced', () => {
    const documents = [original, bal1, { ...bal2, status: 'void' }]
    expect(owedInTotal(documents, TOTALS_TWO, [partPayment])).toBe(BALANCE)
    expect(liveFollowUpFor('doc_orig', documents)).toBeUndefined()
  })

  /** A DRAFT replacement has asked for nothing, so it replaces nothing yet. */
  it('keeps the live follow-up until its replacement is issued', () => {
    const documents = [original, bal1, { ...bal2, status: 'draft' }]
    expect(liveFollowUpFor('doc_orig', documents)?.id).toBe('doc_bal1')
    expect(owedInTotal(documents, TOTALS_TWO, [partPayment])).toBe(BALANCE)
  })
})

/**
 * WHAT THE SCREEN SAYS ABOUT A REPLACED DOCUMENT.
 *
 * It must read "Replaced by …" rather than "Issued": nobody should chase it,
 * and nobody should pay from its figure. Derived from the new document's
 * link, because the replaced one is never written back to (Rule #5).
 */
describe('A replaced balance invoice says so (§G, Rule #5)', () => {
  const bal1 = { id: 'doc_bal1', type: 'invoice', status: 'issued', billsBalanceOfId: 'doc_orig' }
  const bal2 = {
    id: 'doc_bal2',
    type: 'invoice',
    status: 'issued',
    billsBalanceOfId: 'doc_orig',
    supersedesId: 'doc_bal1',
  }

  it('names the document that took over', () => {
    expect(replacedBy('doc_bal1', [original, bal1, bal2])?.id).toBe('doc_bal2')
  })

  it('says nothing about a follow-up nothing has replaced', () => {
    expect(replacedBy('doc_bal2', [original, bal1, bal2])).toBeUndefined()
  })

  /** A draft has not taken over yet, so it does not get to say it has. */
  it('is not replaced by a draft', () => {
    expect(replacedBy('doc_bal1', [original, bal1, { ...bal2, status: 'draft' }])).toBeUndefined()
  })
})
