/**
 * Auth rules that hold without a network (§M, §Q Phase 1). The parts that need
 * a live instance — real sign-in, Google OAuth, ≥30-day sessions — are in
 * supabase/tests/hosted-gate.ts and run against the project.
 */

import { describe, expect, it } from 'vitest'

import { type AuthState, canSync, canUseApp, mayDeleteLocalData } from './auth'
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
