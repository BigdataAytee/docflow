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
import { type AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

import { type StepResult, checkAuthRateLimits } from './hosted-gate.ts'
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
