/**
 * The company context (§C: "Routes, auth boundary, company context, service
 * composition").
 *
 * One place supplies the three things every screen needs: the repositories
 * (never a DB client), the locale profile, and the UI strings. Screens read
 * them through hooks, so no screen constructs a repository or looks up a word
 * on its own.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { Repositories } from '../data/repositories'
import type { LocaleProfile } from '../domain/locale/profile'
import { tableFor } from '../domain/locale/profile'
import { type UiStrings, stringsFor } from '../domain/locale/data/strings'

export interface CompanyContextValue {
  readonly companyId: string
  readonly repositories: Repositories
  readonly profile: LocaleProfile
  readonly strings: UiStrings
  readonly direction: 'ltr' | 'rtl'
  /**
   * §R: "a local demo is never passed off as an account."
   *
   * Carried here because more than the banner needs to know. The ratings
   * prompt is the second thing: a sample document shared from a demo is not
   * an achievement, and asking somebody to rate an app on the strength of it
   * is asking about something that did not happen.
   */
  readonly isDemo: boolean
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export interface CompanyProviderProps {
  readonly companyId: string
  readonly repositories: Repositories
  readonly profile: LocaleProfile
  /** Defaults to the locale's own language; §D allows a per-user override. */
  readonly language?: string
  /** Defaults to false: an account unless something says otherwise. */
  readonly isDemo?: boolean
  readonly children: ReactNode
}

export function CompanyProvider({
  companyId,
  repositories,
  profile,
  language,
  isDemo = false,
  children,
}: CompanyProviderProps) {
  const value = useMemo<CompanyContextValue>(() => {
    const table = tableFor(profile)
    return {
      companyId,
      repositories,
      profile,
      strings: stringsFor(language ?? table.language),
      direction: table.direction,
      isDemo,
    }
  }, [companyId, repositories, profile, language, isDemo])

  return (
    <CompanyContext.Provider value={value}>
      <div dir={value.direction}>{children}</div>
    </CompanyContext.Provider>
  )
}

export function useCompany(): CompanyContextValue {
  const value = useContext(CompanyContext)
  if (value === null) {
    throw new Error('useCompany must be used inside a CompanyProvider.')
  }
  return value
}
