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
import { useAnnouncedRoute } from './focus'
import { ANALYTICS, CUSTOMERS, HOME, SETTINGS } from './paths'

export function Shell() {
  const { strings } = useCompany()
  const main = useAnnouncedRoute<HTMLElement>()

  const tabs = [
    { to: HOME, label: strings.nav.home, glyph: '⌂' },
    { to: CUSTOMERS, label: strings.nav.customers, glyph: '☺' },
    { to: ANALYTICS, label: strings.nav.business, glyph: '◔' },
    { to: SETTINGS, label: strings.nav.settings, glyph: '⚙' },
  ]

  return (
    <div className="min-h-screen bg-page text-ink">
      {/*
        The main landmark. Without it "browse by landmark" — the way a screen
        reader user skips the chrome — found the tab bar and nothing else on
        every route in the app, and every control on the page answered to no
        landmark at all. The builder is outside this layout and carries its
        own main, so there is still exactly one per page.
      */}
      {/*
        `tabIndex={-1}` so a navigation can put focus here. Nothing else can:
        -1 keeps it out of the tab order, so a keyboard user never lands on
        the container itself while tabbing through the page.
      */}
      <main ref={main} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-edge/5 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        // NOT `nav.home`: a landmark named after one of its own destinations
        // announces as "Home, navigation" and tells a reader nothing.
        aria-label={strings.nav.sections}
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => (
            <li key={tab.to} className="min-w-0 flex-1">
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
                {/*
                  Truncated, not shortened: at 200% text four labels held the
                  bar 10px wider than the phone. The full word stays in the
                  DOM, so the accessible name a screen reader announces is
                  unchanged — it is the visible glyph that gives way, which is
                  the right way round (§V).
                */}
                <span className="w-full truncate text-center">{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
