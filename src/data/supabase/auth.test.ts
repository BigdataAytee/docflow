/**
 * Auth rules that hold without a network (§M, §Q Phase 1). The parts that need
 * a live instance — real sign-in, Google OAuth, ≥30-day sessions — are in
 * supabase/tests/hosted-gate.ts and run against the project.
 */

import { describe, expect, it } from 'vitest'

import {
  type AuthError,
  type AuthState,
  canSync,
  canUseApp,
  createAuthService,
  mayDeleteLocalData,
  providerRefusal,
} from './auth'
import { classifyAuthFailure } from '../../features/auth/refusal'
import { SupabaseConfigError, createBrowserClient, isServiceRoleKey, readConfig } from './client'

const user = { id: 'u1' } as never

const states: AuthState[] = [
  { kind: 'authenticated', user, session: { user } as never },
  { kind: 'stale', user, reason: 'offline' },
  { kind: 'stale', user, reason: 'refresh_failed' },
  { kind: 'signed_out' },
]

describe('Expired credentials pause sync, never delete local work (§M)', () => {
  it('allows sync only with a proven session', () => {
    expect(states.map(canSync)).toEqual([true, false, false, false])
  })

  it('keeps the app usable on a stale session — offline is the product (Rule #3)', () => {
    expect(states.map(canUseApp)).toEqual([true, true, true, false])
  })

  it('never authorises deleting local data, in any state', () => {
    // §M: deleting local data is a separate explicit action. No auth state,
    // including signed_out, is a reason to discard what the user typed.
    for (const state of states) expect(mayDeleteLocalData(state)).toBe(false)
  })
})

describe('A service-role key must never reach the browser', () => {
  const SERVICE_ROLE =
    'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.sig'
  const ANON =
    'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.sig'

  it('recognises one by its claims', () => {
    expect(isServiceRoleKey(SERVICE_ROLE)).toBe(true)
    expect(isServiceRoleKey(ANON)).toBe(false)
    expect(isServiceRoleKey('not-a-jwt')).toBe(false)
  })

  it('refuses to build a browser client with one', () => {
    // It holds BYPASSRLS: a mis-paste here would ship cross-company read and
    // write to every browser, and RLS would never notice (TODO(Phase 7)).
    expect(() =>
      createBrowserClient({ url: 'https://example.supabase.co', anonKey: SERVICE_ROLE }),
    ).toThrow(SupabaseConfigError)
  })

  it('builds a client with an anon key', () => {
    // Constructing for real, not mocking: supabase-js initialises Realtime
    // eagerly and needs a native WebSocket, which is why the toolchain is
    // pinned to Node 22+ (CI caught this on 20).
    expect(() =>
      createBrowserClient({ url: 'https://example.supabase.co', anonKey: ANON }),
    ).not.toThrow()
  })
})

describe('Config comes from the gitignored .env', () => {
  it('names both variables when either is missing', () => {
    expect(() => readConfig({})).toThrow(SupabaseConfigError)
    expect(() => readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(
      SupabaseConfigError,
    )
    expect(() => readConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })).toThrow(
      SupabaseConfigError,
    )
  })

  it('reads both when present', () => {
    expect(
      readConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'k' })
  })
})

/**
 * The signals survive the throw.
 *
 * `throw new AuthError(error.message)` kept the one field the classifier is
 * documented not to trust and dropped the two it is documented to trust
 * first. Nothing downstream could tell a 429 from a 400 — every refusal
 * arrived as a sentence of English.
 */
describe('A refusal carries what the provider said (§P, §S)', () => {
  it('keeps the status and the named code, not just the prose', async () => {
    const error = providerRefusal({
      status: 429,
      code: 'over_request_rate_limit',
      message: 'Request rate limit reached',
      retryAfter: 42,
    })
    expect(error.status).toBe(429)
    expect(error.code).toBe('over_request_rate_limit')
    expect(error.retryAfter).toBe(42)
  })

  /**
   * GoTrue's raw body puts the HTTP status in `code` and the name in
   * `error_code`. Taking `code` on trust yields the number 400 where a name
   * was expected, so both are read.
   */
  it('reads a raw GoTrue body without mistaking 400 for a name', () => {
    const error = providerRefusal({
      code: 400,
      error_code: 'invalid_credentials',
      msg: 'Invalid login credentials',
    })
    expect(error.status).toBe(400)
    expect(error.code).toBe('invalid_credentials')
    expect(error.message).toBe('Invalid login credentials')
  })

  /**
   * THROUGH THE SERVICE, not through the helper.
   *
   * The first version of this block tested `providerRefusal` on its own and
   * passed while `signInWithPassword` still threw `new AuthError(error.message)`
   * two lines away — the mutation went green, which is the whole reason
   * CLAUDE.md says a fixture proves nothing until the defect has been put
   * back. These drive the real call and assert on what a caller catches.
   */
  it.each([
    ['signInWithPassword', (a: ReturnType<typeof createAuthService>) => a.signInWithPassword('e@x.co', 'p')],
    ['signUpWithPassword', (a: ReturnType<typeof createAuthService>) => a.signUpWithPassword('e@x.co', 'p')],
    ['sendPasswordReset', (a: ReturnType<typeof createAuthService>) => a.sendPasswordReset('e@x.co', '/')],
  ])('%s throws a refusal that still has its status and code', async (_name, call) => {
    const refusal = {
      status: 400,
      code: 'email_not_confirmed',
      message: 'Email not confirmed',
    }
    const auth = createAuthService(
      {
        auth: {
          signInWithPassword: async () => ({ data: {}, error: refusal }),
          signUp: async () => ({ data: {}, error: refusal }),
          resetPasswordForEmail: async () => ({ data: {}, error: refusal }),
        },
      } as never,
      () => null,
    )

    const caught = await call(auth).then(
      () => null,
      (error: unknown) => error as AuthError,
    )

    expect(caught?.status, 'the status was dropped on the way out').toBe(400)
    expect(caught?.code, 'the provider code was dropped on the way out').toBe('email_not_confirmed')
    // And the thing a person actually reads follows from it.
    expect(classifyAuthFailure(caught).kind).toBe('email_unconfirmed')
  })

  it('still classifies correctly once thrown and caught', () => {
    const error = providerRefusal({
      status: 400,
      code: 'email_not_confirmed',
      message: 'Email not confirmed',
    })
    expect(classifyAuthFailure(error).kind).toBe('email_unconfirmed')
  })
})
