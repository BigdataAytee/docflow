/**
 * The two paths the composition root can take (§R).
 *
 * Everything else renders `App` with repositories injected, which is the right
 * shape for a screen test and skips this entirely. What is only exercised here
 * is what `main.tsx` actually does: hand over a LOADER and let the app resolve
 * it — including the demo path that `npm run dev` runs on, which nothing else
 * touches.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'
import type { Backend } from '../data/backend'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import type { SessionService } from '../data/session'

const COMPANY = 'co_demo'

function demoBackend(): Backend {
  const state = emptyState()
  state.companies.push({
    id: COMPANY,
    name: 'Demo Business',
    localeRegion: 'NG',
    localeLanguage: 'en',
    currency: 'NGN',
    numberingPrefixes: {},
    bankFields: {},
    enabledPaymentMethods: [],
  })
  return {
    kind: 'demo',
    companyId: COMPANY,
    repositories: createMemoryRepositories(state),
    durable: false,
  }
}

const signedOut: SessionService = {
  current: async () => ({ kind: 'signed_out' }),
  onChange: () => () => {},
  signIn: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  completeFromUrl: async () => {},
  signInWithGoogle: async () => ({ url: '' }),
  enabledProviders: async () => new Set<string>(),
  sendPasswordReset: async () => {},
  signOut: async () => {},
  createCompany: async () => ({ companyId: COMPANY }),
}

const accountBackend = (): Backend => ({
  kind: 'account',
  session: signedOut,
  repositories: createMemoryRepositories(emptyState()),
})

describe('The demo path, which npm run dev runs on', () => {
  it('mounts the app and says out loud that it is a demo (§R)', async () => {
    render(<App loadBackend={async () => demoBackend()} router="memory" />)

    // §R: "a local demo is never passed off as an account." A demo that merely
    // looks like the app IS passing itself off as one.
    expect(await screen.findByText(/on this device only/i)).toBeInTheDocument()
    // And it is the app, not a sign-in screen: nobody signs into a demo.
    expect(screen.queryByRole('heading', { name: /sign in/i })).not.toBeInTheDocument()
  })
})

describe('The account path', () => {
  it('asks for sign-in rather than mounting the app', async () => {
    render(<App loadBackend={async () => accountBackend()} router="memory" />)
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    // No demo banner on an account build, whatever the sign-in state.
    expect(screen.queryByText(/on this device only/i)).not.toBeInTheDocument()
  })
})

describe('A public link never waits for a backend (Rule #1)', () => {
  it('renders the customer page without resolving one at all', async () => {
    const load = vi.fn(async () => accountBackend())
    render(<App loadBackend={load} router="memory" initialPath="/accept/sometoken" />)

    // The page talks to the edge function over plain `fetch`; a customer has
    // no account. Resolving a database client here would make the cheapest
    // phone on the slowest connection pay for a feature it never uses.
    await screen.findByRole('main')
    expect(load).not.toHaveBeenCalled()
  })
})

describe('A build that cannot start says so (§N)', () => {
  it('shows a message rather than a white screen', async () => {
    // What a service-role key pasted into the anon slot produces. Before the
    // backend was lazy this threw at module scope and the page stayed blank.
    const load = async (): Promise<Backend> => {
      throw new Error('That is a service-role key, not an anon key.')
    }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<App loadBackend={load} router="memory" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/not set up correctly/i)
    // The specific misconfiguration goes to whoever deployed it, not to the
    // page — a stranger should not be told which way the deploy is broken.
    expect(screen.queryByText(/service-role/i)).not.toBeInTheDocument()
    expect(quiet).toHaveBeenCalled()
    quiet.mockRestore()
  })
})
