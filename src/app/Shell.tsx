/**
 * The app chrome around every route.
 *
 * §G gives Home the four type tiles that reach the lists, but Customers,
 * Business and Settings need an entry point of their own, so this is the
 * smallest one that works on a phone: four tabs, 44px tap targets, safe-area
 * padding at the bottom, and the current tab carrying `aria-current`.
 *
 * On a wide screen the SAME four destinations move to a left rail (§Q's
 * "sidebar"), and the bottom bar steps aside. That is the whole of it: one
 * navigation, rendered where the screen has room for it. A sidebar that
 * offered destinations the tab bar does not would be a second navigation to
 * keep in step, and the phone — which is the product — would be the one that
 * lost (Rule #1).
 *
 * Every label resolves through the language catalogue, and the tabs are pages
 * rather than document types, so no type name appears in this file.
 */

import { NavLink, Outlet } from 'react-router-dom'

import { useCompany } from './context'
import { useAnnouncedRoute } from './focus'
import { usePalette } from './PaletteHost'
import { navDestinations } from './destinations'
import { useWide } from './useWide'

const GLYPHS = ['⌂', '☺', '◔', '⚙']

export function Shell() {
  const { strings } = useCompany()
  const main = useAnnouncedRoute<HTMLElement>()
  const palette = usePalette()
  const wide = useWide()

  const tabs = navDestinations(strings).map((destination, index) => ({
    ...destination,
    glyph: GLYPHS[index] ?? '',
  }))

  return (
    <div className="min-h-screen bg-page text-ink">
      {/*
        ONE navigation, in the place the screen has room for. Rendering both
        and hiding one with CSS put two identically-named `<nav>`s in the DOM
        at the same time, which is a duplicate landmark anywhere the
        stylesheet is not the arbiter.
      */}
      {wide ? (
      <nav
        aria-label={strings.nav.sections}
        className="fixed bottom-0 start-0 top-0 z-10 flex w-60 flex-col gap-1 border-e border-edge/5 bg-surface/60 p-3"
      >
        <button
          type="button"
          onClick={palette.open}
          className="mb-2 flex min-h-tap items-center justify-between gap-2 rounded-xl bg-surface px-3 text-start text-sm font-medium"
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
                <span aria-hidden="true" className="text-base leading-none">
                  {tab.glyph}
                </span>
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
      <main ref={main} tabIndex={-1} className={`outline-none ${wide ? 'ps-60' : ''}`}>
        <Outlet />
      </main>

      {wide ? null : (
      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-edge/5 bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        // NOT `nav.home`: a landmark named after one of its own destinations
        // announces as "Home, navigation" and tells a reader nothing.
        aria-label={strings.nav.sections}
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => (
            <li key={tab.id} className="min-w-0 flex-1">
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
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
      )}
    </div>
  )
}
