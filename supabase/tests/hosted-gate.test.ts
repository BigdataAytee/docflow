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
import { PROBE_CEILING } from '../../src/domain/auth/limits.ts'

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
    expect(find(results, 'password-reset')?.status).toBe('pass')
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

  it('says out loud that the numbers have not been applied anywhere', async () => {
    const { url } = await stub(3)
    const results = await checkAuthRateLimits(url, 'anon-key')

    const applied = find(results, 'have been applied')
    expect(applied?.status).toBe('skip')
    expect(applied?.detail).toContain('APPLIED = false')
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

    // Every probeable endpoint, worst case, against a host that never refuses.
    expect(seen.length).toBeLessThanOrEqual(PROBE_CEILING * 3)
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
    const source = readFileSync(new URL('./hosted-gate.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/rejectUnauthorized:\s*false/)
    expect(source).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/)
    expect(source).not.toMatch(/sslmode=(no-verify|disable)/)
  })

  it('leaves the connection string in charge when no CA is pinned', () => {
    delete process.env.SUPABASE_CA_CERT
    // `undefined`, not `{ rejectUnauthorized: true }` — the hardcoded object
    // silently outranked nothing, but it made `?sslrootcert=` look inert.
    expect(dbSsl()).toBeUndefined()
  })

  it('pins the CA when one is given, and still verifies', () => {
    const path = join(tmpdir(), `docflow-ca-${Date.now()}.crt`)
    writeFileSync(path, '-----BEGIN CERTIFICATE-----\nnot a real one\n-----END CERTIFICATE-----\n')
    process.env.SUPABASE_CA_CERT = path

    const ssl = dbSsl()
    expect(ssl?.ca).toContain('BEGIN CERTIFICATE')
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
    expect(advice).toMatch(/service-role key/)
    expect(advice).toMatch(/GATE_PART=db/)
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
