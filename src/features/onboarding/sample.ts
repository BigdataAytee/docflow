/**
 * Sample records (§R, §L8).
 *
 * "Sample records are visually labelled and EXCLUDED from balances, counts and
 * analytics; the prototype's seeded money never enters a real account."
 *
 * That last clause is a money rule, so this is built the way money rules are:
 * the exclusion is not a filter each caller remembers to apply, it is a
 * property of the record, and `realOnly` is the only way into the figures.
 */

export interface Sampleable {
  readonly id: string
  /** True for a demonstration record. Never true for anything a user made. */
  readonly isSample?: boolean
}

export const isSample = (record: Sampleable): boolean => record.isSample === true

/**
 * The records that count. Everything feeding a balance, a count or a chart
 * goes through here first — §R's "never enters a real account" is one
 * function rather than a habit.
 */
export const realOnly = <T extends Sampleable>(records: readonly T[]): T[] =>
  records.filter((record) => !isSample(record))

export const samplesOnly = <T extends Sampleable>(records: readonly T[]): T[] =>
  records.filter(isSample)

export class SampleError extends Error {}

/**
 * A sample can be viewed, shared as a labelled example, and deleted — but it
 * can never be issued. Issuing would mint a real reference and, for an
 * invoice, put money into a real ledger.
 */
export function assertNotSample(record: Sampleable, action: string): void {
  if (isSample(record)) {
    throw new SampleError(
      `A sample cannot be ${action}. It exists to show what a document looks like, and the seeded money in it never enters a real account (v6 §R).`,
    )
  }
}
