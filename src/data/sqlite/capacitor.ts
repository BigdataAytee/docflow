/**
 * The SQLCipher driver — what the phone actually runs (§P, §Q Phase 4).
 *
 * `@capacitor-community/sqlite` behind the same `SqlDriver` port `node.ts`
 * implements, so every repository, every migration and the whole contract
 * suite reach the device unchanged. The differences from the CI driver are
 * exactly two, and both are the point of Phase 4:
 *
 *  · the file on disk is **encrypted** — SQLCipher, not SQLite;
 *  · the passphrase comes from **secure storage**, never from the bundle (§P).
 *
 * Opening is a three-step handshake the plugin requires and it is easy to get
 * subtly wrong, so the order is written out rather than remembered:
 *
 *  1. `setEncryptionSecret` on a database that has never been encrypted, or
 *     `checkEncryptionSecret` once it has. Calling the first one twice
 *     re-keys a working database.
 *  2. `createConnection(..., encrypted: true, mode: 'secret', ...)` — 'secret'
 *     means "open with the stored passphrase". `'encryption'` means "encrypt
 *     this plaintext database NOW", which is a migration, not an open.
 *  3. `open()`, and then a read that touches a real page. A wrong key does not
 *     fail at `open()`; it fails at the first page read, with "file is not a
 *     database". Verifying at open is what turns a silent wrong-key into an
 *     honest error instead of an app that looks empty.
 *
 * The PRAGMAs are NOT set here. `migrate()` applies them, so the device and CI
 * get the same WAL, synchronous and cache settings from one list rather than
 * two that can drift.
 *
 * **Only loaded on a device.** `open.ts` imports it dynamically, so the web
 * build never pulls the plugin in.
 */

import { CapacitorSQLite, type SQLiteDBConnection, SQLiteConnection } from '@capacitor-community/sqlite'

import {
  type SqlDriver,
  type SqlRow,
  type SqlTransaction,
  type SqlValue,
  SqlError,
  createSerialiser,
} from './driver'

export const DATABASE_NAME = 'docflow'

export interface CapacitorDriverOptions {
  /** From secure storage (§P). Never a literal, never from config. */
  readonly passphrase: string
  readonly databaseName?: string
}

/** The plugin returns `{ values: [...] }`; an empty result has no `values`. */
const rowsOf = (result: { values?: unknown[] }): SqlRow[] => (result.values ?? []) as SqlRow[]

const fail = (cause: unknown): never => {
  throw new SqlError(cause instanceof Error ? cause.message : String(cause))
}

export async function createCapacitorDriver(
  options: CapacitorDriverOptions,
): Promise<SqlDriver> {
  const name = options.databaseName ?? DATABASE_NAME
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const serialise = createSerialiser()

  let db: SQLiteDBConnection
  try {
    // A stale connection survives a hot reload and a crashed start; opening a
    // second one to the same file fails with a message about connection
    // consistency rather than about anything a reader would recognise.
    await sqlite.checkConnectionsConsistency().catch(() => undefined)
    if ((await sqlite.isConnection(name, false)).result === true) {
      await sqlite.closeConnection(name, false)
    }

    // Step 1. Is there already an encrypted database here?
    const exists = (await sqlite.isDatabase(name)).result === true
    const encrypted = exists && (await sqlite.isDatabaseEncrypted(name)).result === true

    if (!encrypted) {
      // First run, or a database this app has never encrypted. Setting the
      // secret on an already-encrypted file would RE-KEY it and orphan every
      // record in it, which is why this is guarded rather than called
      // unconditionally.
      await CapacitorSQLite.setEncryptionSecret({ passphrase: options.passphrase })
    }

    // Step 2. 'secret' opens with the stored passphrase. 'encryption' would
    // convert a plaintext database, which is a different operation entirely.
    db = await sqlite.createConnection(name, true, 'secret', 1, false)
    await db.open()

    // Step 3. Touch a real page. `open()` succeeds with the wrong key; the
    // first read is where SQLCipher notices, and an app that discovered this
    // later would look like an app with no records rather than a locked one.
    await db.query('select count(*) from sqlite_master')
  } catch (cause) {
    throw new SqlError(
      `The encrypted database could not be opened: ${
        cause instanceof Error ? cause.message : String(cause)
      }. No records have been changed.`,
    )
  }

  const tx: SqlTransaction = {
    run: async (sql, params = []) => {
      await db.run(sql, params as SqlValue[], false).catch(fail)
    },
    all: async (sql, params = []) =>
      rowsOf(await db.query(sql, params as SqlValue[]).catch(fail)),
    get: async (sql, params = []) => {
      const rows = rowsOf(await db.query(sql, params as SqlValue[]).catch(fail))
      return rows[0] ?? null
    },
  }

  return {
    execute: async (sql) => {
      await db.execute(sql, false).catch(fail)
    },
    all: (sql, params = []) => tx.all(sql, params),
    get: (sql, params = []) => tx.get(sql, params),

    transaction<T>(body: (handle: SqlTransaction) => Promise<T>): Promise<T> {
      return serialise(async () => {
        await db.beginTransaction().catch(fail)
        try {
          const result = await body(tx)
          await db.commitTransaction().catch(fail)
          return result
        } catch (cause) {
          // `isTransactionActive` matters: a constraint abort (the Rule #5
          // triggers) has already rolled the transaction back, and rolling
          // back again throws an error that would replace the real one.
          //
          // `.result === true` rather than a truthiness check — the plugin
          // answers with an OBJECT, `{ result: boolean }`, which is truthy
          // whichever way it answers.
          const active = await db.isTransactionActive().catch(() => ({ result: false }))
          if (active.result === true) {
            await db.rollbackTransaction().catch(() => undefined)
          }
          throw cause
        }
      })
    },

    async close() {
      await sqlite.closeConnection(name, false).catch(() => undefined)
    },
  }
}
