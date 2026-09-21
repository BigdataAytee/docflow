/**
 * Home's Outstanding, through the app's own read, across three instalments
 * (§K, Rule #3).
 *
 * WHY THIS FILE EXISTS RATHER THAN MORE CASES IN `supersession.test.ts`.
 *
 * That suite has the same scenario and passes — but its `owedInTotal` helper
 * carries its OWN copy of the rule ("which documents are still asking"),
 * written beside the domain functions it tests. So it proves the domain is
 * right and says nothing about whether the app applies it. Deleting the
 * replaced-follow-up line from `supersededIn` in `src/app/derive.ts` left all
 * 3,301 tests green: the fixture supplied the very thing under test.
 *
 * This one goes through `statDocuments` and `outstandingByCurrency` — the
 * functions Home actually calls — so the app diverging from the domain is a
 * red test rather than a quiet ₦160,000.
 *
 * THE SCENARIO. ₦145,000 invoice, paid in three: ₦50,000, ₦30,000, ₦65,000.
 * Each part payment issues a balance invoice that REPLACES the one before it,
 * so by the end there are four invoices and one debt of nothing.
 */

import { describe, expect, it } from 'vitest'

import { statDocuments } from './derive'
import type { DocumentRecord, Payment } from '../data/repositories'
import { money } from '../domain/money/money'
import { outstandingByCurrency } from '../features/home/stats'

const NGN = (minor: number) => money('NGN', minor)

const TOTAL = 145_000_00
const FIRST = 50_000_00
const SECOND = 30_000_00
const THIRD = 65_000_00

const invoice = (
  id: string,
  totalMinor: number,
  extra: Partial<DocumentRecord> = {},
): DocumentRecord =>
  ({
    id,
    companyId: 'co_1',
    type: 'invoice',
    status: 'issued',
    customerId: 'cus_1',
    currency: 'NGN',
    lineItems: [
      {
        id: `${id}_li`,
        description: 'Cement 50kg',
        quantityMilli: 20_000,
        unitPriceMinor: totalMinor / 20,
        taxable: false,
      },
    ],
    issueDate: '2026-09-01',
    issuedReference: id.toUpperCase(),
    frozenLabels: null,
    totalMinor,
    ...extra,
  }) as DocumentRecord

const paid = (id: string, minor: number, at: string, against: string): Payment => ({
  id,
  customerId: 'cus_1',
  amount: NGN(minor),
  paidAt: at,
  method: 'bank_transfer',
  source: 'manual',
  allocations: [{ id: `${id}:a`, paymentId: id, invoiceId: against, amount: NGN(minor) }],
})

/** What Home puts on the Outstanding card, through the real path. */
const outstanding = (documents: readonly DocumentRecord[], payments: readonly Payment[]): number =>
  outstandingByCurrency(statDocuments(documents), payments, []).get('NGN')?.minor ?? 0

const original = invoice('doc_orig', TOTAL)

/** Each balance invoice names the one it replaces, exactly like Rev 2. */
const balance = (id: string, totalMinor: number, supersedes?: string) =>
  invoice(id, totalMinor, {
    billsBalanceOfId: 'doc_orig',
    ...(supersedes === undefined ? {} : { supersedesId: supersedes }),
  } as Partial<DocumentRecord>)

const bal1 = balance('doc_bal1', TOTAL - FIRST)
const bal2 = balance('doc_bal2', TOTAL - FIRST - SECOND, 'doc_bal1')
const bal3 = balance('doc_bal3', TOTAL - FIRST - SECOND - THIRD, 'doc_bal2')

const p1 = paid('p1', FIRST, '2026-09-10', 'doc_orig')
const p2 = paid('p2', SECOND, '2026-09-14', 'doc_bal1')
const p3 = paid('p3', THIRD, '2026-09-18', 'doc_bal2')

describe("Home's Outstanding across three instalments (§K, Rule #3)", () => {
  it('is the whole invoice before anything is paid', () => {
    expect(outstanding([original], [])).toBe(TOTAL)
  })

  it('is the balance after the first instalment', () => {
    expect(outstanding([original, bal1], [p1])).toBe(TOTAL - FIRST)
  })

  /** Two follow-ups now exist. One has been replaced and asks for nothing. */
  it('is the balance after the second', () => {
    expect(outstanding([original, bal1, bal2], [p1, p2])).toBe(TOTAL - FIRST - SECOND)
  })

  /**
   * THE ONE THAT WOULD HAVE SHIPPED.
   *
   * Four invoices, three of them no longer asking. Without the replaced
   * follow-ups being excluded this read ₦95,000 + ₦65,000 = ₦160,000 against
   * a customer who owes nothing at all.
   */
  it('is nothing once the last instalment settles it', () => {
    expect(outstanding([original, bal1, bal2, bal3], [p1, p2, p3])).toBe(0)
  })

  /**
   * AND IT NEVER EXCEEDS THE REAL DEBT AT ANY POINT.
   *
   * Asserted as one sweep over the whole sequence rather than four separate
   * cases, because the failure this guards against is cumulative: each
   * document is individually right and the SUM is wrong.
   */
  it('equals the true debt at every stage of the sequence', () => {
    const stages: { documents: DocumentRecord[]; payments: Payment[]; owed: number }[] = [
      { documents: [original], payments: [], owed: TOTAL },
      { documents: [original, bal1], payments: [p1], owed: TOTAL - FIRST },
      { documents: [original, bal1, bal2], payments: [p1, p2], owed: TOTAL - FIRST - SECOND },
      { documents: [original, bal1, bal2, bal3], payments: [p1, p2, p3], owed: 0 },
    ]

    for (const stage of stages) {
      expect(
        outstanding(stage.documents, stage.payments),
        `${stage.documents.length} documents, ${stage.payments.length} payments`,
      ).toBe(stage.owed)
    }
  })
})

/**
 * REPLACING AND CANCELLING SEND THE DEBT TO DIFFERENT PLACES, through the
 * app's read this time. The whole risk is treating one as the other.
 */
describe('Replaced and cancelled, as Home sees them (§K)', () => {
  /*
   * ONE STATE, TWO DOCUMENTS FOR IT. After the first instalment the balance
   * is ₦95,000; `reissued` bills the same ₦95,000 and replaces `bal1` — the
   * shape you get when a balance invoice is redrawn without new money
   * arriving. Using `bal2` here instead would be comparing against a document
   * sized for a payment that has not happened, which is a fixture quietly
   * testing a different scenario from the one its name claims.
   */
  const reissued = balance('doc_bal1b', TOTAL - FIRST, 'doc_bal1')

  it('leaves the debt on the replacement only', () => {
    expect(outstanding([original, bal1, reissued], [p1])).toBe(TOTAL - FIRST)
  })

  /** Cancelled with nothing to take over: the debt goes home to the original. */
  it('returns the debt to the original when the only follow-up is cancelled', () => {
    const cancelled = { ...bal1, status: 'void' } as DocumentRecord
    expect(outstanding([original, cancelled], [p1])).toBe(TOTAL - FIRST)
  })

  /**
   * AND CANCELLING THE REPLACEMENT SENDS IT HOME TOO, never back to the
   * document it replaced — that one asks for a figure that is no longer true,
   * while the original's outstanding is computed from the ledger.
   */
  it('returns the debt to the original, not to the document that was replaced', () => {
    const cancelled = { ...reissued, status: 'void' } as DocumentRecord
    expect(outstanding([original, bal1, cancelled], [p1])).toBe(TOTAL - FIRST)
  })

  /** A draft replacement has asked for nothing, so the live one still asks. */
  it('keeps the debt on the live follow-up until its replacement is issued', () => {
    const draft = { ...reissued, status: 'draft' } as DocumentRecord
    expect(outstanding([original, bal1, draft], [p1])).toBe(TOTAL - FIRST)
  })
})
