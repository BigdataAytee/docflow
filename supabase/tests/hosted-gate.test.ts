/**
 * The gate's auth step, driven against a stub (§P, §Q Phase 7).
 *
 * The step itself cannot run in CI: it needs a Supabase project, and there is
 * none. That is exactly the situation decision 158 records — a pentest entry
 * point written, committed, and never called, with twenty tests passing over
 * a program that did nothing. So the step takes its host as an argument, and
 * this points it at an HTTP server that answers the way a rate limiter does.
 *
 * What that proves: the loop stops on a refusal, the report says which
 * endpoint and after how many, a project with no limiter at all is reported
 * as a FAILURE rather than quietly passed — and, the one that matters most,
 * that a mail-sending endpoint is never requested even once.
 */

import { createServer, type Server } from 'node:http'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

import { type StepResult, checkAuthRateLimits, dbSsl, part, tlsAdvice } from './hosted-gate.ts'
import { PROBE_CEILING, probeBudget, probeable } from '../../src/domain/auth/limits.ts'

let server: Server | undefined

/** Answers `400` until `refuseAfter` requests have arrived, then `429`. */
async function stub(refuseAfter: number | null): Promise<{ url: string; seen: string[] }> {
  const seen: string[] = []
  server = createServer((request, response) => {
    seen.push(request.url ?? '')
    const over = refuseAfter !== null && seen.length > refuseAfter
    response.writeHead(over ? 429 : 400, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'nope' }))
  })
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}`, seen }
}

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === undefined) return resolve()
    server.close(() => resolve())
  })
  server = undefined
})

const find = (results: readonly StepResult[], fragment: string): StepResult | undefined =>
  results.find((result) => result.step.includes(fragment))

describe('The auth step verifies a limiter that answers', () => {
  it('passes each endpoint it may probe, and says after how many', async () => {
    const { url } = await stub(3)
    const results = await checkAuthRateLimits(url, 'anon-key')

    const signIn = find(results, 'signing in')
    expect(signIn?.status).toBe('pass')
    expect(signIn?.detail).toMatch(/refused after \d+/)
    // Reset is NOT probed any more: with live SMTP it sends real mail, and
    // against a fake address it proves nothing because Supabase does not
    // send for an account that does not exist. It skips with its own reason.
    const reset = find(results, 'password-reset')
    expect(reset?.status).toBe('skip')
    expect(reset?.detail).toContain('proves nothing')
  })

  it('NEVER sends a request to an endpoint that mails whoever is named', async () => {
    const { url, seen } = await stub(3)
    const results = await checkAuthRateLimits(url, 'anon-key')

    expect(seen.some((path) => path.includes('/otp'))).toBe(false)
    expect(find(results, 'magic links')?.status).toBe('skip')
    expect(find(results, 'magic links')?.detail).toContain('sends mail')
  })

  it('leaves account creation alone unless somebody opts in', async () => {
    const { url, seen } = await stub(3)
    const results = await checkAuthRateLimits(url, 'anon-key')

    expect(seen.some((path) => path.includes('/signup'))).toBe(false)
    expect(find(results, 'creating an account')?.status).toBe('skip')
  })

  it('stops saying the numbers are unapplied once they have been applied', async () => {
    const { url } = await stub(3)
    const results = await checkAuthRateLimits(url, 'anon-key')

    // The row existed only to say the declaration was an intention. They were
    // applied on 2026-09-16, so it is gone — and its ABSENCE is the assertion,
    // because a gate still announcing "not applied" afterwards would be the
    // same untruth pointing the other way.
    expect(find(results, 'have been applied')).toBeUndefined()
  })
})

describe('A project with no limiter at all is a failure, not a silence', () => {
  it('reports the failure and names the setting that fixes it', async () => {
    const { url } = await stub(null)
    const results = await checkAuthRateLimits(url, 'anon-key')

    const signIn = find(results, 'signing in')
    expect(signIn?.status).toBe('fail')
    expect(signIn?.detail).toContain('none refused')
    expect(signIn?.detail).toMatch(/Dashboard → Authentication → Rate Limits/)
  })

  it('gives up rather than becoming the flood it is checking for', async () => {
    const { url, seen } = await stub(null)
    await checkAuthRateLimits(url, 'anon-key')

    /*
     * DERIVED, not a magic multiplier. This used to say `PROBE_CEILING * 3`,
     * meaning "three probeable endpoints" — so adding a fourth limit to the
     * declaration broke a test that was really about the flood ceiling, and
     * the number to change was not obvious from the failure. Summing the real
     * budgets keeps the assertion true as the declaration grows, and still
     * fails the moment a probe stops bounding itself.
     */
    const worstCase = probeable(false).reduce((total, limit) => total + probeBudget(limit), 0)
    expect(seen.length).toBeLessThanOrEqual(worstCase)
    for (const path of new Set(seen)) {
      expect(seen.filter((p) => p === path).length).toBeLessThanOrEqual(PROBE_CEILING)
    }
  })
})

describe('TLS on the direct Postgres connection (§P)', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  /**
   * The connection carries the service-role key. Anything able to re-sign it
   * can read the key, so there is no route through this file that turns
   * verification off — not a flag, not an env var, not a fallback.
   */
  it('offers no way to disable certificate verification', () => {
    // From the working directory, not from `import.meta.url`: this file now
    // runs under BOTH configs, and Vite's serves modules over http — so a
    // URL-relative read throws "must be of scheme file" in the very suite
    // this was moved into to be watched by.
    const source = readFileSync(join(process.cwd(), 'supabase', 'tests', 'hosted-gate.ts'), 'utf8')
    expect(source).not.toMatch(/rejectUnauthorized:\s*false/)
    expect(source).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/)
    expect(source).not.toMatch(/sslmode=(no-verify|disable)/)
  })

  it('leaves the connection string in charge when it declares a mode', () => {
    delete process.env.SUPABASE_CA_CERT
    // `undefined` means "do not override" — so `?sslrootcert=` is honoured
    // rather than being silently outranked by a hardcoded object.
    expect(dbSsl('postgresql://u:p@h:5432/postgres?sslmode=verify-full')).toBeUndefined()
    expect(dbSsl('postgresql://u:p@h:5432/postgres?ssl=true&sslmode=require')).toBeUndefined()
  })

  /**
   * THE REGRESSION THIS EXISTS FOR. `pg` defaults `ssl` to FALSE, and the
   * connection string Supabase's dashboard hands you carries no `sslmode` —
   * so removing the hardcoded object to honour `sslrootcert` uncovered a
   * PLAINTEXT connection carrying the database password. TLS is the floor:
   * saying nothing means verify, never means do not encrypt.
   */
  it('requires TLS when the string says nothing at all', () => {
    delete process.env.SUPABASE_CA_CERT
    const ssl = dbSsl('postgresql://u:p@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')
    expect(ssl).toEqual({ rejectUnauthorized: true })
  })

  it('never resolves to a connection with TLS off', () => {
    delete process.env.SUPABASE_CA_CERT
    for (const url of [
      'postgresql://u:p@h:6543/postgres',
      'postgresql://u:p@h:5432/postgres?application_name=gate',
    ]) {
      expect(dbSsl(url), url).not.toBe(false)
      expect(dbSsl(url), url).toBeTruthy()
    }
  })

  it('pins the CA when one is given, and still verifies', () => {
    const path = join(tmpdir(), `docflow-ca-${Date.now()}.crt`)
    writeFileSync(path, '-----BEGIN CERTIFICATE-----\nnot a real one\n-----END CERTIFICATE-----\n')
    process.env.SUPABASE_CA_CERT = path

    // A pinned CA outranks whatever the string says, including a string that
    // declares its own mode: the operator chose this root deliberately.
    const ssl = dbSsl('postgresql://u:p@h:6543/postgres?sslmode=require')
    expect(ssl).toHaveProperty('ca')
    expect((ssl as { ca: string }).ca).toContain('BEGIN CERTIFICATE')
    expect(ssl?.rejectUnauthorized).toBe(true)
    rmSync(path, { force: true })
  })

  /**
   * An intercepted chain must produce the actionable message, not a bare
   * OpenSSL code — and must NOT be mistaken for an ordinary outage, because
   * the two have completely different answers.
   */
  it.each([
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ])('names interception for %s, and says not to work around it', (code) => {
    const advice = tlsAdvice(Object.assign(new Error('x'), { code }))
    expect(advice).toContain(code)
    expect(advice).toMatch(/database password/)
    expect(advice).toMatch(/SUPABASE_CA_CERT/)
  })

  it('says nothing about interception for an ordinary failure', () => {
    expect(tlsAdvice(Object.assign(new Error('down'), { code: 'ECONNREFUSED' }))).toBeNull()
    expect(tlsAdvice(new Error('no code at all'))).toBeNull()
  })
})

describe('The gate runs in halves (§Q Phase 1, Phase 5)', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('runs both by default', () => {
    delete process.env.GATE_PART
    expect(part()).toBe('both')
  })

  it.each(['db', 'api'])('runs only the %s half when asked', (value) => {
    process.env.GATE_PART = value
    expect(part()).toBe(value)
  })

  /** An unknown value must not quietly skip clauses nobody meant to skip. */
  it('treats anything else as both rather than as nothing', () => {
    process.env.GATE_PART = 'DB'
    expect(part()).toBe('both')
  })
})
