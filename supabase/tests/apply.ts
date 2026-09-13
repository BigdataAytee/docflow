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
  // Start from nothing every run. CI gets a fresh container anyway, but a
  // developer re-running against a local Postgres would otherwise collide with
  // the previous run's seed — and a suite you have to hand-reset is a suite
  // people stop running.
  await client.query('drop schema if exists public cascade')
  await client.query('create schema public')

  await client.query(readFileSync(BOOTSTRAP, 'utf8'))
  for (const file of migrationFiles()) {
    await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
}

export const connectionString = (): string =>
  process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/postgres'

/**
 * The claims a REAL Supabase access token carries.
 *
 * This shape is not a detail. The harness used to hand the policies a flat
 * `{ "company_id": ... }` object, which Supabase has never issued: custom
 * claims arrive NESTED under `app_metadata`. Every RLS test passed against a
 * claims shape that does not exist, while in production `current_company_id()`
 * returned NULL and every policy denied everything.
 *
 * So this mirrors a token as Supabase issues it, field for field. If it ever
 * drifts from the real thing again, the tests go back to proving nothing.
 */
export function supabaseClaims(companyId: string, userId?: string): string {
  return JSON.stringify({
    sub: userId ?? '99999999-9999-9999-9999-999999999999',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'], company_id: companyId },
    user_metadata: {},
  })
}

/** The flat shape an edge function sets on its own connection. */
export const flatClaims = (companyId: string): string =>
  JSON.stringify({ company_id: companyId, role: 'authenticated' })

/** Run a query as a signed-in user of `companyId`, the way PostgREST does. */
export async function asCompany<T>(
  client: Client,
  companyId: string | null,
  run: () => Promise<T>,
  claims: (companyId: string) => string = supabaseClaims,
): Promise<T> {
  await client.query('begin')
  try {
    await client.query('set local role authenticated')
    await client.query(
      companyId === null
        ? `select set_config('request.jwt.claims', '', true)`
        : `select set_config('request.jwt.claims', $1, true)`,
      companyId === null ? [] : [claims(companyId)],
    )
    return await run()
  } finally {
    await client.query('rollback')
  }
}
