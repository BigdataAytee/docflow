/**
 * The glass layer's invariants (§F).
 *
 * §F is Locked, and three of its clauses are the kind that decay silently:
 * the icon pairings (an icon that does not exist renders an empty square, and
 * nothing fails), the performance fallback (it is invisible until it is
 * needed, on a phone nobody in this repo is holding), and "never intercepting
 * taps" (an orb that starts eating taps looks exactly the same in a
 * screenshot). Each one is pinned here.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES } from '../domain/documents/types'
import { ICON_NAMES, Icon } from './Icon'
import { Orbs } from './Orbs'
import { NO_GLASS_CLASS, applyGlass, glassFactsOf, wantsGlass } from './glass'
import { TYPE_PALETTE } from './tokens'

describe('The bundled icon set (§F)', () => {
  it('draws at least one path for every name it offers', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      expect(container.querySelectorAll('path').length, `${name} draws nothing`).toBeGreaterThan(0)
      unmount()
    }
  })

  it('can draw the glyph §F fixes to each internal type', () => {
    // §F names four pairings — invoice `file-invoice`, quotation `file-check`,
    // receipt `receipt`, delivery `truck-delivery`. The palette holds them;
    // this is the half that proves the set can actually render them.
    for (const type of DOCUMENT_TYPES) {
      expect(ICON_NAMES, `${type}'s icon is not in the set`).toContain(TYPE_PALETTE[type].icon)
    }
  })

  it('names nothing, because the control around it does (§D)', () => {
    // An icon with its own accessible name is a name that cannot be
    // translated — the exact failure §D exists to prevent.
    const { container } = render(<Icon name="home" />)
    const svg = container.querySelector('svg')

    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.querySelector('title')).toBeNull()
  })

  it('scales with the text beside it rather than in fixed pixels', () => {
    // A 24px icon next to 200% text is what the large-text sweep keeps
    // finding. `em` is the whole fix, so it is worth pinning.
    const { container } = render(<Icon name="home" size={1.5} />)

    expect(container.querySelector('svg')?.getAttribute('width')).toBe('1.5em')
  })
})

describe("§F's performance fallback", () => {
  it('keeps the glass on a phone with enough memory', () => {
    expect(wantsGlass({ deviceMemoryGb: 4 })).toBe(true)
  })

  it('drops it below the tier §N calls the realistic market phone', () => {
    expect(wantsGlass({ deviceMemoryGb: 2 })).toBe(false)
  })

  it('treats silence as capable, not as weak', () => {
    // `deviceMemory` is Chromium-only. Reading its absence as "too slow"
    // would strip §F's design from every iPhone.
    expect(wantsGlass({})).toBe(true)
    expect(glassFactsOf(undefined)).toEqual({})
  })

  it('ignores a value that is not a number', () => {
    const navigator = { deviceMemory: 'lots' } as unknown as Navigator

    expect(glassFactsOf(navigator)).toEqual({})
  })

  it('takes the class off again, so the setting can be changed back', () => {
    const root = document.createElement('html')

    applyGlass(root, false)
    expect(root.classList.contains(NO_GLASS_CLASS)).toBe(true)

    applyGlass(root, true)
    expect(root.classList.contains(NO_GLASS_CLASS)).toBe(false)
  })
})

describe('The ambient orbs (§F)', () => {
  it('draws one per document type', () => {
    const { container } = render(<Orbs />)

    expect(container.querySelectorAll('.orb')).toHaveLength(DOCUMENT_TYPES.length)
  })

  it('intercepts no taps and announces nothing', () => {
    // §F: "decorative only, never intercepting taps". `pointer-events: none`
    // lives in the stylesheet, so what is checked here is the contract this
    // component is responsible for — the hook the rule is written against.
    const { container } = render(<Orbs />)
    const orbs = container.querySelector('.orbs')

    expect(orbs?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
