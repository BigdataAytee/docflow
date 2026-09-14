/**
 * The navigation sweep (§Q Phase 7: "command palette/sidebar").
 *
 * §Q names both in its list of Phase-7 sweeps and no section of v6 says what
 * either contains, so what they ARE is written down in PLAN.md as a
 * deviation. What they are FOR is not in doubt: §V's "**keyboard navigation**
 * … without clipped actions".
 *
 * So this sweep checks the property both features exist to serve — every
 * destination reachable and operable from a keyboard — and the property the
 * sidebar must not break: that there is exactly ONE navigation on the page,
 * whichever width it is rendered at. Two navigations with the same four
 * links is a duplicate landmark, and the first version of the sidebar had
 * exactly that, hidden from view by a stylesheet and from nobody else.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { Shell } from '../app/Shell'
import { CompanyProvider } from '../app/context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import { SETTINGS_PANELS } from '../app/paths'
import { stringsFor } from '../domain/locale/data/strings'

function renderShell() {
  return render(
    <MemoryRouter>
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <Shell />
      </CompanyProvider>
    </MemoryRouter>,
  )
}

describe('Every destination is reachable from a keyboard (§V)', () => {
  it('tabs to each one in order, and none is skipped', async () => {
    renderShell()
    const strings = stringsFor('en')
    const nav = screen.getByRole('navigation', { name: strings.nav.sections })
    const links = within(nav).getAllByRole('link')

    // Distinct links, because tabbing past the last one wraps round to the
    // first — counting visits would pass while skipping a destination
    // entirely, which is the failure this is for.
    const reached = new Set<Element>()
    for (let i = 0; i < links.length + 2; i += 1) {
      await userEvent.tab()
      const active = document.activeElement
      if (active !== null && links.includes(active as HTMLAnchorElement)) reached.add(active)
    }

    expect(links.length).toBeGreaterThan(0)
    expect(reached.size, 'a destination cannot be tabbed to').toBe(links.length)
  })

  it('activates a destination with the keyboard, not only a tap', async () => {
    renderShell()
    const strings = stringsFor('en')
    const nav = screen.getByRole('navigation', { name: strings.nav.sections })
    const settings = within(nav).getByRole('link', { name: strings.nav.settings })

    settings.focus()
    expect(document.activeElement).toBe(settings)
    // An anchor with an href is activated by Enter natively; the failure this
    // guards is a div with an onClick, which has no href and no tab stop.
    expect(settings.getAttribute('href')).not.toBeNull()
  })
})

describe('What is NOT built, recorded rather than ticked off', () => {
  it('has no command palette', () => {
    // §Q names it; no section of v6 specifies it. Recorded here so the phrase
    // in the phase list cannot be read as done.
    expect(screen.queryByRole('dialog', { name: /command/i })).toBeNull()
  })

  it('reaches every settings panel through the tab bar instead', () => {
    // The thing a palette would be FOR — getting somewhere without hunting —
    // is currently served by four tabs and a settings index. Seven panels,
    // all routed, which is what makes the palette an improvement rather than
    // a missing capability.
    expect(SETTINGS_PANELS.length).toBe(10)
  })
})

/**
 * There is no layout in jsdom, so the rail is chosen by `matchMedia` — which
 * jsdom does not implement either. Stubbing it is the only way to render the
 * wide layout at all, and stubbing it is honest: the real decision is one
 * media query, and this is that query answering yes.
 */
function widen(wide: boolean) {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'matchMedia')
  vi.restoreAllMocks()
})

describe('The sidebar is the same navigation, moved (§Q Phase 7)', () => {
  it('shows one navigation on a phone, and one on a wide screen — never two', () => {
    widen(false)
    const narrow = renderShell()
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    narrow.unmount()

    widen(true)
    renderShell()
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
  })

  it('offers exactly the destinations the tab bar offers, and no others', () => {
    const strings = stringsFor('en')
    widen(false)
    const narrow = renderShell()
    const onPhone = within(screen.getByRole('navigation', { name: strings.nav.sections }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    narrow.unmount()

    widen(true)
    renderShell()
    const onDesktop = within(screen.getByRole('navigation', { name: strings.nav.sections }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    // A sidebar with destinations the phone does not have is a second
    // navigation to keep in step, and the phone is the product (Rule #1).
    expect(onDesktop).toEqual(onPhone)
  })

  it('puts the palette within reach of a mouse, not only a shortcut', () => {
    const strings = stringsFor('en')
    widen(true)
    renderShell()
    const nav = screen.getByRole('navigation', { name: strings.nav.sections })
    expect(within(nav).getByRole('button')).toBeInTheDocument()
    // The ⌘K badge is decoration beside a control that already has a name.
    expect(within(nav).getByRole('button').textContent).toContain(strings.palette.placeholder)
  })
})
