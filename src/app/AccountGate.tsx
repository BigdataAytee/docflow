/**
 * From "the app started" to "this company's records" (§R, §P).
 *
 * Three states, in order, and each one has to be settled before the next can
 * be asked:
 *
 *  1. **Signed out** → the sign-in screen. §R: initial auth needs a
 *     connection, and no demo is offered as a way past it.
 *  2. **Signed in, no company** → name the business. A token with no
 *     `company_id` is denied every row by RLS (§P), so mounting the app here
 *     would render an empty account on every screen with nothing to explain
 *     it. That is the failure this gate exists to make impossible.
 *  3. **Signed in, with a company** → the app, on that company.
 *
 * The company comes from the TOKEN rather than from a table, because the token
 * is what every policy is judged against. Asking anything else risks the app
 * and the database disagreeing about which company a session is — and the app
 * losing, silently, on every read.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import type { SessionService, SessionStage } from '../data/session'
import { SessionActionsProvider } from './session-context'
import { SignInScreen } from '../features/auth/SignInScreen'
import { NewBusinessScreen, regionFromBrowser } from '../features/auth/NewBusinessScreen'
import { stringsFor } from '../domain/locale/data/strings'
import { SkeletonList } from '../ui'

type Stage = { readonly kind: 'resolving' } | SessionStage

export interface AccountGateProps {
  readonly session: SessionService
  readonly children: (companyId: string) => ReactNode
}

export function AccountGate({ session, children }: AccountGateProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'resolving' })

  // Before a company is known there is no company language to read, so the
  // account screens use the catalogue default. This is the one place in the
  // app where that is correct rather than a shortcut: §D resolves language
  // from the company, and there is not one yet.
  const strings = stringsFor('en')

  const resolve = useCallback(async () => {
    const next = await session.current()
    setStage(next)
  }, [session])

  useEffect(() => {
    let mounted = true
    const settle = () => {
      if (mounted) void resolve()
    }
    settle()
    // Sign-in, sign-out and token refresh all arrive here, so the gate follows
    // the session rather than sampling it once at mount.
    const stop = session.onChange(settle)
    return () => {
      mounted = false
      stop()
    }
  }, [session, resolve])

  if (stage.kind === 'resolving') {
    // A skeleton, never a spinner (CLAUDE.md).
    return (
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <SkeletonList rows={3} />
      </main>
    )
  }

  if (stage.kind === 'signed_out') {
    return (
      <SignInScreen
        strings={strings}
        onSignIn={(email, password) => session.signIn(email, password)}
        onSignUp={(email, password) => session.signUp(email, password)}
        onGoogle={async () => {
          const { url } = await session.signInWithGoogle(window.location.origin)
          window.location.assign(url)
        }}
        onReset={(email) => session.sendPasswordReset(email, window.location.origin)}
      />
    )
  }

  if (stage.kind === 'needs_company') {
    const suggested = regionFromBrowser(navigator.language)
    return (
      <NewBusinessScreen
        strings={strings}
        {...(suggested === undefined ? {} : { suggestedRegion: suggested })}
        onCreate={async ({ name, region, currency }) => {
          // The id comes back from a session that has already been refreshed,
          // so it names a company this token can actually read. Trusting the
          // call rather than re-reading is the point (see `account.ts`).
          const { companyId } = await session.createCompany({
            name,
            localeRegion: region,
            currency,
          })
          setStage({ kind: 'ready', companyId })
        }}
        onSignOut={() => session.signOut()}
      />
    )
  }

  /*
   * The session reaches the app from here and nowhere else. `Home` has
   * accepted an `onLogOut` prop since it was written and nothing could supply
   * one, because this component hands its children a company id and stops —
   * so the installed app had no way to sign out at all.
   */
  return (
    <SessionActionsProvider
      {...(stage.email === undefined ? {} : { email: stage.email })}
      signOut={() => session.signOut()}
      sendPasswordReset={async (redirectTo) => {
        // The address comes from the SESSION, so a reset can only ever be
        // sent to the account that asked for it — never to something typed
        // into a box on a screen somebody else might be holding (§P).
        if (stage.email === undefined) return
        await session.sendPasswordReset(stage.email, redirectTo)
      }}
    >
      {children(stage.companyId)}
    </SessionActionsProvider>
  )
}
