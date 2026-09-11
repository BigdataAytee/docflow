/**
 * "Ask anything about your business" (§G).
 *
 * "Text box + example chips; answers in plain language above an in-app chart.
 * All computed from the phone's copy, offline. Chips run predefined local
 * queries on any phone; free-form questions follow the capability ladder (§N)."
 *
 * So there are two paths and they are not the same promise:
 *
 *  · A CHIP is a named query with code behind it. It works on the cheapest
 *    phone, in airplane mode, forever. Every figure it quotes comes from the
 *    same functions the cards above use, so the answer and the chart can never
 *    disagree.
 *  · A FREE-FORM question needs §N's understanding, which arrives in Phase 6
 *    and is per-device. Until then this returns `unavailable` and says so.
 *    §N is explicit: an unavailable capability is stated plainly, never
 *    dressed up, and never quietly answered online (CLAUDE.md — no silent
 *    online fallbacks).
 *
 * Nothing here composes a sentence. Each answer is a token plus its figures;
 * the words come from the caller's language catalogue.
 */

import type { CurrencyCode, Money } from '../../domain/money/money'
import type { CreditNote, Payment } from '../../domain/payments/ledger'
import { invoiceOutstanding } from '../../domain/payments/ledger'
import { type AgeingDocument, ageingByCurrency } from './ageing'
import { type ExpenseEntry, inOutKept, shiftMonths } from './inOutKept'
import { type SoldDocument, topItems } from './topItems'

export const ASK_CHIPS = ['who_owes_most', 'best_seller', 'kept_this_month', 'how_late'] as const
export type AskChip = (typeof ASK_CHIPS)[number]

export interface AskFacts {
  readonly documents: readonly (AgeingDocument & SoldDocument)[]
  readonly payments: readonly Payment[]
  readonly expenses: readonly ExpenseEntry[]
  readonly creditNotes?: readonly CreditNote[]
  readonly customerNames: ReadonlyMap<string, string>
  readonly customerOf: ReadonlyMap<string, string>
  readonly today: string
}

export type AskAnswer =
  | { readonly kind: 'who_owes_most'; readonly customerName: string; readonly amount: Money }
  | { readonly kind: 'best_seller'; readonly name: string; readonly value: Money }
  | { readonly kind: 'kept_this_month'; readonly currency: CurrencyCode; readonly kept: Money }
  | { readonly kind: 'how_late'; readonly worst: string | null; readonly amount: Money | null }
  | { readonly kind: 'nothing_recorded' }
  /** §N: free-form understanding is a per-device capability, not a promise. */
  | { readonly kind: 'unavailable' }

/** Every chip answer is computed here, from the phone's own copy. */
export function answerChip(chip: AskChip, facts: AskFacts): AskAnswer {
  switch (chip) {
    case 'who_owes_most':
      return whoOwesMost(facts)
    case 'best_seller':
      return bestSeller(facts)
    case 'kept_this_month':
      return keptThisMonth(facts)
    case 'how_late':
      return howLate(facts)
  }
}

/**
 * A typed question. Until §N ships (Phase 6) this is honest about not
 * understanding, rather than guessing at a keyword or reaching for a network.
 */
export function answerFreeForm(_question: string, _facts: AskFacts): AskAnswer {
  return { kind: 'unavailable' }
}

function whoOwesMost(facts: AskFacts): AskAnswer {
  // Keyed by customer AND currency: §G forbids adding NGN to USD, so "owes the
  // most" is the largest debt in one currency, never a converted total.
  const owed = new Map<string, { customerId: string; amount: Money }>()

  for (const document of facts.documents) {
    if (document.type !== 'invoice') continue
    if (document.status === 'draft' || document.status === 'void') continue
    const customerId = facts.customerOf.get(document.id)
    if (customerId === undefined) continue

    const left = invoiceOutstanding(
      document.id,
      document.total,
      facts.payments,
      facts.creditNotes ?? [],
    )
    if (left.minor <= 0) continue

    const key = `${customerId}/${left.currency}`
    const running = owed.get(key)
    owed.set(key, {
      customerId,
      amount: { currency: left.currency, minor: (running?.amount.minor ?? 0) + left.minor },
    })
  }

  let worst: { customerId: string; amount: Money } | null = null
  for (const row of owed.values()) {
    if (worst === null || row.amount.minor > worst.amount.minor) worst = row
  }

  if (worst === null) return { kind: 'nothing_recorded' }
  return {
    kind: 'who_owes_most',
    customerName: facts.customerNames.get(worst.customerId) ?? worst.customerId,
    amount: worst.amount,
  }
}

function bestSeller(facts: AskFacts): AskAnswer {
  const ranked = topItems(facts.documents, {
    from: shiftMonths(facts.today, 0),
    to: shiftMonths(facts.today, 1),
    limit: 1,
  })
  const best = ranked[0]
  if (best === undefined) return { kind: 'nothing_recorded' }
  return { kind: 'best_seller', name: best.name, value: best.value }
}

function keptThisMonth(facts: AskFacts): AskAnswer {
  const rows = inOutKept(facts.payments, facts.expenses, {
    from: shiftMonths(facts.today, 0),
    to: shiftMonths(facts.today, 1),
  })
  // The biggest bucket answers the question asked; the cards above show them all.
  let best: { currency: CurrencyCode; kept: Money } | null = null
  for (const row of rows.values()) {
    if (best === null || Math.abs(row.kept.minor) > Math.abs(best.kept.minor)) {
      best = { currency: row.currency, kept: row.kept }
    }
  }
  if (best === null) return { kind: 'nothing_recorded' }
  return { kind: 'kept_this_month', currency: best.currency, kept: best.kept }
}

function howLate(facts: AskFacts): AskAnswer {
  const ageing = ageingByCurrency(
    facts.documents,
    facts.payments,
    facts.today,
    facts.creditNotes ?? [],
  )
  let worst: { bucket: string; amount: Money } | null = null
  for (const row of ageing.values()) {
    if (row.worst === null) continue
    const amount = row.buckets[row.worst]
    if (worst === null || amount.minor > worst.amount.minor) {
      worst = { bucket: row.worst, amount }
    }
  }
  if (ageing.size === 0) return { kind: 'nothing_recorded' }
  if (worst === null) return { kind: 'how_late', worst: null, amount: null }
  return { kind: 'how_late', worst: worst.bucket, amount: worst.amount }
}
