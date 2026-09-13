/**
 * Which backend a build runs on (§R).
 *
 * The rule under test is one line of §R — "a local demo is never passed off as
 * an account" — and it decides more than it looks like it does.
 */

import { describe, expect, it } from 'vitest'

import { createBackend, isConfigured } from './backend'
import { createMemoryRepositories } from './repositories'
import { emptyState } from './repositories'

const demo = () => ({ companyId: 'co_demo', repositories: createMemoryRepositories(emptyState()) })

// A JWT-shaped anon key. `createBrowserClient` refuses a service-role one, and
// that refusal is what must not be softened into a demo.
const jwt = (payload: object) =>
  `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify(payload))}.sig`

const ANON = jwt({ role: 'anon' })
const SERVICE = jwt({ role: 'service_role' })

describe('Configuration, and only configuration, chooses the backend', () => {
  it('runs the demo when no project is configured', () => {
    const backend = createBackend({}, demo)
    expect(backend.kind).toBe('demo')
  })

  it('runs on the account when one is', () => {
    const backend = createBackend(
      { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: ANON },
      demo,
    )
    expect(backend.kind).toBe('account')
  })

  it('treats half a configuration as none, rather than as a broken account', () => {
    for (const env of [
      { VITE_SUPABASE_URL: 'https://project.supabase.co' },
      { VITE_SUPABASE_ANON_KEY: ANON },
      { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: ANON },
      { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: '' },
    ]) {
      expect(isConfigured(env), JSON.stringify(env)).toBe(false)
    }
  })
})

describe('A broken account is never softened into a demo (§R)', () => {
  it('throws rather than falling back when the anon key is a service-role key', () => {
    // It would ship BYPASSRLS to every browser. Falling back to the demo would
    // hide a total compromise behind a working-looking app.
    expect(() =>
      createBackend(
        { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: SERVICE },
        demo,
      ),
    ).toThrow(/service-role/i)
  })

  it('never calls the demo seed on an account build', () => {
    let seeded = false
    createBackend(
      { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: ANON },
      () => {
        seeded = true
        return demo()
      },
    )
    // Sample records must not exist in an account build at all — §R: the
    // prototype's seeded money never enters a real account.
    expect(seeded).toBe(false)
  })
})

describe('What each backend hands over', () => {
  it('gives the demo a company id, because nobody signs in', () => {
    const backend = createBackend({}, demo)
    expect(backend.kind === 'demo' && backend.companyId).toBe('co_demo')
  })

  it('gives the account a session instead, because the company is not known yet', () => {
    const backend = createBackend(
      { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: ANON },
      demo,
    )
    expect(backend.kind === 'account' && typeof backend.session.current).toBe('function')
    // No company id on this branch at all: there is nothing truthful to put
    // there until somebody signs in.
    expect('companyId' in backend).toBe(false)
  })

  it('hands over all ten repositories either way', () => {
    for (const backend of [
      createBackend({}, demo),
      createBackend(
        { VITE_SUPABASE_URL: 'https://project.supabase.co', VITE_SUPABASE_ANON_KEY: ANON },
        demo,
      ),
    ]) {
      expect(Object.keys(backend.repositories).sort()).toEqual([
        'assets',
        'companies',
        'credits',
        'customers',
        'documents',
        'expenses',
        'items',
        'linkTokens',
        'payments',
        'shares',
      ])
    }
  })
})
