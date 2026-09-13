/**
 * The legacy migration, rehearsed against exported test data (§Q Phase 7).
 *
 * §Q asks for a parallel-run cutover with per-account reconciliation, and for
 * the domain to point at the new app "only after totals match". So the thing
 * under test is not "does it convert" but "does it tell the truth about what
 * it converted" — a migration that reports balanced when it is not is worse
 * than one that crashes.
 *
 * The fixture is a real-shaped export: paid and part-paid invoices, an
 * overdue one, an accepted quotation, a delivered waybill, a receipt, a
 * draft, and three deliberate problems — a `returned` waybill with no new
 * state, a total carrying half a kobo, and a line whose arithmetic disagrees
 * with its stored total.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { LEGACY_STATUSES, coverage, mapStatus, UnmappableStatus } from './status'
import { UnconvertibleAmount, toMinor } from './money'
import { type LegacyAccount, migrateAccount, reportOf } from './migrate'

const account = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'account-export.json'), 'utf8'),
) as LegacyAccount

describe('The 17-value enum maps to per-type statuses (§Q)', () => {
  it('covers all seventeen legacy values', () => {
    expect(LEGACY_STATUSES).toHaveLength(17)
  })

  it('reads the same word differently per type, because it meant different things', () => {
    // "sent" on an invoice is sent; on a waybill it means the goods left.
    // One table keyed only by the old value would have to pick one.
    expect(mapStatus('invoice', 'sent').status).toBe('sent')
    expect(mapStatus('waybill', 'sent').status).toBe('dispatched')
  })

  it('never stores a derived state as truth', () => {
    // CLAUDE.md: paid, overdue and expired are computed at read time. Writing
    // "paid" as a status would make a derived fact into a stored one.
    for (const legacy of ['paid', 'partially_paid', 'overdue'] as const) {
      const mapped = mapStatus('invoice', legacy)
      expect(['paid', 'partially_paid', 'overdue']).not.toContain(mapped.status)
    }
  })

  it('flags the money states so the payment is carried across', () => {
    // The silent failure this guards: status written, payment dropped, and
    // every paid invoice arrives looking unpaid.
    expect(mapStatus('invoice', 'paid').impliesPayment).toBe(true)
    expect(mapStatus('invoice', 'partially_paid').impliesPayment).toBe(true)
    // Overdue is not money that moved — it is a date that passed.
    expect(mapStatus('invoice', 'overdue').impliesPayment).toBe(false)
  })

  it('refuses a legacy value with no honest mapping, rather than guessing', () => {
    // A returned delivery is not delivered, and not void either. Somebody has
    // to say which, and a guess writes the wrong lifecycle state onto a real
    // document with nothing downstream able to tell.
    expect(() => mapStatus('waybill', 'returned')).toThrow(UnmappableStatus)
  })

  it('maps every value that a type could actually hold', () => {
    // Not every pair is meaningful — an invoice is never "packed". What must
    // not happen is a pair that occurs in real data having no mapping, so the
    // coverage is listed rather than assumed.
    const unmapped = coverage().filter((c) => !c.mapped)
    expect(unmapped.some((c) => c.type === 'invoice' && c.status === 'draft')).toBe(false)
    expect(unmapped.some((c) => c.type === 'waybill' && c.status === 'delivered')).toBe(false)
  })
})

describe('Money crosses to minor units exactly (§Q, Rule #3)', () => {
  it('converts through the decimal text, not the binary value', () => {
    // 1234.56 is 1234.5599999999999 in memory, which is exactly what the
    // legacy app stored when somebody typed 1234.56. Refusing it would block
    // a migration over an artefact of how the number was written down.
    expect(toMinor(1234.56, 100)).toBe(123_456)
    expect(toMinor(87500.5, 100)).toBe(8_750_050)
    expect(toMinor(0.07, 100)).toBe(7)
    expect(toMinor(145000, 100)).toBe(14_500_000)
  })

  it('refuses half a kobo rather than rounding it away', () => {
    // §Q asks for reconciliation to the naira, and half a kobo reconciles to
    // nothing. A migration that quietly adjusts somebody's money is worse
    // than one that stops and asks.
    expect(() => toMinor(1234.565, 100)).toThrow(UnconvertibleAmount)
  })

  it('treats a missing amount as nothing, which is what the legacy default was', () => {
    expect(toMinor(undefined, 100)).toBe(0)
    expect(toMinor(null, 100)).toBe(0)
  })

  it('refuses a value that is not a number at all', () => {
    expect(() => toMinor('1000', 100)).toThrow(UnconvertibleAmount)
    expect(() => toMinor(Number.NaN, 100)).toThrow(UnconvertibleAmount)
  })
})

describe('One account, converted and reconciled (§Q)', () => {
  const { documents, reconciliation } = migrateAccount(account)

  it('carries the payment across for every legacy money status', () => {
    const paidInvoice = documents.find((d) => d.legacyId === 'doc-1')
    // ₦145,000.00 paid. Without this the invoice arrives looking unpaid and
    // the business's receivables are silently wrong.
    expect(paidInvoice?.paymentMinor).toBe(14_500_000)

    const partPaid = documents.find((d) => d.legacyId === 'doc-2')
    expect(partPaid?.paymentMinor).toBe(4_000_025)

    // Overdue is a date, not money.
    expect(documents.find((d) => d.legacyId === 'doc-3')?.paymentMinor).toBe(0)
  })

  it('freezes EN-NG labels on issued documents and none on drafts (§Q, Rule #5)', () => {
    const issued = documents.find((d) => d.legacyId === 'doc-1')
    // The legacy app was EN-NG only. Freezing anything else would relabel
    // history — a 2025 invoice printing as whatever the region says today.
    expect(issued?.frozenLabels?.printedTitle).toBe('INVOICE')
    expect(issued?.issuedReference).toBe('INV-0001')

    const draft = documents.find((d) => d.legacyId === 'doc-7')
    expect(draft?.frozenLabels).toBeNull()
    expect(draft?.issuedReference).toBeNull()
  })

  it('maps a delivered waybill and an accepted quotation to their own states', () => {
    expect(documents.find((d) => d.legacyId === 'doc-5')?.status).toBe('delivered')
    expect(documents.find((d) => d.legacyId === 'doc-4')?.status).toBe('accepted')
    expect(documents.find((d) => d.legacyId === 'doc-10')?.status).toBe('void')
  })

  it('refuses the two documents it cannot convert honestly, and says which', () => {
    const refused = reconciliation.refusals.map((r) => r.legacyId).sort()
    // The `returned` waybill, and the invoice carrying half a kobo.
    expect(refused).toEqual(['doc-8', 'doc-9'])
    expect(reconciliation.refusals.find((r) => r.legacyId === 'doc-8')?.reason).toMatch(/returned/)
    expect(reconciliation.refusals.find((r) => r.legacyId === 'doc-9')?.reason).toMatch(/1234.565/)
  })

  it('does NOT report balanced while anything was refused (§Q)', () => {
    // "webdocflow.com points at the new app only after totals match." A
    // migration that reported balanced here would make that sentence a lie.
    expect(reconciliation.balanced).toBe(false)
    expect(reconciliation.migratedCount).toBeLessThan(reconciliation.legacyCount)
  })

  it('reports a legacy row whose stored total disagrees with its own lines', () => {
    // 17.5 × ₦5,000.03 is ₦87,500.53, not the ₦87,500.50 the legacy row
    // stored. Reported, never corrected: carrying the data across faithfully
    // and saying where it disagrees with itself is the job.
    const disagreement = reconciliation.disagreements.find((d) => d.legacyId === 'doc-2')
    expect(disagreement).toBeDefined()
    expect(disagreement?.storedMinor).toBe(8_750_050)
    expect(disagreement?.differenceMinor).not.toBe(0)
  })

  it('writes a report a person can act on', () => {
    const report = reportOf(reconciliation)
    expect(report).toContain('NOT BALANCED — do not cut over')
    expect(report).toContain('REFUSED doc-8')
    expect(report).toContain('DISAGREES doc-2')
  })
})

describe('An account with nothing wrong balances (§Q)', () => {
  const clean: LegacyAccount = {
    accountId: 'legacy-acct-002',
    companyName: 'Clean Books Ltd',
    documents: account.documents.filter(
      (d) => !['doc-2', 'doc-8', 'doc-9'].includes(d.id),
    ),
  }

  it('matches counts and totals to the naira, and says so', () => {
    const { reconciliation } = migrateAccount(clean)
    expect(reconciliation.refusals).toEqual([])
    expect(reconciliation.disagreements).toEqual([])
    expect(reconciliation.migratedCount).toBe(reconciliation.legacyCount)
    expect(reconciliation.migratedTotalMinor).toBe(reconciliation.legacyTotalMinor)
    expect(reconciliation.balanced).toBe(true)
    expect(reportOf(reconciliation)).toContain('BALANCED')
  })

  it('is a pure read — the export it was given is untouched', () => {
    const before = JSON.stringify(clean)
    migrateAccount(clean)
    // §Q: "the legacy backend stays readable — never writable." Nothing here
    // writes anywhere, so that is not a rule anybody has to remember.
    expect(JSON.stringify(clean)).toBe(before)
  })
})
