/**
 * Auth (§Q Phase 1, §R).
 *
 * The rules that shape this, all from §M and §Q:
 *  · Offline use never requires a token refresh. A valid cached session is
 *    enough to open the app; nothing here blocks on the network.
 *  · Expired credentials PAUSE SYNC — they never delete local work. Logging a
 *    user out of the server is not the same as discarding what they typed.
 *  · Logout returns to welcome, warns when work is pending, and retains the
 *    encrypted account-scoped local store rather than wiping it.
 */

import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

import {
  type ReadStorage,
  browserStorage,
  refusedByServer,
  storedRefreshToken,
} from './persisted'

export type AuthState =
  /** A usable session. Sync may run. */
  | { readonly kind: 'authenticated'; readonly user: User; readonly session: Session }
  /**
   * A session we hold but cannot currently prove. Offline, or refresh failed.
   * The app stays fully usable (Rule #3) and sync pauses — local work is kept.
   */
  | { readonly kind: 'stale'; readonly user: User; readonly reason: 'offline' | 'refresh_failed' }
  /** No session. The welcome screen. Local data stays encrypted at rest (§M). */
  | { readonly kind: 'signed_out' }

export const canSync = (state: AuthState): boolean => state.kind === 'authenticated'

/** Rule #3: every core journey works offline, so a stale session still opens the app. */
export const canUseApp = (state: AuthState): boolean => state.kind !== 'signed_out'

/** §M — a credential problem never deletes local work. */
export const mayDeleteLocalData = (_state: AuthState): false => false

export interface AuthService {
  currentState(): Promise<AuthState>
  signInWithPassword(email: string, password: string): Promise<AuthState>
  signUpWithPassword(email: string, password: string): Promise<AuthState>
  signInWithGoogle(redirectTo: string): Promise<{ url: string }>
  sendPasswordReset(email: string, redirectTo: string): Promise<void>
  signOut(): Promise<void>
  onChange(listener: (state: AuthState) => void): () => void
}

export class AuthError extends Error {}

export function createAuthService(
  client: SupabaseClient,
  /** Injectable so the storage rule can be tested without a browser. */
  readStorage: ReadStorage = browserStorage,
  storageKey = 'docflow.auth',
): AuthService {
  const toState = (session: Session | null): AuthState =>
    session === null || session.user === null
      ? { kind: 'signed_out' }
      : { kind: 'authenticated', user: session.user, session }

  /**
   * The last word before anybody is shown a sign-in screen.
   *
   * Three outcomes, and only one of them ends the session — see
   * `persisted.ts` for why the middle one is the case that matters.
   */
  const fromStoredSession = async (): Promise<AuthState> => {
    const refreshToken = storedRefreshToken(readStorage, storageKey)
    // Nobody has ever signed in here, or they signed out and it was cleared.
    if (refreshToken === null) return { kind: 'signed_out' }

    try {
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
      if (error === null && data.session !== null) return toState(data.session)

      // Refused: revoked, deleted, or the password changed elsewhere. This is
      // the one case where losing the session is the right answer.
      if (refusedByServer(error)) return { kind: 'signed_out' }
    } catch (cause: unknown) {
      if (refusedByServer(cause)) return { kind: 'signed_out' }
    }

    /*
     * Could not ask. A session exists and this device simply has no way to
     * prove it right now — §M: a credential problem never costs somebody
     * their work, and Rule #2: offline is the product.
     *
     * `user` is unknown here because the token could not be exchanged, so
     * the app gets a stale session with no profile rather than none at all.
     * Everything local keeps working; sync stays paused until a refresh
     * succeeds.
     */
    return { kind: 'stale', user: {} as User, reason: 'refresh_failed' }
  }

  return {
    async currentState() {
      // supabase-js narrows `data` to never on the error branch, but it does
      // still return the cached session there — which is exactly what keeps
      // the app usable offline. Widened deliberately rather than losing it.
      const result = (await client.auth.getSession()) as {
        data: { session: Session | null }
        error: { message: string } | null
      }
      if (result.error !== null) {
        // Could not reach the server. If a session is cached, the app stays
        // usable and sync pauses; we never sign the user out on a network
        // failure (§M).
        const cached: Session | null = result.data?.session ?? null
        if (cached !== null && cached.user !== null) {
          return { kind: 'stale', user: cached.user, reason: 'offline' }
        }
        return await fromStoredSession()
      }

      const state = toState(result.data.session)
      // NO SESSION REPORTED IS NOT THE SAME AS SIGNED OUT, and this line is
      // the whole of the "opens on Home, forever" guarantee. `getSession`
      // refreshes an expired token internally, and whether it hands back the
      // old session or nothing when that refresh fails is a decision inside
      // the library — one that could change on an upgrade and quietly start
      // showing a login screen to people with weeks of work on the device.
      // So before anybody is sent to sign in, ask storage whether they ever
      // signed in and ask the server whether it still accepts them.
      return state.kind === 'signed_out' ? await fromStoredSession() : state
    },

    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error !== null) throw new AuthError(error.message)
      return toState(data.session)
    },

    async signUpWithPassword(email, password) {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error !== null) throw new AuthError(error.message)
      return toState(data.session)
    },

    async signInWithGoogle(redirectTo) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
      })
      if (error !== null) throw new AuthError(error.message)
      if (data.url === null) throw new AuthError('Google sign-in returned no URL.')
      return { url: data.url }
    },

    async sendPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
      if (error !== null) throw new AuthError(error.message)
    },

    async signOut() {
      // Clears credentials only. The encrypted account-scoped local store is
      // retained and locked; deleting it is a separate explicit action (§M).
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error !== null) throw new AuthError(error.message)
    },

    onChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(toState(session))
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
