/**
 * The app chrome around every route.
 *
 * §G gives Home the four type tiles that reach the lists, but Customers,
 * Business and Settings need an entry point of their own, so this is the
 * smallest one that works on a phone: four tabs, 44px tap targets, safe-area
 * padding at the bottom, and the current tab carrying `aria-current`. §V's
 * command palette and sidebar are a Phase 7 sweep and are not pre-empted here.
 *
 * Every label resolves through the language catalogue, and the tabs are pages
 * rather than document types, so no type name appears in this file.
 */

import { NavLink, Outlet } from 'react-router-dom'

import { useCompany } from './context'
import { ANALYTICS, CUSTOMERS, HOME, SETTINGS } from './paths'

export function Shell() {
  const { strings } = useCompany()

  const tabs = [
    { to: HOME, label: strings.nav.home, glyph: '⌂' },
    { to: CUSTOMERS, label: strings.nav.customers, glyph: '☺' },
    { to: ANALYTICS, label: strings.nav.business, glyph: '◔' },
    { to: SETTINGS, label: strings.nav.settings, glyph: '⚙' },
  ]

  return (
    <div className="min-h-screen bg-page text-navy">
      <Outlet />

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label={strings.nav.home}
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === HOME}
                className={({ isActive }) =>
                  `flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                    isActive ? 'text-brand' : 'opacity-60'
                  }`
                }
              >
                {/* NavLink sets aria-current="page" on the active link itself. */}
                <span aria-hidden="true" className="text-base leading-none">
                  {tab.glyph}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
