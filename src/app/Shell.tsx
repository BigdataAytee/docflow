/**
 * The app chrome around every route.
 *
 * §G gives Home the four type tiles that reach the lists, but Customers,
 * Business and Settings need an entry point of their own, so this is §F's
 * navigation "B", settled: "a floating glass pill, centred, above a soft
 * contact shadow. Four unlabelled icon tiles — Home, Customers, Analytics,
 * Settings — each with an accessible name in the active language. Active tile
 * lifts (`translateY(-4px)`), icon scales slightly, a short dark dash
 * beneath; press scales to 0.9."
 *
 * Unlabelled on SCREEN, never unlabelled to a reader. Each tile carries its
 * localised name in a visually-hidden span, so the accessible name is the
 * same word the palette and the sidebar use — which is also why the icon
 * itself is `aria-hidden` and says nothing (see `src/ui/Icon.tsx`).
 *
 * On a wide screen the SAME four destinations move to a left rail (§Q's
 * "sidebar"), and the pill steps aside. That is the whole of it: one
 * navigation, rendered where the screen has room for it — and on the rail the
 * labels come back, because there is room for them. A sidebar that offered
 * destinations the pill does not would be a second navigation to keep in
 * step, and the phone — which is the product — would be the one that lost
 * (Rule #1).
 *
 * Every label resolves through the language catalogue, and the tabs are pages
 * rather than document types, so no type name appears in this file.
 */

import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useCompany } from './context'
import { useAnnouncedRoute } from './focus'
import { usePalette } from './PaletteHost'
import { navDestinations } from './destinations'
import { useWide } from './useWide'
import { Icon, Orbs, applyGlass, glassFactsOf, wantsGlass, type IconName } from '../ui'

/**
 * The four glyphs, in the order `navDestinations` returns them.
 *
 * Positional, like the destinations themselves. A map keyed by `nav:home`
 * would look safer and be exactly as fragile — it is the same one list, and
 * the test pins the pairing either way.
 */
const NAV_ICONS: readonly IconName[] = ['home', 'users', 'chart-bar', 'settings']

export function Shell() {
  const { strings } = useCompany()
  const main = useAnnouncedRoute<HTMLElement>()
  const palette = usePalette()
  const wide = useWide()

  /*
   * §F's performance fallback. The two CSS-visible conditions answer
   * themselves in the stylesheet; this is only the device-memory one, and it
   * runs once on mount because a phone does not gain RAM while the app is
   * open.
   */
  useEffect(() => {
    const root = globalThis.document?.documentElement
    if (root === undefined || root === null) return
    applyGlass(root, wantsGlass(glassFactsOf(globalThis.navigator)))
  }, [])

  const tabs = navDestinations(strings).map((destination, index) => ({
    ...destination,
    icon: NAV_ICONS[index] ?? 'home',
  }))

  return (
    <div className="relative min-h-screen bg-page text-ink">
      {/* Behind everything, taking no taps and naming nothing (§F). */}
      <Orbs />

      {/*
        ONE navigation, in the place the screen has room for. Rendering both
        and hiding one with CSS put two identically-named `<nav>`s in the DOM
        at the same time, which is a duplicate landmark anywhere the
        stylesheet is not the arbiter.
      */}
      {wide ? (
        <nav
          aria-label={strings.nav.sections}
          className="fixed bottom-0 start-0 top-0 z-10 flex w-60 flex-col gap-1 border-e border-edge/5 bg-surface/60 p-3 backdrop-blur"
        >
          <button
            type="button"
            onClick={palette.open}
            className="recessed mb-2 flex min-h-tap items-center justify-between gap-2 rounded-xl px-3 text-start text-sm font-medium"
          >
            <span className="min-w-0 truncate opacity-70">{strings.palette.placeholder}</span>
            {/*
              The shortcut is DECORATION for a control that already has a name:
              read aloud, "Command K" between the label and the button role is
              noise, and the palette is reachable by this button, by the
              shortcut, and from Home's search field regardless.
            */}
            <span aria-hidden="true" className="shrink-0 rounded-md bg-ink/5 px-1.5 text-[11px]">
              ⌘K
            </span>
          </button>

          <ul className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <NavLink
                  to={tab.path}
                  end={tab.path === '/'}
                  className={({ isActive }) =>
                    `flex min-h-tap items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                      isActive ? 'bg-brand-tint text-brand' : 'opacity-70'
                    }`
                  }
                >
                  <Icon name={tab.icon} size={1.15} />
                  <span className="min-w-0 truncate">{tab.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/*
        `tabIndex={-1}` so a navigation can put focus here. Nothing else can:
        -1 keeps it out of the tab order, so a keyboard user never lands on
        the container itself while tabbing through the page.
      */}
      <main ref={main} tabIndex={-1} className={`relative z-[1] outline-none ${wide ? 'ps-60' : ''}`}>
        <Outlet />
      </main>

      {wide ? null : (
        <nav
          /*
            The bar spans the screen so the safe-area padding has something to
            push against, but takes no taps — only the pill inside it does.
            Without that, an invisible full-width strip sits over the bottom
            of every page and eats the FAB.
          */
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pt-2"
          data-safe-bottom
          // NOT `nav.home`: a landmark named after one of its own destinations
          // announces as "Home, navigation" and tells a reader nothing.
          aria-label={strings.nav.sections}
        >
          <ul className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <NavLink
                  to={tab.path}
                  end={tab.path === '/'}
                  className="tap-scale grid min-h-tap min-w-tap place-items-center rounded-full"
                >
                  {/* NavLink sets aria-current="page" on the active link itself. */}
                  {({ isActive }) => (
                    <span
                      className={`relative grid place-items-center motion-safe:transition-transform motion-safe:duration-150 ${
                        isActive ? '-translate-y-1 text-brand' : 'opacity-55'
                      }`}
                    >
                      <Icon name={tab.icon} size={isActive ? 1.45 : 1.3} />
                      {/*
                        §F's "short dark dash beneath". It is not decoration:
                        with no labels on screen it is half of how the active
                        tile says so, the colour change being the other half —
                        and colour alone is the thing §V will not accept.
                      */}
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-2 h-0.5 w-4 rounded-full bg-ink ${
                          isActive ? 'opacity-70' : 'opacity-0'
                        }`}
                      />
                      {/* Unlabelled on screen, never to a reader (§F). */}
                      <span className="sr-only">{tab.label}</span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
