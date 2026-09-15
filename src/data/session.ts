/**
 * The session port (§C, §R).
 *
 * What the app needs to know about "who is using this, and which company are
 * they" — expressed with no client in sight, exactly like
 * `src/data/repositories`. `AccountGate` talks to this and nothing else, so
 * the gate has no opinion about Supabase and would work unchanged over the
 * SQLite-plus-sync backend Phase 4 brings.
 *
 * The three stages are the three things that can be true, and they have to be
 * settled in order: a token with no company is denied every row by RLS (§P),
 * so "signed in" is not the same question as "has a company".
 */

export type SessionStage =
  | { readonly kind: 'signed_out' }
  /** Signed in, but no company yet — a fresh sign-up (§R). */
  | { readonly kind: 'needs_company' }
  | {
      readonly kind: 'ready'
      readonly companyId: string
      /**
       * The signed-in address, when there is an account behind this build.
       *
       * Settings → Your account shows it and sends the password reset to it,
       * and both need it to come from the SESSION rather than from a record:
       * the email that signs in is the auth provider's, and a copy kept
       * anywhere else would be the one that goes stale.
       *
       * Absent on the demo backend, which has no account at all.
       */
      readonly email?: string
    }

export interface NewBusiness {
  readonly name: string
  readonly localeRegion: string
  readonly currency: string
}

export interface SessionService {
  current(): Promise<SessionStage>
  /** Sign-in, sign-out and token refresh all arrive here. */
  onChange(listener: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  /** Returns the provider URL to send the browser to. */
  signInWithGoogle(redirectTo: string): Promise<{ url: string }>
  sendPasswordReset(email: string, redirectTo: string): Promise<void>
  signOut(): Promise<void>
  /**
   * Create the first company and come back with a session that KNOWS about
   * it. Returning the id is deliberate: a caller that had to re-read it might
   * do so with a token minted before the company existed, which is the whole
   * trap this flow exists to avoid.
   */
  createCompany(input: NewBusiness): Promise<{ companyId: string }>
}
