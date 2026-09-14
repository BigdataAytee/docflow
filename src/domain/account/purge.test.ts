/**
 * Is the purge actually complete? (§S; Apple 5.1.1(v).)
 *
 * `purge_due_accounts` deletes ONE row — the company — and relies on every
 * company-scoped table cascading from it. That is true today and is exactly
 * the kind of truth that stops being true when somebody adds a table in six
 * months, at which point the account "deletion" quietly leaves a table behind
 * and nobody finds out until a regulator or a reviewer does.
 *
 * So the migrations are read rather than trusted: every table with a
 * `company_id` must declare `references public.companies(id) on delete
 * cascade`. A new table without it fails here, in `npm test`, on the commit
 * that adds it.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/**
 * Comments are stripped before anything is matched.
 *
 * Found by mutation: commenting out `delete from auth.users` left the words
 * `delete from auth.users` in the file, and a test that greps the raw text
 * passed on a purge that no longer deletes anything. A check that a COMMENT
 * can satisfy is not a check.
 */
const code = (sql: string): string =>
  sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

function migrations(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: code(readFileSync(join(MIGRATIONS, file), 'utf8')) }))
}

interface Table {
  readonly file: string
  readonly name: string
  readonly body: string
}

function tables(): Table[] {
  const found: Table[] = []
  for (const { file, sql } of migrations()) {
    for (const match of sql.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      found.push({ file, name: match[1] ?? '', body: match[2] ?? '' })
    }
  }
  return found
}

/**
 * The one table whose `company_id` must NOT cascade.
 *
 * `deleted_accounts` is the tombstone: outliving the company is its entire
 * job, and a foreign key to `companies` would delete the record of the
 * deletion at the moment of the deletion. Named here rather than skipped in
 * the loop, so a SECOND exemption has to be argued for in this file instead
 * of being quietly added to a regex.
 */
const OUTLIVES_THE_COMPANY = ['deleted_accounts']

describe('Deleting the company deletes everything the company owns', () => {
  it('exempts exactly one table, and it is the tombstone', () => {
    expect(OUTLIVES_THE_COMPANY).toEqual(['deleted_accounts'])
  })

  it('finds the tables, so a silent regex failure cannot pass this', () => {
    const names = tables().map((table) => table.name)
    expect(names).toContain('documents')
    expect(names).toContain('payments')
    expect(names.length).toBeGreaterThan(15)
  })

  it('cascades from companies on every company-scoped table', () => {
    const scoped = tables().filter(
      (table) => /\bcompany_id\b/.test(table.body) && !OUTLIVES_THE_COMPANY.includes(table.name),
    )
    expect(scoped.length).toBeGreaterThan(15)

    for (const table of scoped) {
      const declaration = table.body
        .split('\n')
        .find((line) => /^\s*company_id\b/.test(line))
      expect(declaration, `${table.name} has no company_id column line`).toBeDefined()
      expect(
        declaration ?? '',
        `${table.name} (${table.file}) does not cascade from companies — ` +
          'purge_due_accounts deletes one row and would leave this table behind',
      ).toMatch(/references public\.companies\(id\) on delete cascade/)
    }
  })

  it('deletes the sign-in as well as the records', () => {
    // 5.1.1(v) is about the ACCOUNT record. A company deleted without its
    // auth users leaves somebody able to sign in to nothing.
    const purge = migrations().find(({ file }) => file.includes('account_deletion'))?.sql ?? ''
    expect(purge).toMatch(/delete from auth\.users/)
    expect(purge).toMatch(/delete from public\.companies/)
  })

  it('keeps the purge away from anything holding a user token', () => {
    const purge = migrations().find(({ file }) => file.includes('account_deletion'))?.sql ?? ''
    expect(purge).toMatch(
      /revoke all on function public\.purge_due_accounts\(\) from public, authenticated, anon/,
    )
    expect(purge).toMatch(/grant execute on function public\.purge_due_accounts\(\) to service_role/)
  })

  it('writes the tombstone before it destroys anything', () => {
    // If the delete fails half way, the record of what was asked for
    // survives. The other order loses it.
    const purge = migrations().find(({ file }) => file.includes('account_deletion'))?.sql ?? ''
    const tombstone = purge.indexOf('insert into public.deleted_accounts')
    const destroy = purge.indexOf('delete from public.companies')
    expect(tombstone).toBeGreaterThan(-1)
    expect(tombstone).toBeLessThan(destroy)
  })

  it('never lets a second request extend the window', () => {
    // Asking to delete every month would otherwise keep an account alive
    // forever by asking to end it.
    const purge = migrations().find(({ file }) => file.includes('account_deletion'))?.sql ?? ''
    expect(purge).toMatch(/on conflict \(company_id\) do update set exported/)
    expect(purge).not.toMatch(/do update set purge_after/)
  })
})
