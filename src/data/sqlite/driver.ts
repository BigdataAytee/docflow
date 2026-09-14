/**
 * The SQL driver port (§C, §Q Phase 4).
 *
 * One narrow interface with two implementations, and the narrowness is the
 * point. On a phone the database is SQLCipher through
 * `@capacitor-community/sqlite`; in CI it is Node's built-in `node:sqlite`.
 * Both are REAL SQLite — the same parser, the same type affinities, the same
 * transaction semantics — so the contract suite that runs on every commit is
 * exercising the engine the device runs, not a mock of it. What the device run
 * then proves is the part CI genuinely cannot: that the file is encrypted, that
 * the key came out of secure storage, and that it opens (§Q Phase 1 gate).
 *
 * Everything is `Promise`-shaped even though `node:sqlite` is synchronous,
 * because the Capacitor bridge is not and the repositories above must not know
 * which one they have.
 *
 * `transaction` is not sugar. CLAUDE.md: "Every mobile mutation = record write
 * + outbox enqueue in ONE SQLite transaction. A failed commit must not show
 * 'Saved'." A driver that could only run statements one at a time could not
 * keep that promise, so the port demands the capability rather than hoping the
 * caller remembers to BEGIN.
 */

/** What SQLite can hold. No dates, no booleans — those are mapped in `rows`. */
export type SqlValue = string | number | null | Uint8Array

export interface SqlRow {
  readonly [column: string]: SqlValue
}

/**
 * A handle valid only for the life of one `transaction` callback.
 *
 * Separate from `SqlDriver` so that nesting is unrepresentable: you cannot ask
 * a `SqlTransaction` for another transaction, and SQLite has no nested BEGIN.
 */
export interface SqlTransaction {
  run(sql: string, params?: readonly SqlValue[]): void
  all(sql: string, params?: readonly SqlValue[]): SqlRow[]
  get(sql: string, params?: readonly SqlValue[]): SqlRow | null
}

export interface SqlDriver {
  /** Statements with no result — DDL and PRAGMAs. */
  execute(sql: string): Promise<void>
  all(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>
  get(sql: string, params?: readonly SqlValue[]): Promise<SqlRow | null>
  /**
   * Runs `body` inside BEGIN/COMMIT. A throw rolls back and re-throws, so a
   * caller that sees a return value knows the bytes are on disk.
   *
   * The body is SYNCHRONOUS on purpose. An `await` inside a transaction on a
   * single connection is how half-committed states and lock timeouts happen:
   * the awaited work can interleave another statement into this transaction.
   * Making the type refuse it is cheaper than a code review that has to
   * remember.
   */
  transaction<T>(body: (tx: SqlTransaction) => T): Promise<T>
  close(): Promise<void>
}

/** Raised for anything the database refused. Repositories map it to `RepositoryError`. */
export class SqlError extends Error {}
