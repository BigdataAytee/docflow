/**
 * The theme, provided once at the root.
 *
 * It lives here rather than in the Settings panel for a reason worth stating:
 * the panel is one screen, and `.dark` belongs to the DOCUMENT. A hook mounted
 * in Settings applies the class while Settings is open and drops it on the way
 * back to Home, which is a dark mode that works only on the screen where you
 * chose it — and that is exactly how the first version of this behaved.
 */

import { type ReactNode, createContext, useContext } from 'react'

import type { Theme } from './useTheme'
import { useTheme } from './useTheme'

const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  return <ThemeContext.Provider value={useTheme()}>{children}</ThemeContext.Provider>
}

/**
 * Falls back to a working no-op rather than throwing.
 *
 * Every existing test renders a screen without a provider, and a missing theme
 * is not a reason for Settings to crash — the app is simply light, which is
 * the default anyway.
 */
export function useThemeChoice(): Theme {
  return (
    useContext(ThemeContext) ?? {
      choice: 'system',
      scheme: 'light',
      setChoice: () => undefined,
    }
  )
}
