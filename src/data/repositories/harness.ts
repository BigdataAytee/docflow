/**
 * One contract, two implementations (§C, §Q Phase 4).
 *
 * `repositories.test.ts` used to build an in-memory store directly and reach
 * into its arrays. That was fine while there was only one implementation — and
 * it stopped being fine the moment SQLite existed, because the suite that
 * defines what a repository MEANS could only be run against the one that is
 * never shipped to anybody.
 *
 * So the suite now takes a harness. Two things had to change for that to be
 * honest rather than cosmetic:
 *
 *  · **Counting rows is a capability, not a peek.** The suite asserts "exactly
 *    one payment exists" — a real claim about the store, and one the in-memory
 *    version answered with `state.payments.length`. SQLite answers it with a
 *    COUNT. `count()` is that question asked in a way both can answer.
 *
 *  · **Identity is not part of the contract.** The old suite asserted a
 *    replayed create returned the very same OBJECT. In memory that is free; a
 *    SQLite implementation reads the row back and builds a new object with the
 *    same values, which honours §M exactly as well. The contract is that the
 *    same RECORD comes back, so the assertion is now `toEqual`. Nothing about
 *    idempotency was weakened: "one row, same values" is still checked, and
 *    now checked against a database that could really produce two.
 */

import type { Repositories } from './types'

/** The tables the contract suite needs to count. Named, not free-form SQL. */
export type CountableTable = 'payments' | 'linkTokens' | 'assets' | 'documents'

export interface RepositoryHarness {
  readonly name: string
  /** A fresh, empty store with ACME and RIVAL seeded. */
  readonly create: (companyIds: readonly string[]) => Promise<{
    readonly repositories: Repositories
    /** How many rows the store actually holds — not how many were returned. */
    readonly count: (table: CountableTable) => Promise<number>
    /**
     * The fields a stored link-token row carries.
     *
     * §P: only the hash is kept, never the token. Asserting that needs the
     * stored SHAPE rather than the record type, because the type could omit a
     * column the table still writes.
     */
    readonly linkTokenFields: () => Promise<string[]>
    readonly dispose: () => Promise<void>
  }>
}
