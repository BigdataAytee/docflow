/**
 * Applies the migrations to a bare Postgres, in filename order, exactly as
 * they would be applied to a Supabase project — no edits, no shims beyond the
 * roles in bootstrap.sql that a hosted project already provides.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')
const BOOTSTRAP = join(import.meta.dirname, 'bootstrap.sql')

export const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

export async function applyMigrations(client: Client): Promise<void> {
  await client.query(readFileSync(BOOTSTRAP, 'utf8'))
  for (const file of migrationFiles()) {
    await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
}

export const connectionString = (): string =>
  process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/postgres'

/** Run a query as a signed-in user of `companyId`, the way PostgREST does. */
export async function asCompany<T>(
  client: Client,
  companyId: string | null,
  run: () => Promise<T>,
): Promise<T> {
  await client.query('begin')
  try {
    await client.query('set local role authenticated')
    await client.query(
      companyId === null
        ? `select set_config('request.jwt.claims', '', true)`
        : `select set_config('request.jwt.claims', $1, true)`,
      companyId === null ? [] : [JSON.stringify({ company_id: companyId, role: 'authenticated' })],
    )
    return await run()
  } finally {
    await client.query('rollback')
  }
}
