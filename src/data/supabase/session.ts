/**
 * The session port, over Supabase (§R, §P).
 *
 * Thin on purpose: `auth.ts` already holds the auth rules and `account.ts`
 * holds the company bootstrap, including the refresh that a token minted
 * before the company cannot avoid needing. This joins them into the one
 * interface the app sees.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { NewBusiness, SessionService, SessionStage } from '../session'
import { readEnabledProviders } from '../../features/auth/providers'
import { readConfig } from './client'
import { createAuthService } from './auth'
import { accountState, companyFromToken, createCompany } from './account'
import { browserStorage, storedAccessToken } from './persisted'

export function createSupabaseSession(
  client: SupabaseClient,
  env: Record<string, string | undefined> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >,
): SessionService {
  const auth = createAuthService(client)

  /*
   * Asked once and remembered. The answer changes when somebody edits the
   * project's dashboard, not while a person is looking at the sign-in screen,
   * and re-asking on every render would put a network round trip in front of
   * a button that is usually not even drawn.
   */
  let providers: Promise<ReadonlySet<string>> | null = null

  /** The company claim from the session supabase-js persisted, if any. */
  const companyFromStorage = (): string | null => {
    const token = storedAccessToken(browserStorage, 'docflow.auth')
    return token === null ? null : companyFromToken(token)
  }

  return {
    async current(): Promise<SessionStage> {
      const state = await auth.currentState()
      if (state.kind === 'signed_out') return { kind: 'signed_out' }

      /*
       * THE COMPANY COMES FROM THE TOKEN WE ALREADY HAVE, never from a second
       * lookup — and that is a fix, not a tidy-up.
       *
       * `accountState` asks `getSession()` again. Offline, after a refresh it
       * could not complete, that second ask answers null and the stage came
       * back `needs_company` — so a person with weeks of work on the device
       * reopened the app and was shown the BUSINESS SETUP screen. Not a login
       * screen, but every bit as wrong: the requirement is Home, every time.
       *
       * A stale session still opens the app (§M — expired credentials pause
       * sync, they never lock anybody out), so the claim is read from the
       * token in hand, and from the persisted one when there is no live
       * session to read. An expired token still says which business the
       * records belong to, and that fact does not expire with it. Nothing is
       * authorised on the strength of it: the server re-checks every claim on
       * every request, which is what RLS is for.
       */
      const companyId =
        state.kind === 'authenticated'
          ? companyFromToken(state.session.access_token)
          : companyFromStorage()
      if (companyId === null) {
        // No claim anywhere: a genuinely fresh sign-up that has not made a
        // business yet, which is the one case that screen is for.
        const account = await accountState(client)
        if (account.kind !== 'ready') return { kind: 'needs_company' }
        return { kind: 'ready', companyId: account.companyId }
      }

      // From the session, never from a row: this is the address that signs
      // in, and a copy kept elsewhere is the one that goes stale.
      const email = state.kind === 'authenticated' ? state.user.email : undefined
      return {
        kind: 'ready',
        companyId,
        ...(email === undefined || email === '' ? {} : { email }),
      }
    },

    onChange: (listener) => auth.onChange(() => listener()),

    async signIn(email, password) {
      await auth.signInWithPassword(email, password)
    },
    async signUp(email, password) {
      await auth.signUpWithPassword(email, password)
    },
    signInWithGoogle: (redirectTo) => auth.signInWithGoogle(redirectTo),

    enabledProviders() {
      const { url, anonKey } = readConfig(env)
      providers ??= readEnabledProviders(url, anonKey)
      return providers
    },
    sendPasswordReset: (email, redirectTo) => auth.sendPasswordReset(email, redirectTo),
    signOut: () => auth.signOut(),

    async createCompany(input: NewBusiness) {
      const { companyId } = await createCompany(client, input)
      return { companyId }
    },
  }
}
