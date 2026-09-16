/**
 * After the first sign-in, the app opens on Home — every time, forever.
 *
 * The requirement in one line: a person sees a sign-in screen on a NEW DEVICE,
 * after signing out ON PURPOSE, or when the session has GENUINELY BEEN
 * REVOKED. Never after an update, never after weeks offline, never because a
 * token refresh failed while the phone had no signal.
 *
 * Everything below is one of those cases. The ones that matter most are the
 * negatives — the situations where the old code would have shown a login
 * screen, or (just as wrong, and the bug that was actually found here) the
 * BUSINESS SETUP screen, because a second lookup asked for the session again
 * and got nothing.
 */

import { describe, expect, it, vi } from 'vitest'

import { createAuthService } from './auth'
import { refusedByServer, storedAccessToken, storedRefreshToken } from './persisted'

/** A token whose claims carry a company, the way a real one does. */
const tokenFor = (companyId: string): string => {
  const encode = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode({
    sub: 'user-1',
    app_metadata: { company_id: companyId },
  })}.signature`
}

const COMPANY = '11111111-1111-1111-1111-111111111111'

const stored = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ access_token: tokenFor(COMPANY), refresh_token: 'refresh-abc', ...over })

/** A client whose `getSession` and `refreshSession` answer however a test says. */
function clientWith(answers: {
  getSession?: () => unknown
  refreshSession?: () => unknown
}) {
  return {
    auth: {
      getSession: vi.fn(answers.getSession ?? (() => ({ data: { session: null }, error: null }))),
      refreshSession: vi.fn(
        answers.refreshSession ?? (() => ({ data: { session: null }, error: null })),
      ),
    },
  } as never
}

describe('Reopening the app never signs anybody out (§M, Rule #2)', () => {
  /**
   * THE ONE THIS WAS WRITTEN FOR. Reopen after weeks offline: the cached
   * token is long expired, `getSession` reports nothing, and the refresh
   * cannot reach the server. The old path called that "signed out".
   */
  it('keeps the session when the server cannot be reached', async () => {
    const auth = createAuthService(
      clientWith({
        getSession: () => ({ data: { session: null }, error: null }),
        refreshSession: () => {
          throw Object.assign(new Error('Failed to fetch'), { name: 'TypeError' })
        },
      }),
      () => stored(),
    )

    const state = await auth.currentState()
    expect(state.kind).toBe('stale')
    expect(state.kind === 'stale' ? state.reason : '').toBe('refresh_failed')
  })

  it('keeps it when getSession itself errors and has nothing cached', async () => {
    const auth = createAuthService(
      clientWith({
        getSession: () => ({ data: { session: null }, error: { message: 'network down' } }),
        refreshSession: () => ({ data: { session: null }, error: { message: 'network down' } }),
      }),
      () => stored(),
    )

    expect((await auth.currentState()).kind).toBe('stale')
  })

  /** A 5xx is the server having a bad day, not a refusal. */
  it('keeps it when the server answers 500', async () => {
    const auth = createAuthService(
      clientWith({
        refreshSession: () => ({ data: { session: null }, error: { status: 503, message: 'upstream' } }),
      }),
      () => stored(),
    )

    expect((await auth.currentState()).kind).toBe('stale')
  })

  /** A refresh that WORKS is the ordinary case: silently renewed, no prompt. */
  it('renews silently when it can, with no sign of it', async () => {
    const session = { access_token: tokenFor(COMPANY), user: { id: 'user-1' } }
    const auth = createAuthService(
      clientWith({
        getSession: () => ({ data: { session: null }, error: null }),
        refreshSession: () => ({ data: { session }, error: null }),
      }),
      () => stored(),
    )

    expect((await auth.currentState()).kind).toBe('authenticated')
  })
})

describe('The three times a sign-in screen IS correct', () => {
  /** A new device: nothing was ever persisted here. */
  it('signs out when no session was ever stored', async () => {
    const auth = createAuthService(clientWith({}), () => null)
    expect((await auth.currentState()).kind).toBe('signed_out')
  })

  /** Signing out deliberately clears the blob, which is this same case. */
  it('signs out when storage was cleared', async () => {
    const auth = createAuthService(clientWith({}), () => '')
    expect((await auth.currentState()).kind).toBe('signed_out')
  })

  /** Genuinely revoked: the server says the refresh token is dead. */
  it.each([
    { status: 400, message: 'Invalid Refresh Token: Already Used' },
    { status: 401, message: 'invalid refresh token' },
    { message: 'Refresh Token Not Found' },
  ])('signs out when the server refuses it (%o)', async (error) => {
    const auth = createAuthService(
      clientWith({ refreshSession: () => ({ data: { session: null }, error }) }),
      () => stored(),
    )

    expect((await auth.currentState()).kind).toBe('signed_out')
  })

  /** Corrupt storage must not trap somebody in an app that can never sync. */
  it('signs out rather than looping on an unreadable blob', async () => {
    const auth = createAuthService(clientWith({}), () => 'not json at all')
    expect((await auth.currentState()).kind).toBe('signed_out')
  })
})

describe('Telling a refusal from an outage (§M)', () => {
  it.each([
    [{ status: 400, message: 'invalid refresh token' }, true],
    [{ status: 401, message: 'unauthorized' }, true],
    [{ status: 403, message: 'forbidden' }, true],
    [{ message: 'Refresh Token Not Found' }, true],
    [{ message: 'already used' }, true],
    [{ status: 500, message: 'boom' }, false],
    [{ status: 503, message: 'upstream' }, false],
    [{ message: 'Failed to fetch' }, false],
    [{ message: 'network request failed' }, false],
    [{}, false],
    [null, false],
  ])('reads %o as refused=%s', (error, expected) => {
    expect(refusedByServer(error)).toBe(expected)
  })

  /**
   * Conservative on purpose. Anything unrecognised is an outage, because
   * leaving a revoked session usable offline until the next successful call
   * is a far smaller harm than signing a working person out on a train.
   */
  it('treats an unrecognised failure as an outage, not a refusal', () => {
    expect(refusedByServer(new Error('something nobody has seen before'))).toBe(false)
  })
})

describe('The company survives a session that cannot be proved', () => {
  /**
   * THE SECOND BUG, and it showed a different wrong screen. `accountState`
   * asked `getSession()` again; offline that answered null, the stage came
   * back `needs_company`, and somebody with weeks of work reopened the app to
   * the BUSINESS SETUP screen. The claim is read from the persisted token now.
   */
  it('reads the company from the stored token', () => {
    expect(storedAccessToken(() => stored(), 'docflow.auth')).toBe(tokenFor(COMPANY))
  })

  it('finds no token where there is no session', () => {
    expect(storedAccessToken(() => null, 'docflow.auth')).toBeNull()
    expect(storedRefreshToken(() => '{}', 'docflow.auth')).toBeNull()
  })

  /** Expiry is deliberately not consulted: it still says WHOSE records these are. */
  it('reads it from an expired token too', () => {
    const expired = stored({ expires_at: 1 })
    expect(storedAccessToken(() => expired, 'docflow.auth')).toBe(tokenFor(COMPANY))
  })
})
