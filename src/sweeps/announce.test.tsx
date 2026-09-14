/**
 * What a screen reader is told when the screen changes (§Q Phase 7, §V).
 *
 * The accessibility-tree sweep in `tools/sweeps/screenreader.ts` audits a page
 * standing still. This is the other half, and it is the half that bites: a
 * single-page app changes what is on screen without changing the page, so
 * unless something moves focus, a reader carries on reading the screen the
 * person has already left.
 *
 * These run in `npm test` rather than behind a browser, because focus is one
 * of the few things jsdom models faithfully — and because a regression here is
 * silent and needs to be blocking.
 */

import { useState } from 'react'

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from '../app/App'
import { VoidSheet } from '../features/documents/VoidSheet'
import { CompanyProvider } from '../app/context'
import { emptyState } from '../data/repositories'
import { money } from '../domain/money/money'
import { DEV_COMPANY_ID, devState } from '../app/seed'
import { createMemoryRepositories } from '../data/repositories'
import { stringsFor } from '../domain/locale/data/strings'

const strings = stringsFor('en')

function renderAt(path: string) {
  const state = devState()
  render(
    <App
      repositories={createMemoryRepositories(state)}
      companyId={DEV_COMPANY_ID}
      router="memory"
      initialPath={path}
    />,
  )
  return state
}

const main = () => document.querySelector('main')

describe('A navigation announces itself (§V)', () => {
  it('leaves focus alone on a cold load', async () => {
    renderAt('/')
    await screen.findByRole('main')

    // The reader is already announcing the document from the top. Grabbing
    // focus here would cut off the page title to say "main".
    expect(document.activeElement).toBe(document.body)
  })

  it('moves focus to the new page when a destination is chosen', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const nav = await screen.findByRole('navigation', { name: strings.nav.sections })

    await user.click(within(nav).getByRole('link', { name: strings.nav.settings }))

    await waitFor(() => expect(document.activeElement).toBe(main()))
  })

  it('puts the main landmark out of the tab order it is not part of', async () => {
    renderAt('/')
    const landmark = await screen.findByRole('main')
    // -1 is focusable programmatically and unreachable by Tab, which is the
    // whole point: a navigation can land here, a keyboard user never does.
    expect(landmark.getAttribute('tabindex')).toBe('-1')
  })

  it('names the navigation landmark after itself, not after a destination in it', async () => {
    renderAt('/')
    const nav = await screen.findByRole('navigation', { name: strings.nav.sections })
    // The bug this replaced: aria-label="Home" on a bar holding a Home link,
    // announced as "Home, navigation".
    expect(within(nav).getByRole('link', { name: strings.nav.home })).toBeInTheDocument()
    expect(nav.getAttribute('aria-label')).not.toBe(strings.nav.home)
  })
})

describe('Home reads as a page, not as a fragment (§V)', () => {
  it('opens at heading level 1', async () => {
    renderAt('/')
    const headings = await screen.findAllByRole('heading')
    expect(headings[0]?.tagName).toBe('H1')
  })

  it('says how many of each type there are, rather than running the two together', async () => {
    renderAt('/')
    // "Invoice" and "3" are separate spans, so the name computed from the
    // button's contents was "Invoice 3" — which is read as a reference.
    const tiles = await screen.findAllByRole('button', { name: /\d/ })
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) {
      expect(tile.getAttribute('aria-label')).not.toMatch(/^\S+ \d+$/)
    }
  })
})

describe('An opened panel takes focus (§V)', () => {
  function renderVoidSheet() {
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <button type="button">before</button>
        <VoidSheet
          document={{ id: 'doc_1', type: 'invoice', status: 'issued', currency: 'NGN', total: money('NGN', 100_00) }}
          payments={[]}
          onVoid={() => undefined}
          onCreditInstead={() => undefined}
          onClose={() => undefined}
        />
      </CompanyProvider>,
    )
  }

  it('lands focus on the panel, so its name is the next thing announced', async () => {
    renderVoidSheet()
    const panel = await screen.findByRole('region', { name: strings.voidIt.title })
    await waitFor(() => expect(document.activeElement).toBe(panel))
  })

  it('hands focus back to whatever had it, when that is still on the page', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <Opener />
      </CompanyProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)

    const panel = await screen.findByRole('region', { name: strings.voidIt.title })
    await waitFor(() => expect(document.activeElement).toBe(panel))

    // Closed from a DIFFERENT control, so "focus went back to the opener" and
    // "focus never moved off the thing just clicked" are distinguishable. The
    // first version of this test closed from the opener itself and passed
    // whether or not the hand-back existed at all.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    unmount()
  })

  it('is wired into every sheet in the app, including ones written later', () => {
    // A panel that appears without taking focus is silent, and the failure is
    // invisible to everyone who can see the screen. Cheaper to assert than to
    // rediscover: every *Sheet.tsx uses the hook.
    const roots = ['src/features', 'src/share']
    const sheets: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name.endsWith('Sheet.tsx')) sheets.push(path)
      }
    }
    for (const root of roots) walk(root)

    expect(sheets.length).toBeGreaterThan(5)
    for (const sheet of sheets) {
      expect(readFileSync(sheet, 'utf8'), `${sheet} opens without taking focus`).toContain(
        'useFocusOnOpen',
      )
    }
  })
})

/** A trigger that stays on the page while the panel it opens is up. */
function Opener() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
      {open && (
        <VoidSheet
          document={{ id: 'doc_1', type: 'invoice', status: 'issued', currency: 'NGN', total: money('NGN', 100_00) }}
          payments={[]}
          onVoid={() => undefined}
          onCreditInstead={() => undefined}
          onClose={() => undefined}
        />
      )}
    </>
  )
}
