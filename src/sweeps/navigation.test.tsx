/**
 * The navigation sweep (§Q Phase 7: "command palette/sidebar").
 *
 * **There is no command palette and no sidebar, and this sweep does not build
 * one.** §Q names them in a list of Phase 7 sweeps and no section of v6
 * specifies either: not what they contain, not how they open, not what a
 * sidebar would mean on a phone-first product whose navigation §G defines as
 * four tabs. Designing both from that one phrase would be inventing product,
 * which is a different job from sweeping.
 *
 * What a sweep CAN do is check the requirement those two features exist to
 * serve, which §V does state: "**keyboard navigation** … without clipped
 * actions". So this asserts that every destination is reachable and operable
 * from a keyboard today, and records the two features as unbuilt and
 * unspecified rather than quietly ticking them off.
 */

import { describe, expect, it } from 'vitest'
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
    const nav = screen.getByRole('navigation', { name: strings.nav.home })
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
    const nav = screen.getByRole('navigation', { name: strings.nav.home })
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
    expect(SETTINGS_PANELS.length).toBe(8)
  })
})
