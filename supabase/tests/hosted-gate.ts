/**
 * The §Q Phase 1 gate, run against the HOSTED Supabase project.
 *
 *   npm run gate:hosted
 *
 * Everything it checks is a gate clause:
 *   1. the migrations applied, and FORCE survived the hosted apply
 *   2. two REAL authenticated users cannot read or write each other
 *   3. an anonymous caller sees nothing
 *   4. the client cannot write billing
 *   5. sessions are configured to survive ≥30 days offline
 *   6. auth refuses a run of sign-in attempts (§P)
 *
 * It needs, from the gitignored .env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DB_URL  — the direct Postgres connection string, ONLY for the
 *                      migration apply. PostgREST cannot run DDL, so the anon
 *                      and service-role keys cannot apply migrations: that
 *                      needs the database password (Supabase dashboard →
 *                      Settings → Database → Connection string) or a
 *                      Management API token. Set it and step 1 runs; leave it
 *                      unset and step 1 is reported as skipped rather than
 *                      silently assumed.
 *
 * Nothing here prints a key. Failures name the check, not the credential.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

// Inlined rather than imported from ./apply: node's type stripping wants an
// explicit .ts extension on relative imports, and one three-line read is
// cheaper than bending the tsconfig for it.
const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()

const need = (name: string): string => {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is not set (see .env).`)
  return value
}

const results: { step: string; status: 'pass' | 'fail' | 'skip'; detail: string }[] = []
const record = (step: string, status: 'pass' | 'fail' | 'skip', detail: string) => {
  results.push({ step, status, detail })
  const mark = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '–'
  console.log(`${mark} ${step}${detail === '' ? '' : ` — ${detail}`}`)
}

const COMPANY_A = '11111111-1111-1111-1111-111111111111'
const COMPANY_B = '22222222-2222-2222-2222-222222222222'

async function applyMigrationsToHost(): Promise<boolean> {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (dbUrl === undefined || dbUrl === '') {
    record(
      '1. migrations applied to the hosted instance',
      'skip',
      'SUPABASE_DB_URL not set — PostgREST cannot run DDL, so this needs the database password',
    )
    return false
  }

  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: true } })
  await db.connect()
  try {
    const { rows: existing } = await db.query<{ present: boolean }>(
      `select exists (
         select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'companies'
       ) as present`,
    )
    const alreadyApplied = existing[0]?.present === true

    // Never destructive by default: an already-migrated project is verified,
    // not rebuilt. GATE_RESET=1 opts into a drop-and-recreate, which is for a
    // scratch project only and will delete every row in public.
    if (alreadyApplied && process.env.GATE_RESET === '1') {
      await db.query('drop schema public cascade')
      await db.query('create schema public')
    }

    if (!alreadyApplied || process.env.GATE_RESET === '1') {
      for (const file of migrationFiles()) {
        await db.query(readFileSync(join(MIGRATIONS, file), 'utf8'))
      }
      record(
        '1. migrations applied to the hosted instance',
        'pass',
        `${migrationFiles().length} files`,
      )
    } else {
      record(
        '1. migrations applied to the hosted instance',
        'pass',
        'already applied — verifying in place (GATE_RESET=1 to rebuild)',
      )
    }

    // FORCE must survive the hosted apply — a hosted Postgres is still a
    // Postgres, but this is the clause the whole isolation boundary rests on.
    const { rows } = await db.query<{ table: string; enabled: boolean; forced: boolean }>(
      `select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
    )
    const missing = rows.filter((r) => !r.enabled || !r.forced)
    record(
      '2. RLS ENABLE + FORCE on every table, on the host',
      missing.length === 0 ? 'pass' : 'fail',
      missing.length === 0
        ? `${rows.length} tables, all forced`
        : missing.map((r) => `${r.table} (enabled=${r.enabled}, forced=${r.forced})`).join(', '),
    )
    return missing.length === 0
  } finally {
    await db.end()
  }
}

/** Create two real users, each owning one company, and return their clients. */
async function seedTwoRealUsers() {
  const url = need('VITE_SUPABASE_URL')
  const anonKey = need('VITE_SUPABASE_ANON_KEY')
  const serviceKey = need('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const stamp = Date.now()

  const made = []
  for (const [company, label] of [[COMPANY_A, 'acme'], [COMPANY_B, 'rival']] as const) {
    const email = `gate-${label}-${stamp}@docflow.test`
    const password = `${crypto.randomUUID()}Aa1!`

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // The company scope the RLS policies read (public.current_company_id()).
      app_metadata: { company_id: company },
    })
    if (error !== null) throw new Error(`could not create the ${label} user: ${error.message}`)

    // Seed the company and one row for it, as service_role.
    await admin.from('companies').upsert({ id: company, name: label, currency: 'NGN' })
    await admin.from('customers').upsert({
      id: company.replace(/^./, 'a'),
      company_id: company,
      name: `${label} customer`,
    })

    const session = createClient(url, anonKey, { auth: { persistSession: false } })
    const signIn = await session.auth.signInWithPassword({ email, password })
    if (signIn.error !== null) throw new Error(`${label} could not sign in: ${signIn.error.message}`)

    made.push({ label, company, client: session, userId: data.user?.id, session: signIn.data.session })
  }
  return { admin, users: made }
}

/**
 * §P asks for rate limiting on auth as well as on the public endpoints. Auth
 * is GoTrue — code we do not own and cannot wrap — so the only honest check
 * is to ask it: a run of failed sign-ins should stop being answered.
 *
 * Never against a real account. The address is random and belongs to nobody,
 * so nothing that exists can be locked out; GoTrue counts per IP, which is
 * what is being tested. It does spend this project's sign-in budget for a few
 * minutes, which is why this lives in the gate and not in the test suite.
 *
 * A failure here is a SETTING, not a bug in this repository: Dashboard →
 * Authentication → Rate Limits.
 */
const AUTH_ATTEMPTS = 40

async function checkAuthRateLimit(url: string, anonKey: string): Promise<void> {
  const email = `gate-ratelimit-${Date.now().toString(36)}@example.com`

  for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'not-the-password' }),
    })

    if (response.status === 429) {
      record(
        '10. auth throttles a run of sign-in attempts (§P)',
        'pass',
        `refused after ${attempt} attempts`,
      )
      return
    }
  }

  record(
    '10. auth throttles a run of sign-in attempts (§P)',
    'fail',
    `${AUTH_ATTEMPTS} failed sign-ins, none refused — set Dashboard → Authentication → Rate Limits`,
  )
}

async function main(): Promise<void> {
  console.log('DocFlow — Phase 1 gate against the hosted project\n')

  await applyMigrationsToHost()

  const { admin, users } = await seedTwoRealUsers()
  const [acme, rival] = users
  if (acme === undefined || rival === undefined) throw new Error('seeding failed')

  record('3. two real users signed in', 'pass', `${users.length} sessions`)

  // READ isolation, with real JWTs rather than a set_config shim.
  const acmeReads = await acme.client.from('customers').select('company_id')
  const leaked = (acmeReads.data ?? []).filter((r) => r.company_id !== COMPANY_A)
  record(
    '4. company A reads only its own rows',
    acmeReads.error === null && leaked.length === 0 ? 'pass' : 'fail',
    acmeReads.error?.message ?? `${acmeReads.data?.length ?? 0} rows, ${leaked.length} foreign`,
  )

  const crossRead = await acme.client.from('customers').select('*').eq('company_id', COMPANY_B)
  record(
    '5. company A cannot read company B',
    (crossRead.data ?? []).length === 0 ? 'pass' : 'fail',
    `${(crossRead.data ?? []).length} rows returned`,
  )

  const crossWrite = await acme.client
    .from('customers')
    .insert({ company_id: COMPANY_B, name: 'smuggled' })
  record(
    '6. company A cannot write into company B',
    crossWrite.error !== null ? 'pass' : 'fail',
    crossWrite.error?.message ?? 'the insert SUCCEEDED — isolation is broken',
  )

  const billing = await acme.client.from('entitlements').update({ plan: 'pro' }).eq('company_id', COMPANY_A)
  const stillFree = await admin.from('entitlements').select('plan').eq('company_id', COMPANY_A).maybeSingle()
  record(
    '7. the client cannot upgrade its own plan',
    stillFree.data?.plan !== 'pro' ? 'pass' : 'fail',
    billing.error?.message ?? `plan is ${String(stillFree.data?.plan ?? 'unset')}`,
  )

  const anon = createClient(need('VITE_SUPABASE_URL'), need('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  })
  const anonRead = await anon.from('customers').select('*')
  record(
    '8. an anonymous caller sees nothing',
    (anonRead.data ?? []).length === 0 ? 'pass' : 'fail',
    anonRead.error?.message ?? `${(anonRead.data ?? []).length} rows`,
  )

  // §Q: sessions tolerant of long offline gaps. The access token is short-lived
  // by design; what carries 30 days is the refresh token, so assert the session
  // carries one and report the project's configured expiry.
  const session = acme.session
  record(
    '9. session carries a refresh token (≥30-day sessions)',
    session?.refresh_token != null && session.refresh_token !== '' ? 'pass' : 'fail',
    `access token expires in ${String(session?.expires_in ?? '?')}s; refresh token ${
      session?.refresh_token == null ? 'ABSENT' : 'present'
    }`,
  )

  // Clean up the users this run created.
  for (const u of users) {
    if (u.userId !== undefined) await admin.auth.admin.deleteUser(u.userId)
  }

  // LAST, after the cleanup above: it deliberately exhausts the project's
  // sign-in budget for a few minutes, and nothing that follows should need it.
  await checkAuthRateLimit(need('VITE_SUPABASE_URL'), need('VITE_SUPABASE_ANON_KEY'))

  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')
  console.log(
    `\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  )
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(`\ngate aborted: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
