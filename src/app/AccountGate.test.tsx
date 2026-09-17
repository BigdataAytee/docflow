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
import { useSessionActions } from './session-context'
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
    // Enabled by default here so the existing Google assertions keep testing
    // the button rather than accidentally testing that it is hidden. The
    // cases that turn it off pass their own.
    enabledProviders: async () => new Set(['google']),
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

describe('A signed-in person can sign out (§P)', () => {
  /**
   * The wire that did not exist.
   *
   * `Home` has taken an `onLogOut` prop since it was written and nothing
   * could supply one: this component owned the session and handed its
   * children a company id and nothing else. So the installed app had no way
   * out of an account at all — both halves built, no join.
   *
   * Asserted HERE rather than on Home, because the join is the part that was
   * missing. A test of the button alone would have passed the whole time.
   */
  it('hands the session down, so a screen can offer it', async () => {
    const signOut = vi.fn(async () => {})
    render(
      <AccountGate session={session({ stage: { kind: 'ready', companyId: 'co_1' }, signOut })}>
        {() => <SignOutProbe />}
      </AccountGate>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'probe sign out' }))
    expect(signOut).toHaveBeenCalledOnce()
  })

  /**
   * And the other half of the contract: no account, no offer. The demo
   * backend has no session, and a control offering to sign out of nothing
   * would be a lie rather than a no-op.
   */
  it('offers nothing when there is no session behind the app', () => {
    render(<SignOutProbe />)
    expect(screen.getByText('no session')).toBeInTheDocument()
  })
})

/**
 * The button that could only ever fail (§N).
 *
 * Google sign-in was rendered unconditionally. On a project with no Google
 * credentials, pressing it reached GoTrue and came back
 * `{"error_code":"validation_failed","msg":"Unsupported provider: provider is
 * not enabled"}` — a control whose only outcome is an error, which is the same
 * species as a toggle wired to nothing.
 */
describe('A provider is offered only when the project has it', () => {
  const findGoogle = () => screen.queryByRole('button', { name: /google/i })

  it('offers Google when the project says it is enabled', async () => {
    render(
      <AccountGate session={session({ enabledProviders: async () => new Set(['google']) })}>
        {() => <p>app</p>}
      </AccountGate>,
    )
    expect(await screen.findByRole('button', { name: /google/i })).toBeInTheDocument()
  })

  it('does NOT offer Google when the project has it disabled', async () => {
    render(
      <AccountGate session={session({ enabledProviders: async () => new Set(['apple']) })}>
        {() => <p>app</p>}
      </AccountGate>,
    )
    // Waiting on the screen, not on the probe: asserting a button's absence
    // immediately would pass before the answer ever arrived, and would keep
    // passing if the answer were ignored.
    await screen.findByRole('button', { name: /sign in/i })
    expect(findGoogle()).not.toBeInTheDocument()
  })

  /*
   * Unknown is hidden. Whoever cannot reach the project cannot complete an
   * OAuth round trip either, so the button can only waste their time — and
   * email sign-in is on the same screen.
   */
  it('does NOT offer Google while the answer is still unknown', async () => {
    render(
      <AccountGate session={session({ enabledProviders: () => new Promise(() => {}) })}>
        {() => <p>app</p>}
      </AccountGate>,
    )
    await screen.findByRole('button', { name: /sign in/i })
    expect(findGoogle()).not.toBeInTheDocument()
  })
})

/** Stands in for Home: reads the context the way a screen does. */
function SignOutProbe() {
  const actions = useSessionActions()
  if (actions === null) return <p>no session</p>
  return (
    <button type="button" onClick={() => void actions.signOut()}>
      probe sign out
    </button>
  )
}
