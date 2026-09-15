/**
 * What a signed-in person can do about being signed in (§P).
 *
 * `AccountGate` owns the session and hands its children a company id and
 * nothing else — which is why `Home` has accepted an `onLogOut` prop since it
 * was written with nobody able to supply one. There was no way to sign out of
 * the installed app at all: the control existed, `SessionService.signOut`
 * existed, and no wire joined them.
 *
 * A context rather than more render-prop arguments, because the only screen
 * that needs this is several levels down and threading a callback through
 * every layer between would put an auth concern in the router.
 *
 * NULL WHEN THERE IS NO ACCOUNT, and that is the meaningful part: the demo
 * backend has no session, so there is nothing to sign out OF, and a control
 * offering it would be a lie. The reference's demo shows one because leaving
 * its demo is a real thing you can do there; in an installed app it would not
 * be.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export interface SessionActions {
  readonly signOut: () => Promise<void>
}

const SessionActionsContext = createContext<SessionActions | null>(null)

export function SessionActionsProvider({
  signOut,
  children,
}: {
  signOut: () => Promise<void>
  children: ReactNode
}) {
  const value = useMemo<SessionActions>(() => ({ signOut }), [signOut])
  return <SessionActionsContext.Provider value={value}>{children}</SessionActionsContext.Provider>
}

/** Null when this build has no account behind it — see the note above. */
export const useSessionActions = (): SessionActions | null => useContext(SessionActionsContext)
