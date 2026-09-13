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
import { createAuthService } from './auth'
import { accountState, createCompany } from './account'

export function createSupabaseSession(client: SupabaseClient): SessionService {
  const auth = createAuthService(client)

  return {
    async current(): Promise<SessionStage> {
      const state = await auth.currentState()
      if (state.kind === 'signed_out') return { kind: 'signed_out' }
      // A stale session still opens the app (§M — expired credentials pause
      // sync, they never lock someone out), so only `signed_out` sends anyone
      // back to the sign-in screen.
      const account = await accountState(client)
      return account.kind === 'ready'
        ? { kind: 'ready', companyId: account.companyId }
        : { kind: 'needs_company' }
    },

    onChange: (listener) => auth.onChange(() => listener()),

    async signIn(email, password) {
      await auth.signInWithPassword(email, password)
    },
    async signUp(email, password) {
      await auth.signUpWithPassword(email, password)
    },
    signInWithGoogle: (redirectTo) => auth.signInWithGoogle(redirectTo),
    sendPasswordReset: (email, redirectTo) => auth.sendPasswordReset(email, redirectTo),
    signOut: () => auth.signOut(),

    async createCompany(input: NewBusiness) {
      const { companyId } = await createCompany(client, input)
      return { companyId }
    },
  }
}
