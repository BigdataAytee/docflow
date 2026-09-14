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

import type { UiStrings } from '../../domain/locale/data/strings'

export interface SignInScreenProps {
  readonly strings: UiStrings
  readonly onSignIn: (email: string, password: string) => Promise<void>
  readonly onSignUp: (email: string, password: string) => Promise<void>
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const canSubmit = email.trim() !== '' && password !== '' && !busy

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
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
          void run(() =>
            mode === 'in' ? onSignIn(email.trim(), password) : onSignUp(email.trim(), password),
          )
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
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-5 min-h-tap w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {mode === 'in' ? a.signIn : a.createAccount}
        </button>
      </form>

      {onGoogle !== undefined && (
        <button
          type="button"
          disabled={busy}
          className="mt-3 min-h-tap w-full rounded-xl border border-edge/10 px-4 text-sm font-semibold disabled:opacity-40"
          onClick={() => void run(onGoogle)}
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
          disabled={email.trim() === '' || busy}
          className="min-h-tap text-xs font-medium underline opacity-70 disabled:opacity-30"
          onClick={() =>
            void run(async () => {
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
      <p className="mt-6 text-[11px] opacity-60">{a.needsConnection}</p>

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
