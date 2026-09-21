/**
 * Signing in (§R, §S, §N).
 *
 * §R: "sign-in, account creation… Initial auth needs a connection; a local
 * demo is never passed off as an account." Both halves are load-bearing here:
 * the connection requirement is stated PLAINLY before the attempt rather than
 * surfacing as a failure afterwards (§N — an unavailable capability is said
 * out loud, never dressed up), and this screen never offers a way in that is
 * not an account.
 *
 * It takes its words and its service rather than reaching for them, so it can
 * be tested without a provider and without a network.
 */

import { useId, useState } from 'react'

import { type UiStrings, format } from '../../domain/locale/data/strings'
import { classifyAuthFailure, refusalMessage } from './refusal'
import { PASSWORD_MIN_LENGTH, passwordProblem } from './password'

export interface SignInScreenProps {
  readonly strings: UiStrings
  readonly onSignIn: (email: string, password: string) => Promise<void>
  readonly onSignUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  readonly onGoogle?: () => Promise<void>
  readonly onReset?: (email: string) => Promise<void>
}

export function SignInScreen({
  strings,
  onSignIn,
  onSignUp,
  onGoogle,
  onReset,
}: SignInScreenProps) {
  const a = strings.account
  const ids = useId()

  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  /*
   * What is happening, in words, while it happens. `busy` alone only greyed
   * the button out: a sign-up on a slow connection takes seconds, said
   * nothing, and then — with confirmations on — finished by leaving the screen
   * exactly as it was. Indistinguishable from a button that does nothing.
   */
  const [busy, setBusy] = useState<null | 'in' | 'up' | 'reset' | 'google'>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /*
   * Checked only when CREATING an account. On sign-in the rule belongs to
   * whatever password the person already has — refusing a short one here
   * would lock out anybody who registered before the minimum was raised,
   * and tell a stranger the rule at the same time.
   */
  const tooShort = mode === 'up' && password !== '' && passwordProblem(password) === 'too_short'
  const canSubmit = email.trim() !== '' && password !== '' && !tooShort && busy === null

  const run = async (what: 'in' | 'up' | 'reset' | 'google', action: () => Promise<void>) => {
    setBusy(what)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause) {
      // Never the provider's own words: they are English, they are jargon,
      // and they describe the machine to whoever is probing it (§P, §S).
      setError(refusalMessage(classifyAuthFailure(cause), strings))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-xl font-bold">{a.signInTitle}</h1>
      <p className="mt-2 text-sm opacity-70">{a.signInBody}</p>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit) return
          void run(mode, async () => {
            if (mode === 'in') {
              await onSignIn(email.trim(), password)
              return
            }
            const { needsEmailConfirmation } = await onSignUp(email.trim(), password)
            /*
             * The account exists but cannot be used yet, and NOTHING else on
             * this screen would say so — the stage is still `signed_out`, so
             * the sign-in form simply stays put. Without this the successful
             * case and the silently-failed case look identical.
             */
            if (needsEmailConfirmation) setNotice(format(a.confirmSent, { email: email.trim() }))
          })
        }}
      >
        <label className="block text-xs font-medium opacity-70" htmlFor={`${ids}-email`}>
          {a.email}
        </label>
        <input
          id={`${ids}-email`}
          type="email"
          autoComplete="email"
          className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-password`}>
          {a.password}
        </label>
        <input
          id={`${ids}-password`}
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={tooShort}
          aria-describedby={mode === 'up' ? `${ids}-password-rule` : undefined}
        />

        {/*
          Said while they are still in the field, in our words. The server
          refuses a short one with its own English, which §S does not show
          anybody — so without this the only feedback would be a round trip
          ending in a message nobody wrote for a person.
        */}
        {mode === 'up' && (
          <p
            id={`${ids}-password-rule`}
            className={`mt-1 text-xs ${tooShort ? 'text-status-warn' : 'opacity-70'}`}
          >
            {format(a.passwordRule, { count: PASSWORD_MIN_LENGTH })}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          aria-busy={busy !== null}
          className="raised tap-scale mt-5 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-70"
        >
          {busy === null
            ? mode === 'in'
              ? a.signIn
              : a.createAccount
            : busy === 'up'
              ? a.creatingAccount
              : a.signingIn}
        </button>
      </form>

      {onGoogle !== undefined && (
        <button
          type="button"
          disabled={busy !== null}
          className="mt-3 min-h-tap w-full rounded-xl border border-edge/10 px-4 text-sm font-semibold disabled:opacity-70"
          onClick={() => void run('google', onGoogle)}
        >
          {a.continueWithGoogle}
        </button>
      )}

      <button
        type="button"
        className="mt-4 min-h-tap text-xs font-medium underline opacity-70"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setError(null)
          setNotice(null)
        }}
      >
        {mode === 'in' ? a.noAccount : a.haveAccount}
      </button>

      {mode === 'in' && onReset !== undefined && (
        <button
          type="button"
          disabled={email.trim() === '' || busy !== null}
          className="min-h-tap text-xs font-medium underline opacity-70 disabled:opacity-70"
          onClick={() =>
            void run('reset', async () => {
              await onReset(email.trim())
              // Deliberately the same message whether or not the address has
              // an account: anything else tells a stranger which emails are
              // registered (§P).
              setNotice(a.resetSent)
            })
          }
        >
          {a.forgotPassword}
        </button>
      )}

      {/*
        Said before the attempt, not after it fails. §R requires a connection
        for initial auth, and §N says an unavailable capability is stated
        plainly rather than dressed up as something else.
      */}
      <p className="mt-6 text-[11px] opacity-70">{a.needsConnection}</p>

      {notice !== null && (
        <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2.5 text-sm" role="status">
          {notice}
        </p>
      )}
      {error !== null && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </main>
  )
}
