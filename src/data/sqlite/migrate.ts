/**
 * Bringing a database up to date (§Q Phase 4).
 *
 * `user_version` is SQLite's own integer, stored in the file header, so the
 * schema version travels with the database rather than with a row a migration
 * could fail to write. It is read before the transaction and set inside it, so
 * a migration that aborts halfway leaves the version where it was and the next
 * launch retries the same step — never half of it.
 *
 * A database FROM THE FUTURE is refused rather than downgraded. It happens for
 * real: an owner installs a newer build, then restores an older APK. Running
 * old code against a newer schema would read columns that moved and write rows
 * the newer build cannot parse, and the damage is silent. Refusing is the only
 * honest answer, and §M's "actionable per-record error" applies to the whole
 * store as much as to one record.
 */

import { type SqlDriver, SqlError } from './driver'
import { MIGRATIONS, PRAGMAS, SCHEMA_VERSION } from './schema'

export async function migrate(driver: SqlDriver): Promise<number> {
  // Outside the transaction: `journal_mode` cannot change inside one, and a
  // driver that already applied these (node) re-applies them harmlessly.
  for (const pragma of PRAGMAS) {
    try {
      await driver.execute(pragma)
    } catch {
      // Not every pragma applies to every database (WAL on :memory:). The
      // ones that matter on a device all do.
    }
  }

  const row = await driver.get('pragma user_version')
  const current = Number(row?.['user_version'] ?? 0)

  if (current > SCHEMA_VERSION) {
    throw new SqlError(
      `This phone's records were saved by a newer version of DocFlow (database ${current}, this app ${SCHEMA_VERSION}). ` +
        'Update the app to open them. Nothing has been changed.',
    )
  }

  if (current === SCHEMA_VERSION) return current

  await driver.transaction(async (tx) => {
    for (let step = current; step < SCHEMA_VERSION; step += 1) {
      const statement = MIGRATIONS[step]
      if (statement === undefined) {
        throw new SqlError(`Migration ${step} is missing. The schema cannot be trusted.`)
      }
      // One statement at a time: each migration string holds several, and
      // SQLite runs them in order within this transaction.
      for (const single of splitStatements(statement)) await tx.run(single)
    }
    // A literal, because PRAGMA does not take a bound parameter. The value is
    // a module constant, never user input.
    await tx.run(`pragma user_version = ${SCHEMA_VERSION}`)
  })

  return SCHEMA_VERSION
}

/**
 * Split a migration into statements.
 *
 * `prepare` runs one statement at a time, and a trigger body contains
 * semicolons of its own — so splitting naively on `;` would cut
 * `create trigger ... begin select raise(...); end;` into three fragments,
 * none of them valid. Tracking BEGIN/END depth is the smallest thing that
 * handles the triggers Rule #5 needs without reaching for a SQL parser.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let depth = 0

  for (const line of sql.split('\n')) {
    const bare = line.replace(/--.*$/, '').trim()
    current += line + '\n'

    if (/\bbegin\b\s*$/i.test(bare)) depth += 1
    else if (/^end\s*;$/i.test(bare) && depth > 0) {
      depth -= 1
      if (depth === 0) {
        statements.push(current.trim())
        current = ''
      }
    } else if (depth === 0 && bare.endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }

  if (current.trim() !== '') statements.push(current.trim())
  return statements.filter((statement) => statement !== '')
}
