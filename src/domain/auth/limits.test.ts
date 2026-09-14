/**
 * The auth-limit declaration, checked for the things that make it safe to act
 * on (§P, §Q Phase 7).
 *
 * These are not tests of GoTrue — nothing here can reach it. They are tests
 * of the rows the gate probes FROM, and of the two decisions in this file
 * that could do real damage if they were wrong: which endpoints may be
 * probed, and how many times.
 */

import { describe, expect, it } from 'vitest'

import {
  APPLIED,
  AUTH_LIMITS,
  PROBE_CEILING,
  type ProbeRequest,
  limitFor,
  probeAddress,
  probeBudget,
  probeRequest,
  probeable,
  runProbe,
  verdictOf,
} from './limits'

describe('The declaration is honest about itself (§X)', () => {
  it('says it is not applied anywhere', () => {
    // The moment this is true, something has to have been run against a real
    // project — and the gate is the only thing that can say so.
    expect(APPLIED).toBe(false)
  })

  it('gives every limit a reason somebody could argue with', () => {
    for (const limit of AUTH_LIMITS) {
      expect(limit.why.length, `${limit.id} has no reasoning`).toBeGreaterThan(40)
      expect(limit.what).not.toBe('')
      expect(limit.allowance).toBeGreaterThan(0)
      expect(limit.windowSeconds).toBeGreaterThan(0)
    }
  })

  it('keeps the ids unique, because the gate reports by id', () => {
    expect(new Set(AUTH_LIMITS.map((l) => l.id)).size).toBe(AUTH_LIMITS.length)
    expect(limitFor('sign_in')?.endpoint).toContain('grant_type=password')
    expect(limitFor('nothing')).toBeUndefined()
  })

  it('leaves refresh far above everything a person does', () => {
    // §M: a credential problem never costs somebody their work. A tight
    // refresh limit is an outage we caused ourselves.
    const refresh = limitFor('token_refresh')
    const signIn = limitFor('sign_in')
    expect(refresh?.allowance ?? 0).toBeGreaterThan((signIn?.allowance ?? 0) * 10)
  })
})

describe('A probe can never cost anybody anything (§P)', () => {
  it('never probes an endpoint that sends mail', () => {
    // A mail-bomb check that mail-bombs is not a check.
    for (const optIn of [false, true]) {
      expect(probeable(optIn).map((l) => l.probeCost)).not.toContain('sends_email')
    }
  })

  it('probes account creation only when somebody asks for it', () => {
    expect(probeable(false).map((l) => l.id)).not.toContain('sign_up')
    expect(probeable(true).map((l) => l.id)).toContain('sign_up')
  })

  it('never signs in as an address that could belong to a person', () => {
    // RFC 2606 reserves example.com: it cannot be registered, so a probe can
    // neither lock anybody out nor send mail anywhere real.
    expect(probeAddress('abc123')).toMatch(/@example\.com$/)
    expect(probeAddress('Mixed Case!')).toBe('docflow-gate-mixedcase@example.com')
  })

  it('stops well short of being the flood it is checking for', () => {
    for (const limit of AUTH_LIMITS) {
      expect(probeBudget(limit)).toBeLessThanOrEqual(PROBE_CEILING)
      // Still enough to reach the request that should be refused.
      expect(probeBudget(limit)).toBeGreaterThan(Math.min(limit.allowance, PROBE_CEILING - 1))
    }
  })

  it('caps the refresh probe at the ceiling rather than at its allowance', () => {
    // 1800 requests to prove a limit nobody wants to hit would BE the attack.
    expect(probeBudget(limitFor('token_refresh')!)).toBe(PROBE_CEILING)
  })
})

describe('What a run of probes proved', () => {
  it('reads a refusal as the limit working, and says when it came', () => {
    expect(verdictOf([200, 400, 400, 429])).toEqual({ kind: 'limited', afterRequests: 4 })
  })

  it('reads no refusal at all as the failure it is', () => {
    expect(verdictOf([400, 400, 400])).toEqual({ kind: 'not_limited', requests: 3 })
  })

  it('counts a project STRICTER than this file as a pass', () => {
    // Refused sooner than declared is safe. Calling it a failure would push
    // somebody to loosen a real limit to satisfy a test.
    expect(verdictOf([429]).kind).toBe('limited')
  })
})

describe('The probe asks the way a real caller would, and then stops', () => {
  const email = probeAddress('gate')

  it('asks each endpoint at its own path, with a body it will accept', () => {
    expect(probeRequest(limitFor('sign_in')!, email, 'u').path).toContain('grant_type=password')
    expect(probeRequest(limitFor('password_reset')!, email, 'u')).toEqual({
      path: '/auth/v1/recover',
      body: { email },
    })
    expect(probeRequest(limitFor('token_refresh')!, email, 'u').body).toHaveProperty(
      'refresh_token',
    )
    // Well-formed and WRONG. A body rejected before the limiter counts it
    // proves nothing about the limiter.
    expect(probeRequest(limitFor('sign_in')!, email, 'u').body).toMatchObject({
      email,
      password: 'not-the-password',
    })
  })

  it('stops the moment it is refused', async () => {
    const sent: ProbeRequest[] = []
    const verdict = await runProbe(limitFor('sign_in')!, email, 'u', async (request) => {
      sent.push(request)
      return sent.length < 4 ? 400 : 429
    })
    expect(verdict).toEqual({ kind: 'limited', afterRequests: 4 })
    expect(sent).toHaveLength(4)
  })

  it('gives up at the budget rather than hammering forever', async () => {
    let calls = 0
    const limit = limitFor('sign_in')!
    const verdict = await runProbe(limit, email, 'u', async () => {
      calls += 1
      return 400
    })
    expect(calls).toBe(probeBudget(limit))
    expect(verdict).toEqual({ kind: 'not_limited', requests: probeBudget(limit) })
  })

  it('can never become the flood it is checking for', async () => {
    // Every endpoint, worst case, with the limiter answering nothing.
    for (const limit of AUTH_LIMITS.filter((l) => l.probeCost !== 'sends_email')) {
      let calls = 0
      await runProbe(limit, email, 'u', async () => {
        calls += 1
        return 400
      })
      expect(calls, `${limit.id} sent ${calls} requests`).toBeLessThanOrEqual(PROBE_CEILING)
    }
  })

  it('refuses to probe a mail-sending endpoint even when handed one', async () => {
    // `probeable` filters these out already. This is the second lock, because
    // "we only ever call it with the right list" is how the wrong list gets
    // passed one day.
    let calls = 0
    await expect(
      runProbe(limitFor('otp')!, email, 'u', async () => {
        calls += 1
        return 429
      }),
    ).rejects.toThrow(/never probed/)
    expect(calls).toBe(0)
  })
})
