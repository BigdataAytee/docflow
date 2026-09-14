/**
 * Keeping the document in step with the choice, and with the phone.
 *
 * The second half is the one that is easy to leave out: on `system`, the phone
 * can change under the app — at sunset, or because somebody flipped it in
 * Control Centre while DocFlow was open. Listening is what makes "follows the
 * phone" true rather than "read the phone once at startup".
 */

import { useCallback, useEffect, useState } from 'react'

import {
  type Scheme,
  type ThemeChoice,
  applyScheme,
  prefersDark,
  schemeFor,
  storeChoice,
  storedChoice,
} from './theme'

export interface Theme {
  readonly choice: ThemeChoice
  readonly scheme: Scheme
  readonly setChoice: (choice: ThemeChoice) => void
}

export function useTheme(): Theme {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => storedChoice())
  const [dark, setDark] = useState<boolean>(() => prefersDark())

  useEffect(() => {
    const query = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (query === undefined) return
    const listen = (event: MediaQueryListEvent): void => setDark(event.matches)
    query.addEventListener('change', listen)
    return () => query.removeEventListener('change', listen)
  }, [])

  const scheme = schemeFor(choice, dark)
  useEffect(() => {
    applyScheme(scheme)
  }, [scheme])

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next)
    storeChoice(next)
  }, [])

  return { choice, scheme, setChoice }
}
