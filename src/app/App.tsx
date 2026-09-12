/**
 * The app root: repositories, company context, routes (§C).
 *
 * The locale profile is derived from the COMPANY's saved region, so a region
 * change in Settings re-renders the whole tree under a new profile and §D's
 * "effective immediately, offline, everywhere at once" needs no broadcast.
 * Issued documents keep their frozen labels because those live on the record
 * (§D.2, §M), not in this profile.
 *
 * Nothing here reaches a database. The repositories are handed in, so the same
 * routes run on memory (dev and tests), SQLite (Phase 4) and Supabase (Phase
 * 5) without a line changing above this file (CLAUDE.md).
 */

import { useMemo, type ReactNode } from 'react'
import {
  Navigate,
  Route,
  Routes,
  MemoryRouter,
  BrowserRouter,
  useLocation,
} from 'react-router-dom'

import { CompanyProvider, useCompany } from './context'
import { AppDataProvider, useAppData } from './store'
import { Shell } from './Shell'
import { HOME, SETTINGS_PANELS } from './paths'
import { DEV_COMPANY_ID, devState } from './seed'
import { type Repositories, createMemoryRepositories } from '../data/repositories'
import { EmptyState, SkeletonList } from '../ui'
import { localeProfileOf } from '../features/settings/region'
import type { LocaleProfile } from '../domain/locale/profile'
import { hasStringsFor } from '../domain/locale/data/strings'
import { HomeScreen } from './screens/HomeScreen'
import { ListScreen } from './screens/ListScreen'
import { BuilderScreen, NewDocumentScreen } from './screens/BuilderScreen'
import { DocumentScreen } from './screens/DocumentScreen'
import { ContactScreen, CustomersScreen, StatementScreen } from './screens/CustomersScreen'
import { AnalyticsScreen } from './screens/AnalyticsScreen'
import { SettingsIndexScreen, SettingsPanelScreen } from './screens/SettingsScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

export interface AppProps {
  readonly repositories?: Repositories
  readonly companyId?: string
  /** Tests and stories drive the URL in memory; the app uses the address bar. */
  readonly router?: 'browser' | 'memory'
  readonly initialPath?: string
}

export function App({
  repositories,
  companyId = DEV_COMPANY_ID,
  router = 'browser',
  initialPath = HOME,
}: AppProps = {}) {
  const repos = useMemo(
    () => repositories ?? createMemoryRepositories(devState(companyId)),
    [repositories, companyId],
  )

  const tree = (
    <ProfileGate companyId={companyId} repositories={repos}>
      <AppRoutes />
    </ProfileGate>
  )

  return router === 'memory' ? (
    <MemoryRouter initialEntries={[initialPath]}>{tree}</MemoryRouter>
  ) : (
    <BrowserRouter>{tree}</BrowserRouter>
  )
}

/**
 * Loads the company far enough to know its region, then mounts the context the
 * screens read. Two providers, deliberately: the locale profile has to exist
 * before any screen resolves a word (Rule #4), and the records come after.
 */
function ProfileGate({
  companyId,
  repositories,
  children,
}: {
  companyId: string
  repositories: Repositories
  children: ReactNode
}) {
  return (
    <CompanyProvider companyId={companyId} repositories={repositories} profile={{ locale: 'EN-NG' }}>
      <AppDataProvider>
        <LocaleFromCompany companyId={companyId} repositories={repositories}>
          {children}
        </LocaleFromCompany>
      </AppDataProvider>
    </CompanyProvider>
  )
}

function LocaleFromCompany({
  companyId,
  repositories,
  children,
}: {
  companyId: string
  repositories: Repositories
  children: ReactNode
}) {
  const { company, loading, error } = useAppData()

  const profile = useMemo<LocaleProfile>(() => {
    if (company === null) return { locale: 'EN-NG' }
    try {
      return localeProfileOf({
        region: company.localeRegion,
        language: company.localeLanguage,
        labelOverrides: company.labelOverrides,
      })
    } catch {
      // An unrecognised saved region must not brick the app; Settings is the
      // screen that fixes it, and it has to render to be reachable (§D).
      return { locale: 'EN-NG' }
    }
  }, [company])

  // §S: a language with no catalogue throws rather than serving English under
  // another flag, so the profile's own language is used only when it exists.
  const language = company !== null && hasStringsFor(company.localeLanguage)
    ? company.localeLanguage
    : 'en'

  if (loading) return <LoadingPage />

  return (
    <CompanyProvider
      companyId={companyId}
      repositories={repositories}
      profile={profile}
      language={language}
    >
      {error === null ? children : <LoadError message={error} />}
    </CompanyProvider>
  )
}

function LoadingPage() {
  const { strings } = useCompany()
  return (
    <div className="px-4 py-6">
      <SkeletonList rows={4} label={strings.common.loading} />
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  const { strings } = useCompany()
  return (
    <div className="px-4 py-10">
      <EmptyState title={strings.nav.somethingWrong} body={message} />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {/* The builder and the welcome page are full-screen: no tab bar under a
          five-step flow, which §G gives its own ✕ and footer. */}
      <Route path="/welcome" element={<WelcomeScreen />} />
      <Route path="/new/:type" element={<NewDocumentScreen />} />
      <Route path="/edit/:id" element={<BuilderScreen />} />

      <Route element={<Shell />}>
        <Route path={HOME} element={<HomeScreen />} />
        <Route path="/list/:type" element={<ListScreen />} />
        <Route path="/doc/:id" element={<DocumentScreen />} />
        <Route path="/customers" element={<CustomersScreen />} />
        <Route path="/customers/:customerId" element={<ContactScreen />} />
        <Route path="/customers/:customerId/statement/:currency" element={<StatementScreen />} />
        <Route path="/analytics" element={<AnalyticsScreen />} />
        <Route path="/settings" element={<SettingsIndexScreen />} />
        <Route path="/settings/:panel" element={<SettingsPanelScreen />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

function NotFound() {
  const location = useLocation()
  // A mistyped settings panel belongs on the settings index, not on a dead end.
  if (location.pathname.startsWith('/settings/')) {
    return <Navigate to={`/settings/${SETTINGS_PANELS[0]}`} replace />
  }
  return <NotFoundBody />
}

function NotFoundBody() {
  const { strings } = useCompany()
  return (
    <div className="px-4 py-10">
      <EmptyState title={strings.nav.notFound} body={strings.nav.notFoundBody} />
    </div>
  )
}
