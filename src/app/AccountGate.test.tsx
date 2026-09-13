/**
 * The gate between "the app started" and "this company's records" (§R, §P).
 *
 * Driven through the session PORT, not through Supabase — which is the point
 * of the port, and means these tests describe behaviour rather than a client.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AccountGate } from './AccountGate'
import type { SessionService, SessionStage } from '../data/session'

function session(overrides: Partial<SessionService> & { stage?: SessionStage }): SessionService {
  let stage: SessionStage = overrides.stage ?? { kind: 'signed_out' }
  const listeners = new Set<() => void>()
  return {
    current: async () => stage,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    signIn: async () => {
      stage = { kind: 'ready', companyId: 'co_1' }
      listeners.forEach((l) => l())
    },
    signUp: async () => {
      // A fresh sign-up has an account and no company — the state §R's
      // business setup exists for.
      stage = { kind: 'needs_company' }
      listeners.forEach((l) => l())
    },
    signInWithGoogle: async () => ({ url: 'https://accounts.example/auth' }),
    sendPasswordReset: async () => {},
    signOut: async () => {
      stage = { kind: 'signed_out' }
      listeners.forEach((l) => l())
    },
    createCompany: async () => ({ companyId: 'co_new' }),
    ...overrides,
  }
}

const body = (companyId: string) => <p>records for {companyId}</p>

describe('Nobody reaches the app without a company (§P)', () => {
  it('shows sign-in when signed out', async () => {
    render(<AccountGate session={session({ stage: { kind: 'signed_out' } })}>{body}</AccountGate>)
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText(/records for/)).not.toBeInTheDocument()
  })

  it('asks for a business when signed in with no company', async () => {
    render(<AccountGate session={session({ stage: { kind: 'needs_company' } })}>{body}</AccountGate>)

    // Mounting the app here would render an empty account on every screen with
    // nothing to explain it: the token carries no company, so RLS denies every
    // row. That silence is what this branch exists to prevent.
    expect(await screen.findByRole('heading', { name: /name your business/i })).toBeInTheDocument()
    expect(screen.queryByText(/records for/)).not.toBeInTheDocument()
  })

  it('mounts the app on the company the session names', async () => {
    render(
      <AccountGate session={session({ stage: { kind: 'ready', companyId: 'co_7' } })}>
        {body}
      </AccountGate>,
    )
    expect(await screen.findByText('records for co_7')).toBeInTheDocument()
  })

  it('shows a skeleton while resolving, never a spinner or a blank screen', () => {
    const never = session({ current: () => new Promise<SessionStage>(() => {}) })
    const { container } = render(<AccountGate session={never}>{body}</AccountGate>)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })
})

describe('The gate follows the session rather than sampling it once', () => {
  it('moves to the app when a sign-in succeeds', async () => {
    const user = userEvent.setup()
    render(<AccountGate session={session({ stage: { kind: 'signed_out' } })}>{body}</AccountGate>)

    await user.type(await screen.findByLabelText(/email/i), 'ada@example.test')
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText('records for co_1')).toBeInTheDocument()
  })

  it('sends a new sign-up to business setup, not into an empty app', async () => {
    const user = userEvent.setup()
    render(<AccountGate session={session({ stage: { kind: 'signed_out' } })}>{body}</AccountGate>)

    await user.click(await screen.findByRole('button', { name: /new here/i }))
    await user.type(screen.getByLabelText(/email/i), 'ada@example.test')
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2')
    await user.click(screen.getByRole('button', { name: /create an account/i }))

    expect(await screen.findByRole('heading', { name: /name your business/i })).toBeInTheDocument()
  })

  it('enters the app on the company the creation returned', async () => {
    const user = userEvent.setup()
    render(<AccountGate session={session({ stage: { kind: 'needs_company' } })}>{body}</AccountGate>)

    await user.type(await screen.findByLabelText(/business name/i), 'Sola Ventures')
    await user.click(screen.getByRole('button', { name: /create my business/i }))

    // The id comes from a session already refreshed, so it names a company
    // this token can actually read.
    expect(await screen.findByText('records for co_new')).toBeInTheDocument()
  })

  it('says what went wrong rather than entering an account that cannot read', async () => {
    const user = userEvent.setup()
    const failing = session({
      stage: { kind: 'needs_company' },
      createCompany: () => {
        throw new Error('Your business was created, but this session still does not carry it.')
      },
    })
    render(<AccountGate session={failing}>{body}</AccountGate>)

    await user.type(await screen.findByLabelText(/business name/i), 'Sola Ventures')
    await user.click(screen.getByRole('button', { name: /create my business/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/still does not carry it/)
    expect(screen.queryByText(/records for/)).not.toBeInTheDocument()
  })

  it('returns to sign-in on sign-out', async () => {
    const user = userEvent.setup()
    render(<AccountGate session={session({ stage: { kind: 'needs_company' } })}>{body}</AccountGate>)

    await user.click(await screen.findByRole('button', { name: /sign out/i }))
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })
})

describe('Signing in needs a connection, and says so first (§R, §N)', () => {
  it('states it before the attempt rather than after a failure', async () => {
    render(<AccountGate session={session({ stage: { kind: 'signed_out' } })}>{body}</AccountGate>)
    expect(await screen.findByText(/needs an internet connection/i)).toBeInTheDocument()
  })

  it('offers no way in that is not an account', async () => {
    render(<AccountGate session={session({ stage: { kind: 'signed_out' } })}>{body}</AccountGate>)
    await screen.findByRole('heading', { name: /sign in/i })
    // §R: "a local demo is never passed off as an account." There is no
    // "continue without an account" here, and there must never be one.
    expect(screen.queryByText(/demo|skip|continue without/i)).not.toBeInTheDocument()
  })

  it('says the same thing whether or not a reset email has an account (§P)', async () => {
    const user = userEvent.setup()
    const sent = vi.fn(async () => {})
    render(
      <AccountGate session={session({ stage: { kind: 'signed_out' }, sendPasswordReset: sent })}>
        {body}
      </AccountGate>,
    )

    await user.type(await screen.findByLabelText(/email/i), 'stranger@example.test')
    await user.click(screen.getByRole('button', { name: /forgot your password/i }))

    // Anything conditional here tells a stranger which addresses are
    // registered.
    expect(await screen.findByRole('status')).toHaveTextContent(/on its way/i)
    expect(sent).toHaveBeenCalledWith('stranger@example.test', expect.any(String))
  })
})
