/**
 * Opening the encrypted local store (§P, §M, §Q Phase 4).
 *
 * The one place that handles the passphrase. Everything above takes a
 * `SqlDriver` and has no opinion about encryption, which is what lets the
 * contract suite run the same repositories against plain SQLite in CI.
 *
 * **This is a device-only path, and deliberately has no other branch.** The
 * first draft fell back to the `node:sqlite` driver when not running natively,
 * which read as tidy and was not: Rollup follows a dynamic import, so
 * `node:sqlite` was pulled into the browser bundle and the web build stopped
 * building. The failure was the useful kind — the honest structure is that CI
 * constructs `createNodeDriver` itself (which is what every test already
 * does), and nothing reachable from `src/main.tsx` can so much as name it.
 *
 * The web client is online-only on Supabase repositories (§B), so it has no
 * local store to open and never calls this.
 *
 * **A failure to open is never a reflex to start over.** §M is explicit that
 * logout "retains the encrypted account-scoped local store" and that deleting
 * local data is a separate explicit action — so a key that cannot be read
 * surfaces as a message with the records untouched, never as a new key over
 * the top of them. `databaseKey` refuses that; this carries the refusal up to
 * a screen that can say it in words.
 */

import type { SqlDriver } from './driver'
import { type SecureStore, databaseKey } from './key'
import { migrate } from './migrate'

export interface LocalStore {
  readonly driver: SqlDriver
  /** True when the bytes on disk are encrypted. On a device, always. */
  readonly encrypted: boolean
  readonly schemaVersion: number
}

export interface OpenOptions {
  /** Defaults to the platform keystore. Injected for the on-device gate. */
  readonly secureStore?: SecureStore
  /** Whether a database file already exists — see `key.ts`. */
  readonly databaseExists?: () => Promise<boolean>
  readonly databaseName?: string
}

export async function openLocalStore(options: OpenOptions = {}): Promise<LocalStore> {
  const [{ createCapacitorDriver }, { capacitorSecureStore }] = await Promise.all([
    import('./capacitor'),
    import('../../native/secure-storage'),
  ])

  const store = options.secureStore ?? capacitorSecureStore()

  // Asked BEFORE the key is fetched, because the answer decides whether a
  // missing key is a first run (mint one) or a lost key (refuse, touch
  // nothing).
  const databaseExists =
    (await options.databaseExists?.()) ?? (await nativeDatabaseExists(options.databaseName))

  const passphrase = await databaseKey(store, { databaseExists })

  const driver = await createCapacitorDriver({
    passphrase,
    ...(options.databaseName === undefined ? {} : { databaseName: options.databaseName }),
  })
  const schemaVersion = await migrate(driver)

  return { driver, encrypted: true, schemaVersion }
}

async function nativeDatabaseExists(databaseName?: string): Promise<boolean> {
  try {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite')
    const { DATABASE_NAME } = await import('./capacitor')
    const answer = await CapacitorSQLite.isDatabase({ database: databaseName ?? DATABASE_NAME })
    return answer.result === true
  } catch {
    // Unable to ask. Treated as "it might exist", because the cost of being
    // wrong the other way is minting a key over somebody's records.
    return true
  }
}
