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
 *   6. auth refuses a run of requests, per endpoint, against the numbers
 *      declared in `src/domain/auth/limits.ts` (§P)
 *
 * CREDENTIALS. This file reads `process.env` and nothing else — it has never
 * parsed a .env itself. `npm run gate:hosted` loads one with node's
 * `--env-file-if-exists=.env`, so BOTH work: exported shell variables, or a
 * gitignored .env, or a mixture. It used to be `gate:hosted` for the first and
 * a separate `gate:hosted:local` for the second, which meant the documented
 * instruction ("put them in .env and run gate:hosted") silently did nothing.
 *
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DB_URL  — the direct Postgres connection string, ONLY for the
 *                      migration apply. PostgREST cannot run DDL, so the anon
 *                      and service-role keys cannot apply migrations: that
 *                      needs the database password (Supabase dashboard →
 *                      Settings → Database → Connection string) or a
 *                      Management API token. Set it and step 1 runs; leave it
 *                      unset and step 1 is reported as skipped rather than
 *                      silently assumed.
 *   SUPABASE_CA_CERT — optional path to Supabase's CA bundle, to verify that
 *                      connection against a pinned root instead of the
 *                      machine's certificate store. See `dbSsl`.
 *   GATE_PART        — `db`, `api`, or unset for both. See `part`.
 *
 * Nothing here prints a key. Failures name the check, not the credential.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'

import {
  APPLIED,
  AUTH_LIMITS,
  type AuthLimit,
  probeAddress,
  probeable,
  runProbe,
} from '../../src/domain/auth/limits.ts'

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

/**
 * The TLS settings for the direct Postgres connection.
 *
 * `undefined` means "whatever the connection string said", which is the point.
 * This used to hardcode `{ rejectUnauthorized: true }`, and while that is the
 * safe default it also made `?sslmode=verify-full&sslrootcert=…` look like it
 * did nothing — the caller could pin a CA in the URL and never find out
 * whether it had been honoured.
 *
 * `SUPABASE_CA_CERT` is the explicit form: a path to Supabase's own CA bundle
 * (dashboard → Settings → Database → SSL configuration). Pinning it stops this
 * connection trusting the machine's certificate store, which on a Windows box
 * running interception software is not a store this key should be trusting.
 *
 * WHAT PINNING DOES NOT DO: make an intercepted connection work. A proxy in
 * the middle presents its OWN certificate, so pinning Supabase's CA turns a
 * vague "self-signed certificate in certificate chain" into a precise refusal.
 * That is the correct outcome. The connection only succeeds again once the
 * interception stops — and trusting the interceptor's root instead would mean
 * handing it the service-role key in plaintext.
 *
 * There is deliberately no way to turn verification off. Every mode except
 * `disable` and `no-verify` verifies fully in pg 8; this never passes either.
 */
export function dbSsl(
  connectionString: string,
): { ca: string; rejectUnauthorized: true } | { rejectUnauthorized: true } | undefined {
  const caPath = process.env.SUPABASE_CA_CERT
  if (caPath !== undefined && caPath !== '') {
    return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true }
  }

  /*
   * THE STRING GOVERNS ONLY IF IT SAYS SOMETHING, and this branch is a fix
   * for a regression introduced when the hardcoded `ssl` object was removed
   * so that `?sslmode=…&sslrootcert=…` could be honoured.
   *
   * `pg` defaults `ssl` to FALSE. A connection string with no `sslmode` —
   * which is exactly what Supabase's dashboard hands you — therefore
   * connected in PLAINTEXT, carrying the database password. The old
   * hardcoded object was hiding that default, and removing it uncovered it.
   *
   * So TLS is the floor. Omitting `sslmode` now means "verify normally",
   * never "do not encrypt", and the only way to say anything else is to say
   * it deliberately in the string.
   */
  return /[?&]sslmode=/i.test(connectionString) ? undefined : { rejectUnauthorized: true }
}

/** Node's names for "somebody is sitting in the middle of this connection". */
const INTERCEPTION = new Set([
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

export function tlsAdvice(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code
  if (code === undefined || !INTERCEPTION.has(code)) return null
  return (
    `${code} — the certificate presented is not Supabase's. Something on this ` +
    'machine is terminating TLS (antivirus or a corporate proxy). Do not work ' +
    'around it: that connection carries the service-role key, and anything ' +
    'able to re-sign it can read the key. Either exempt the host from ' +
    'interception, or run this clause where the chain is clean — ' +
    'GATE_PART=db in CI. The PostgREST clauses below do not use this connection.'
  )
}

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

  const ssl = dbSsl(dbUrl)
  const db = new Client({ connectionString: dbUrl, ...(ssl === undefined ? {} : { ssl }) })
  try {
    await db.connect()
  } catch (error: unknown) {
    /*
     * A FAILURE, NOT AN ABORT, and that distinction is the bug this catch
     * fixes. `main` called this unguarded, so a TLS refusal on the direct
     * Postgres connection killed the whole run — and clauses 3–10 never
     * executed even though they go over HTTPS through a completely different
     * client. Two of Phase 5's three gate clauses were being reported as
     * nothing at all because of a connection they do not use.
     */
    const advice = tlsAdvice(error)
    record(
      '1. migrations applied to the hosted instance',
      'fail',
      advice ?? (error instanceof Error ? error.message : String(error)),
    )
    return false
  }
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
 * §P asks for rate limiting on auth as well as on the public endpoints, and
 * §Q Phase 7 calls the whole item "rate-limit verification".
 *
 * The public endpoints count for themselves (migration 0019). Auth is
 * GoTrue — not our code, with no seam to put a counter in — so the limiter is
 * the provider's and the only honest verification is to ASK IT. The numbers
 * asked about are declared in `src/domain/auth/limits.ts`, with the reasoning
 * for each one; this walks that list and probes what it is safe to probe.
 *
 * Three rules it will not bend:
 *
 *  · It never probes an endpoint that sends mail. A mail-bomb check that
 *    mail-bombs is not a check, and the address in a reset request is chosen
 *    by whoever is asking.
 *  · It signs in as `…@example.com`, reserved by RFC 2606 and therefore
 *    belonging to nobody. No real account can be locked out by this.
 *  · It stops at `PROBE_CEILING`, so a wrong number in the declaration can
 *    never turn the gate into the flood it is checking for.
 *
 * It runs LAST, because it deliberately spends the project's auth budget for
 * a few minutes. A failure here names a SETTING — Dashboard → Authentication
 * → Rate Limits — not a bug in this repository.
 */

async function probeOne(
  url: string,
  anonKey: string,
  limit: AuthLimit,
  unique: string,
): Promise<void> {
  const step = `10. auth throttles ${limit.what.toLowerCase()} (§P)`
  const email = probeAddress(`${unique}${limit.id}`)

  // The loop, the budget and the refusal to probe a mail-sending endpoint all
  // live in the declaration module, where they are unit-tested. What is left
  // here is the one thing a test cannot have: a real request to a real host.
  const verdict = await runProbe(limit, email, unique, async (request) => {
    const response = await fetch(`${url}${request.path}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(request.body),
    })
    return response.status
  })

  if (verdict.kind === 'limited') {
    // Refused at or before the declared allowance is a pass: a project
    // stricter than the declaration is safe, and calling that a failure would
    // push somebody to LOOSEN a real limit to satisfy a test.
    record(
      step,
      'pass',
      `refused after ${verdict.afterRequests} (declared ${limit.allowance} per ${limit.windowSeconds}s)`,
    )
    return
  }

  record(
    step,
    'fail',
    `${verdict.requests} requests, none refused — declared ${limit.allowance} per ${limit.windowSeconds}s; set it in Dashboard → Authentication → Rate Limits`,
  )
}

export interface StepResult {
  readonly step: string
  readonly status: 'pass' | 'fail' | 'skip'
  readonly detail: string
}

/**
 * Exported, and it RETURNS what it recorded.
 *
 * Decision 158 in PLAN.md is a pentest entry point that was written,
 * committed, and never called: twenty tests passed over a program that did
 * nothing. A gate step nothing can drive is the same shape of lie, and this
 * one cannot be driven by CI — there is no project. So it takes its host as
 * an argument and reports back, and `hosted-gate.test.ts` runs it against a
 * stub that answers the way a limiter does.
 */
export async function checkAuthRateLimits(url: string, anonKey: string): Promise<StepResult[]> {
  const before = results.length
  // Opt-in, because probing sign-up leaves users behind that somebody then
  // has to delete. GATE_RESET already means "this is a scratch project".
  const optIn = process.env.GATE_RESET === '1'
  const unique = Date.now().toString(36)

  for (const limit of probeable(optIn)) {
    await probeOne(url, anonKey, limit, unique)
  }

  for (const limit of AUTH_LIMITS.filter((l) => !probeable(optIn).includes(l))) {
    record(
      `10. auth throttles ${limit.what.toLowerCase()} (§P)`,
      'skip',
      // The limit's own reason where it has one: "cannot be seen by a probe"
      // and "would cost somebody something" are different skips, and saying
      // the wrong one sends whoever reads it to the wrong dashboard.
      limit.whyNotProbed ??
        (limit.probeCost === 'sends_email'
          ? 'never probed: it sends mail to whatever address is given'
          : 'set GATE_RESET=1 to probe this on a scratch project — it creates accounts'),
    )
  }

  // The declaration itself is an intention until somebody applies it.
  if (!APPLIED) {
    record(
      '10. the declared auth limits have been applied to a project',
      'skip',
      'src/domain/auth/limits.ts says APPLIED = false — the numbers above are what the project SHOULD have, not what anybody has set',
    )
  }

  return results.slice(before)
}

/**
 * Which half to run (§Q Phase 1, Phase 5).
 *
 * The gate reaches the project two ways, and they fail independently:
 *
 *  · `db`  — a DIRECT Postgres connection for the DDL clauses, which needs the
 *            database password and a TLS chain nothing has rewritten.
 *  · `api` — PostgREST and GoTrue over HTTPS with the anon and service keys,
 *            which is what the app itself speaks.
 *
 * Splitting them is not a convenience. On a machine where interception breaks
 * the Postgres connection, the API clauses are still perfectly testable, and
 * the DDL clauses are still perfectly testable in CI where the chain is clean.
 * Running the halves in different places and reporting both is a complete gate
 * result; refusing to run either because one host is compromised is not.
 */
export type Part = 'db' | 'api' | 'both'

export function part(): Part {
  const value = process.env.GATE_PART
  if (value === 'db' || value === 'api') return value
  return 'both'
}

async function main(): Promise<void> {
  const which = part()
  console.log(
    `DocFlow — Phase 1 gate against the hosted project${which === 'both' ? '' : ` (${which} only)`}\n`,
  )

  if (which !== 'api') await applyMigrationsToHost()
  if (which === 'db') {
    const failedDb = results.filter((r) => r.status === 'fail')
    console.log(`\n${results.length - failedDb.length} passed, ${failedDb.length} failed`)
    if (failedDb.length > 0) process.exitCode = 1
    return
  }

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
  await checkAuthRateLimits(need('VITE_SUPABASE_URL'), need('VITE_SUPABASE_ANON_KEY'))

  const failed = results.filter((r) => r.status === 'fail')
  const skipped = results.filter((r) => r.status === 'skip')
  console.log(
    `\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  )
  if (failed.length > 0) process.exitCode = 1
}

// Only when this file IS the program. Importing it — which is how the auth
// step above is tested — must not seed users into whatever project the
// environment happens to point at.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`\ngate aborted: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
