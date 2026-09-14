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
 * **Everything is async, including inside a transaction**, and that is a
 * correction rather than a preference. The first draft of this port took a
 * synchronous transaction body, on the reasoning that an `await` between two
 * statements lets other work interleave into the transaction. The reasoning
 * was right and the mechanism was wrong: the Capacitor bridge is one async
 * call per statement, so a synchronous body is not something a phone can
 * offer, and a port the device cannot implement is a port that would have been
 * discovered at the APK rather than at the type.
 *
 * The hazard the sync body was aimed at is real, so it is closed where it
 * actually lives — `transaction` serialises on a queue, so two transactions on
 * one connection never interleave however many callers race. SQLite has one
 * write lock per database; this makes the JavaScript side agree with that
 * instead of discovering it as SQLITE_BUSY halfway through a commit.
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
  run(sql: string, params?: readonly SqlValue[]): Promise<void>
  all(sql: string, params?: readonly SqlValue[]): Promise<SqlRow[]>
  get(sql: string, params?: readonly SqlValue[]): Promise<SqlRow | null>
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
   * Transactions are serialised: a second call waits for the first to finish
   * rather than interleaving its statements into the first one's transaction.
   */
  transaction<T>(body: (tx: SqlTransaction) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/** Raised for anything the database refused. Repositories map it to `RepositoryError`. */
export class SqlError extends Error {}

/**
 * A promise queue, one per connection.
 *
 * Every transaction chains onto the last, so BEGIN … COMMIT pairs cannot nest
 * or interleave. Failures do not poison the chain — the next caller runs
 * whether or not the previous one threw, which matters because a rolled-back
 * transaction is an ordinary outcome here (a refused edit to an issued
 * document is a rollback, not a fault).
 */
export function createSerialiser(): <T>(body: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()

  return <T>(body: () => Promise<T>): Promise<T> => {
    const result = tail.then(body, body)
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}
