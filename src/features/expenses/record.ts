/**
 * Recording an expense (§G, §L6).
 *
 * "A `+` opening a three-field sheet or receipt photo; adding one immediately
 * moves 'Kept'."
 *
 * Two decisions worth stating, because both are easy to get wrong quietly:
 *
 *  · **The photo never supplies the amount.** Rule #3 — money is never
 *    inferred. A receipt photo stands in for the DESCRIPTION ("what was this
 *    for"), so the sheet's three fields become amount, date and one of
 *    description-or-photo. Reading a figure off a photograph is §N Tier B
 *    work, arrives in Phase 6, and even then lands in a review step the owner
 *    confirms — it never writes an amount on its own.
 *  · **Nothing here moves "Kept".** Kept is `moneyIn - moneyOut`, recomputed
 *    on read (`inOutKept`). Adding an expense moves it because the next read
 *    subtracts one more row, not because this function updates a total. There
 *    is no stored Kept to drift.
 */

import { type Money, isPositive } from '../../domain/money/money'
import { localDay } from '../../domain/dates/calendar'

/**
 * Carries a token, not a sentence. The words shown to the owner come from the
 * language catalogue (§S) — this layer never holds English (Rule #4 is about
 * type names, but the same reason applies to every user-facing string).
 */
export class ExpenseError extends Error {
  constructor(
    readonly field: 'amount' | 'date' | 'evidence',
    message: string,
  ) {
    super(message)
    this.name = 'ExpenseError'
  }
}

export interface RecordExpenseInput {
  readonly id: string
  readonly companyId: string
  readonly amount: Money
  /** ISO date. The sheet prefills today; the owner can back-date. */
  readonly spentOn: string
  readonly description?: string
  /** The receipt photograph, stored as a stable asset id (§E assets). */
  readonly photoAssetId?: string
  readonly category?: string
}

export interface ExpenseRecord {
  readonly id: string
  readonly companyId: string
  readonly amount: Money
  readonly spentOn: string
  readonly description: string
  readonly photoAssetId?: string
  readonly category?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function recordExpense(input: RecordExpenseInput): ExpenseRecord {
  if (!isPositive(input.amount)) {
    throw new ExpenseError('amount', 'An expense must be for more than nothing.')
  }
  if (!ISO_DATE.test(input.spentOn.slice(0, 10))) {
    throw new ExpenseError('date', `An expense needs a date it was spent on, got "${input.spentOn}".`)
  }

  const description = (input.description ?? '').trim()
  if (description === '' && input.photoAssetId === undefined) {
    throw new ExpenseError(
      'evidence',
      'An expense needs either a description or a photo standing in for one.',
    )
  }

  const category = input.category?.trim()

  return Object.freeze({
    id: input.id,
    companyId: input.companyId,
    amount: input.amount,
    // `localDay` rather than a slice: a caller handing in a full timestamp
    // would otherwise have the expense stored against its UTC day, which is
    // tomorrow for anyone spending money in the evening west of Greenwich.
    // A bare `YYYY-MM-DD` passes straight through.
    spentOn: localDay(input.spentOn),
    // A photo-only expense stays blank here and reads as its own evidence on
    // screen (§G: never a blank row). The word comes from the caller's strings.
    description,
    ...(input.photoAssetId === undefined ? {} : { photoAssetId: input.photoAssetId }),
    ...(category === undefined || category === '' ? {} : { category }),
  })
}

/** Newest first — an expense list is a diary, and the recent end is the live one. */
export function sortExpenses(expenses: readonly ExpenseRecord[]): ExpenseRecord[] {
  return [...expenses].sort((a, b) => b.spentOn.localeCompare(a.spentOn) || b.id.localeCompare(a.id))
}

/** The categories already used, so the sheet suggests instead of demanding. */
export function knownCategories(expenses: readonly ExpenseRecord[]): string[] {
  const counts = new Map<string, number>()
  for (const expense of expenses) {
    if (expense.category === undefined) continue
    counts.set(expense.category, (counts.get(expense.category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category)
}
