/**
 * The `node:sqlite` driver — CI, and nothing else (§Q Phase 4).
 *
 * This exists so the repository contract suite runs against REAL SQLite on
 * every commit: the same engine, parser, type affinities and transaction
 * semantics the phone runs. A hand-written fake would pass tests the device
 * would fail, which is the specific way a "tested" data layer arrives broken.
 *
 * It is NOT SQLCipher and makes no claim to be. Node's built-in build has no
 * encryption, so this driver cannot demonstrate the §Q Phase 1 clause
 * "encrypted SQLite opens on device" — only the device can, and only with
 * `capacitor.ts`. Keeping the two drivers apart is what stops a green CI run
 * being mistaken for that evidence.
 *
 * Never bundled: `src/data/sqlite/index.ts` chooses the Capacitor driver on a
 * device, and `node:sqlite` is imported only from here, only under Node.
 */

import { DatabaseSync } from 'node:sqlite'

import {
  type SqlDriver,
  type SqlRow,
  type SqlTransaction,
  type SqlValue,
  SqlError,
} from './driver'
import { PRAGMAS } from './schema'

/**
 * `node:sqlite` returns rows as plain objects whose values are already
 * `SqlValue`-shaped, but it types them loosely. One cast, in one place.
 */
const asRows = (rows: unknown[]): SqlRow[] => rows as SqlRow[]

export function createNodeDriver(filename = ':memory:'): SqlDriver {
  let db: DatabaseSync | null = new DatabaseSync(filename)

  const open = (): DatabaseSync => {
    if (db === null) throw new SqlError('The database is closed.')
    return db
  }

  // PRAGMAs before anything else, so the first write already lands in a WAL.
  // An in-memory database refuses WAL; that is not a failure worth failing on,
  // so each pragma is attempted and a refusal is left alone.
  for (const pragma of PRAGMAS) {
    try {
      open().exec(pragma)
    } catch {
      // The pragma did not apply to this database. The next one might.
    }
  }

  const wrap = <T>(body: () => T): T => {
    try {
      return body()
    } catch (cause) {
      throw new SqlError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const tx: SqlTransaction = {
    run: (sql, params = []) =>
      wrap(() => {
        open().prepare(sql).run(...(params as SqlValue[]))
      }),
    all: (sql, params = []) => wrap(() => asRows(open().prepare(sql).all(...(params as SqlValue[])))),
    get: (sql, params = []) =>
      wrap(() => (open().prepare(sql).get(...(params as SqlValue[])) as SqlRow | undefined) ?? null),
  }

  return {
    execute: async (sql) => wrap(() => open().exec(sql)),
    all: async (sql, params = []) => tx.all(sql, params),
    get: async (sql, params = []) => tx.get(sql, params),

    async transaction<T>(body: (handle: SqlTransaction) => T): Promise<T> {
      // IMMEDIATE, not DEFERRED: the write lock is taken at BEGIN rather than
      // at the first write, so two concurrent transactions fail fast instead
      // of one discovering SQLITE_BUSY halfway through and rolling back work
      // it had already reported as saved.
      wrap(() => open().exec('begin immediate'))
      try {
        const result = body(tx)
        wrap(() => open().exec('commit'))
        return result
      } catch (cause) {
        try {
          open().exec('rollback')
        } catch {
          // Already rolled back by the engine (a constraint abort does this).
          // The original failure is what the caller needs, not this one.
        }
        throw cause
      }
    },

    async close() {
      db?.close()
      db = null
    },
  }
}
