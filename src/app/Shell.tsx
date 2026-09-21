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

export interface ShellProps {
  /**
   * Whether this route carries primary navigation.
   *
   * Decided by the ROUTE GROUP in `App.tsx`, which is built from
   * `ROOT_DESTINATIONS` — so the answer is written down once and this
   * component never asks what page it is on. A shell that inspected the
   * pathname would be the same conditional, moved somewhere harder to find.
   *
   * `false` means ABSENT, not hidden: no element, no layout space, nothing
   * for a detail screen's own controls to sit under.
   */
  readonly nav?: boolean
}

export function Shell({ nav = true }: ShellProps) {
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

  /*
   * TAPPING THE TAB YOU ARE ALREADY ON DOES NOT STACK A DUPLICATE, and
   * nothing here has to arrange that.
   *
   * `replace={current}` was added on the assumption that `Link` always
   * pushes. It does not: React Router's own click handler computes
   * `replace ?? createPath(location) === createPath(to)`, so a link to the
   * location you are already at replaces by default. The prop was removed
   * once the mutation proved it — deleting it changed no behaviour, which
   * means it was decoration that read as load-bearing.
   *
   * The guard in `routes.test.tsx` stays. It pins the BEHAVIOUR against a
   * real browser router, so if that default ever changes the app finds out.
   */
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
      {nav && wide ? (
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
                      isActive ? 'bg-brand-tint text-brand-ink' : 'opacity-70'
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
      {/*
        The rail's inset goes with the rail. Keeping `ps-60` on a detail page
        that draws no rail would leave a 15rem strip of nothing down the side
        of the content — the desktop version of exactly the gap this change
        exists to remove.
      */}
      <main
        ref={main}
        tabIndex={-1}
        className={`relative z-[1] outline-none ${nav && wide ? 'ps-60' : ''}`}
      >
        <Outlet />
      </main>

      {!nav || wide ? null : (
        <nav
          /*
            The bar spans the screen so the safe-area padding has something to
            push against, but takes no taps — only the pill inside it does.
            Without that, an invisible full-width strip sits over the bottom
            of every page and eats the FAB.
          */
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2"
          // NOT `nav.home`: a landmark named after one of its own destinations
          // announces as "Home, navigation" and tells a reader nothing.
          aria-label={strings.nav.sections}
        >
          {/*
            §F: the pill sits "above a soft contact shadow", and in the
            prototype that shadow is a SEPARATE blurred ellipse rather than
            another `box-shadow` on the pill. It has to be: a box-shadow
            follows the pill's own rounded-rectangle outline, and what the
            design wants is the wider, softer pool an object casts on the
            surface it hovers over. Decorative, and behind the pill.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 start-0 end-0 mx-auto h-[17px] w-[72%] rounded-[50%] blur-lg"
            style={{ backgroundImage: 'radial-gradient(ellipse, rgba(13,16,36,.34), transparent 70%)' }}
          />

          <ul className="glass-nav pointer-events-auto relative flex items-center gap-[7px] rounded-full px-3 py-[9px]">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <NavLink
                  to={tab.path}
                  end={tab.path === '/'}
                  className="flex min-h-tap min-w-tap items-center justify-center rounded-2xl"
                >
                  {/* NavLink sets aria-current="page" on the active link itself. */}
                  {({ isActive }) => (
                    <span
                      /*
                        Each destination is its own raised TILE inside the
                        pill — the prototype's 52x46 rounded-16 button with a
                        lit top edge — not a bare icon on the glass. That is
                        what gives the active one something to lift out of.
                      */
                      className="nav-tile relative grid h-[46px] w-[52px] place-items-center rounded-2xl"
                      style={{
                        backgroundImage:
                          'linear-gradient(180deg, var(--nav-tile-a), var(--nav-tile-b))',
                        border: '1px solid var(--nav-border)',
                        color: isActive
                          ? 'var(--nav-tile-ink-active)'
                          : 'var(--nav-tile-ink)',
                        boxShadow: isActive
                          ? 'var(--nav-tile-shadow-active)'
                          : 'var(--nav-tile-shadow)',
                        ...(isActive ? { transform: 'translateY(-4px)' } : {}),
                      }}
                    >
                      <span
                        className="nav-tile-icon grid place-items-center"
                        style={isActive ? { transform: 'scale(1.12)' } : undefined}
                      >
                        <Icon name={tab.icon} size={1.375} />
                      </span>
                      {/*
                        §F's "short dark dash beneath". It is not decoration:
                        with no labels on screen it is half of how the active
                        tile says so, the colour change being the other half —
                        and colour alone is the thing §V will not accept.
                      */}
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1.5 start-0 end-0 mx-auto h-[3px] w-4 rounded-full ${
                          isActive ? 'opacity-85' : 'opacity-0'
                        }`}
                        style={{ backgroundColor: 'var(--nav-tile-ink-active)' }}
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
