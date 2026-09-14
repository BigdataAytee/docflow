/**
 * The Phase 4 device gate, run ON the device (§Q Phase 4, §Q Phase 1).
 *
 * Some clauses cannot be checked from a repository, and the honest response is
 * to run them where they are true rather than to assert them from a distance.
 * These are those clauses:
 *
 *  · **"Encrypted SQLite opens on device"** — the §Q Phase 1 gate clause that
 *    has been deferred since Phase 1, because it needs a native shell and a
 *    physical phone. CI cannot close it: `node:sqlite` has no SQLCipher, so a
 *    green CI run proves the repositories work and says nothing about
 *    encryption.
 *  · **"cold start < 2s to an interactive dashboard from SQLite"** — a number,
 *    measured, not estimated.
 *  · **The encryption is real**, checked by reading the raw file header. An
 *    unencrypted SQLite file begins with the ASCII bytes `SQLite format 3`.
 *    Asking the plugin "is this encrypted?" and believing it is asking the
 *    same component that would be lying; reading the bytes is not.
 *
 * Every result carries the evidence it was derived from — a number, a byte
 * prefix, an error message — so the PLAN entry can quote a measurement rather
 * than a claim. A check that cannot run reports `skipped` with a reason and
 * never `passed`.
 *
 * Results go to `console.log` as one JSON line, which `adb logcat` captures.
 * That is the whole reporting mechanism: no server, nothing to deploy, and it
 * works with the phone in airplane mode — which several of these checks
 * require.
 */

import { type SqlDriver } from '../data/sqlite/driver'

export type CheckState = 'passed' | 'failed' | 'skipped'

export interface CheckResult {
  readonly name: string
  readonly state: CheckState
  /** What was actually observed. The reason this file exists. */
  readonly evidence: string
  /** §Q's threshold, where the clause has one. */
  readonly budget?: string
}

export interface GateReport {
  readonly ranAt: string
  readonly device: string
  readonly results: readonly CheckResult[];
  readonly passed: number
  readonly failed: number
  readonly skipped: number
}

const pass = (name: string, evidence: string, budget?: string): CheckResult => ({
  name,
  state: 'passed',
  evidence,
  ...(budget === undefined ? {} : { budget }),
})

const fail = (name: string, evidence: string, budget?: string): CheckResult => ({
  name,
  state: 'failed',
  evidence,
  ...(budget === undefined ? {} : { budget }),
})

const skip = (name: string, evidence: string): CheckResult => ({
  name,
  state: 'skipped',
  evidence,
})

/** §Q Phase 4: "cold start < 2s to an interactive dashboard from SQLite". */
export const COLD_START_BUDGET_MS = 2_000

export interface GateInput {
  readonly driver: SqlDriver
  /** How long the encrypted store took to open and migrate. Not cold start. */
  readonly storeOpenMs: number
  /** Where that time went. */
  readonly marks: Readonly<Record<string, number>>
  /** What the open path reported. Checked against the raw bytes below. */
  readonly claimedEncrypted: boolean
  readonly databaseName?: string
}

export async function runDeviceGate(input: GateInput): Promise<GateReport> {
  const results: CheckResult[] = []

  results.push(await opensAtAll(input.driver))
  results.push(await reallyEncrypted(input))
  results.push(storeOpen(input.storeOpenMs, input.marks))
  results.push(await schemaIsThere(input.driver))
  results.push(await rule5HoldsOnDevice(input.driver))
  results.push(await writeAndOutboxCommitTogether(input.driver))

  return {
    ranAt: new Date().toISOString(),
    device: navigator.userAgent,
    results,
    passed: results.filter((result) => result.state === 'passed').length,
    failed: results.filter((result) => result.state === 'failed').length,
    skipped: results.filter((result) => result.state === 'skipped').length,
  }
}

const NAME_OPENS = 'Encrypted SQLite opens on device (§Q Phase 1 gate)'

async function opensAtAll(driver: SqlDriver): Promise<CheckResult> {
  try {
    const row = await driver.get('select sqlite_version() as version')
    return pass(NAME_OPENS, `opened; sqlite ${String(row?.['version'])}`)
  } catch (cause) {
    return fail(NAME_OPENS, messageOf(cause))
  }
}

const NAME_ENCRYPTED = 'The database file on disk is actually encrypted (§P)'

/**
 * Read the first sixteen bytes of the file and look for the plaintext header.
 *
 * A plain SQLite database starts with `SQLite format 3\0`. SQLCipher encrypts
 * from byte zero, including the header, so those bytes must NOT be there. This
 * is the only check in the file that does not take the plugin's word for
 * anything.
 */
async function reallyEncrypted(input: GateInput): Promise<CheckResult> {
  if (!input.claimedEncrypted) {
    return fail(NAME_ENCRYPTED, 'The store reported itself as unencrypted.')
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const name = `${input.databaseName ?? 'docflow'}SQLite.db`

    // The plugin keeps databases under the app's private data directory.
    const { data } = await Filesystem.readFile({
      path: `../databases/${name}`,
      directory: Directory.Data,
    })

    const head = atob(String(data).slice(0, 32)).slice(0, 16)
    if (head.startsWith('SQLite format 3')) {
      return fail(NAME_ENCRYPTED, `plaintext header found: ${JSON.stringify(head)}`)
    }
    return pass(NAME_ENCRYPTED, `no plaintext header; first bytes ${hex(head)}`)
  } catch (cause) {
    // Reported as SKIPPED, never as passed. Being unable to read the file is
    // not evidence that its contents are encrypted.
    return skip(NAME_ENCRYPTED, `could not read the database file: ${messageOf(cause)}`)
  }
}

const NAME_STORE_OPEN = 'Opening and migrating the encrypted store (part of §Q Phase 4 cold start)'

/**
 * The store-open time only, and labelled as such.
 *
 * §Q's budget is for the whole cold start — icon tap to usable dashboard — and
 * the app cannot see when it was tapped. `tools/device/gate.ts` measures that
 * end to end from the wall clock and reports it alongside this. Reporting this
 * number under §Q's heading would be claiming a budget was met by timing the
 * cheapest part of it.
 */
function storeOpen(storeOpenMs: number, marks: Readonly<Record<string, number>>): CheckResult {
  const breakdown = Object.entries(marks)
    .map(([name, at]) => `${name} @${at}ms`)
    .join(', ')
  const evidence = `${storeOpenMs}ms to open, migrate and seed (${breakdown})`
  // No budget of its own: it is a component, and the clause it belongs to is
  // measured outside the app.
  return storeOpenMs < COLD_START_BUDGET_MS
    ? pass(NAME_STORE_OPEN, evidence)
    : fail(NAME_STORE_OPEN, evidence, `< ${COLD_START_BUDGET_MS}ms on its own`)
}

const NAME_SCHEMA = 'The §E schema and its Rule #5 triggers migrated on device'

async function schemaIsThere(driver: SqlDriver): Promise<CheckResult> {
  try {
    const tables = await driver.all(
      "select type, name from sqlite_master where type in ('table', 'trigger')",
    )
    const triggers = tables.filter((row) => row['type'] === 'trigger').length
    const tableCount = tables.filter((row) => row['type'] === 'table').length
    const version = await driver.get('pragma user_version')

    return triggers === 3
      ? pass(
          NAME_SCHEMA,
          `${tableCount} tables, ${triggers} triggers, user_version ${String(version?.['user_version'])}`,
        )
      : fail(NAME_SCHEMA, `expected 3 triggers, found ${triggers}`)
  } catch (cause) {
    return fail(NAME_SCHEMA, messageOf(cause))
  }
}

const NAME_RULE5 = 'An issued reference cannot be rewritten, on device (Rule #5)'

/**
 * The trigger, on the phone.
 *
 * Proven in CI against `node:sqlite`; SQLCipher is a different build of
 * SQLite, and "the triggers came across" is exactly the kind of thing that is
 * assumed rather than checked. Everything it writes is removed again.
 */
async function rule5HoldsOnDevice(driver: SqlDriver): Promise<CheckResult> {
  const id = `gate_${Date.now()}`
  try {
    await driver.transaction(async (tx) => {
      await tx.run(
        `insert into documents (id, company_id, type, status, currency, total_minor, issued_reference)
         values (?, 'co_gate', 'invoice', 'issued', 'NGN', 0, 'GATE-0001')`,
        [id],
      )
    })

    let refused = false
    try {
      await driver.transaction(async (tx) => {
        await tx.run('update documents set issued_reference = ? where id = ?', ['FORGED', id])
      })
    } catch (cause) {
      refused = /frozen at issue/i.test(messageOf(cause))
    }

    const after = await driver.get('select issued_reference from documents where id = ?', [id])
    const reference = String(after?.['issued_reference'])

    await driver.transaction(async (tx) => {
      await tx.run('delete from documents where id = ?', [id])
    })

    return refused && reference === 'GATE-0001'
      ? pass(NAME_RULE5, `the update was refused; the reference is still ${reference}`)
      : fail(NAME_RULE5, `refused=${refused}, reference=${reference}`)
  } catch (cause) {
    return fail(NAME_RULE5, messageOf(cause))
  }
}

const NAME_ATOMIC = 'A record write and its outbox enqueue commit together (CLAUDE.md)'

async function writeAndOutboxCommitTogether(driver: SqlDriver): Promise<CheckResult> {
  const id = `gate_${Date.now()}`
  try {
    let threw = false
    try {
      await driver.transaction(async (tx) => {
        await tx.run(
          `insert into customers (id, company_id, kind, name) values (?, 'co_gate', 'person', 'Gate')`,
          [id],
        )
        // A NOT NULL column left out: the enqueue half fails.
        await tx.run('insert into outbox (id) values (?)', [id])
      })
    } catch {
      threw = true
    }

    const row = await driver.get('select id from customers where id = ?', [id])
    return threw && row === null
      ? pass(NAME_ATOMIC, 'the failed enqueue rolled the record back — no orphan "Saved"')
      : fail(NAME_ATOMIC, `threw=${threw}, customer row ${row === null ? 'absent' : 'PRESENT'}`)
  } catch (cause) {
    return fail(NAME_ATOMIC, messageOf(cause))
  }
}

const hex = (text: string): string =>
  Array.from(text.slice(0, 8), (char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

/** One line, so `adb logcat` hands back something parseable. */
export const reportLine = (report: GateReport): string => `DOCFLOW_GATE ${JSON.stringify(report)}`
