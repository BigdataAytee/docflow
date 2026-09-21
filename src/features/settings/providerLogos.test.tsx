/**
 * Provider marks in the settings list (§F, §J, Rule #2).
 *
 * A trader scanning "How you get paid" recognises a mark faster than a word.
 * Almost everything asserted here is about the conditions on doing that at
 * all: these are other people's trademarks, and a mark used outside its
 * owner's guidelines is this app's problem rather than the trader's.
 *
 *  · BUNDLED, NEVER FETCHED. A logo that needs the network is a logo that is
 *    missing in the market this app is built for (Rule #2).
 *  · NEVER RECOLOURED. The provider's own dark variant where they supply
 *    one; their light one otherwise. An inverted or filtered mark is a
 *    modified mark.
 *  · ABSENT IS A WORKING STATE. Most of these have no file yet — nobody can
 *    fetch them from inside a build — so the row falling back cleanly to its
 *    name is the behaviour that ships, not a degraded one.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { PaymentLinkSection } from './PaymentLinkSection'
import { PROVIDER_LOGOS, logoFor, variantFor } from '../payments/logos'
import { ALL_PROVIDERS } from '../../domain/payments/providers'
import type { ProviderId } from '../../domain/payments/providers'

const list = (country = 'NG') =>
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <PaymentLinkSection
        country={country}
        links={[]}
        onChange={vi.fn()}
        enabled={[]}
        onToggle={vi.fn()}
      />
    </CompanyProvider>,
  )

const slots = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[data-provider-logo]'),
]

describe('Every provider gets a slot, marked or not (§F)', () => {
  /**
   * THE SLOT IS THE POINT. A row without a mark must not be shorter, or
   * emptier, or narrower than its neighbours — a missing logo has to look
   * deliberate, because for most of these it is.
   */
  it('gives every row the same square slot', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    expect(slots().length).toBe(ALL_PROVIDERS.length)
    for (const slot of slots()) {
      expect(slot.className, 'a slot is a different size from its neighbours').toContain('size-10')
    }
  })

  /**
   * AND THE NAME IS STILL THE LABEL. Nothing about a row's meaning lives in
   * the image, which is what makes the fallback free rather than a
   * degradation.
   */
  it('reads the name whether or not there is a mark', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const provider of ALL_PROVIDERS) {
      expect(screen.getByText(provider.name), `${provider.id} lost its name`).toBeInTheDocument()
    }
  })

  /**
   * A mark is DECORATION beside the name, never instead of it: a screen
   * reader announcing "PayPal PayPal" is worse than one announcing it once.
   */
  it('hides the mark from a screen reader', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const image of document.querySelectorAll('[data-provider-logo] img')) {
      expect(image.getAttribute('alt')).toBe('')
      expect(image.getAttribute('aria-hidden')).toBe('true')
    }
  })

  /** "Other link" is the escape hatch, not a provider, and never carries one. */
  it('never gives the escape hatch a mark', () => {
    expect(logoFor('other_link', 'light')).toBeNull()
    expect(logoFor('other_link', 'dark')).toBeNull()
  })
})

describe('Nothing about a mark touches the network (Rule #2)', () => {
  /**
   * THE ONE THIS IS FOR. Every entry is a bundled module import, so a mark
   * renders in airplane mode like every other asset. A `https://` in here
   * would be a logo that is missing in the market this app is built for.
   */
  it.each(['light', 'dark'] as const)('resolves %s marks to a local asset', (scheme) => {
    for (const provider of ALL_PROVIDERS) {
      const mark = logoFor(provider.id, scheme)
      if (mark === null) continue
      expect(mark, `${provider.id} points at a remote host`).not.toMatch(/^https?:\/\//)
      expect(mark, `${provider.id} points at a protocol-relative host`).not.toMatch(/^\/\//)
    }
  })

  it('renders no image with a remote source', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const image of document.querySelectorAll('[data-provider-logo] img')) {
      expect(image.getAttribute('src') ?? '').not.toMatch(/^https?:\/\//)
    }
  })
})

describe('A mark is never modified (§F)', () => {
  /**
   * NO FILTER, NO INVERT, NO BLEND. Each of those produces a modified mark,
   * and every set of brand guidelines forbids modifying the mark. Dark mode
   * is served by the provider's OWN dark variant, or by their light one.
   */
  it('applies no filter to any mark', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const image of document.querySelectorAll('[data-provider-logo] img')) {
      const classes = image.className
      for (const forbidden of ['invert', 'grayscale', 'brightness', 'mix-blend', 'sepia']) {
        expect(classes, `a mark is being ${forbidden}ed`).not.toContain(forbidden)
      }
    }
  })

  /**
   * THE DARK RULE ITSELF, against two literals.
   *
   * This was asserted through a test that mocked the whole logos module, so
   * it was checking the mock's copy of the rule and not the rule: breaking
   * the real one left it green. `variantFor` exists to be testable without a
   * bundle, because the bundle is empty until somebody visits ten brand
   * pages.
   */
  it('takes the provider’s dark mark where there is one', () => {
    expect(
      variantFor(
        { light: 'l.svg', dark: 'd.svg', variant: 'x', source: 'https://x.test', fetched: '2026-09-21' },
        'dark',
      ),
      'a provider supplied a dark mark and it was not used',
    ).toBe('d.svg')
  })

  it('reuses the light mark rather than altering it', () => {
    const onlyLight = {
      light: 'l.svg',
      variant: 'x',
      source: 'https://x.test',
      fetched: '2026-09-21',
    }
    expect(variantFor(onlyLight, 'dark')).toBe('l.svg')
    expect(variantFor(onlyLight, 'light')).toBe('l.svg')
  })

  /** And whatever is really bundled obeys it. */
  it('obeys the same rule for every bundled mark', () => {
    for (const [id, logo] of Object.entries(PROVIDER_LOGOS)) {
      if (logo === undefined) continue
      expect(logoFor(id as ProviderId, 'dark'), id).toBe(variantFor(logo, 'dark'))
      expect(logoFor(id as ProviderId, 'light'), id).toBe(variantFor(logo, 'light'))
    }
  })

  /** Every bundled mark records where it came from, so it can be re-checked. */
  it('records the variant, the source and the date for every mark', () => {
    for (const [id, logo] of Object.entries(PROVIDER_LOGOS)) {
      if (logo === undefined) continue
      expect(logo.variant.length, `${id} does not say which variant it is`).toBeGreaterThan(3)
      expect(logo.source.length, `${id} does not say where it came from`).toBeGreaterThan(10)
      // And the owner's own guidelines page, where they publish one.
      if (logo.guidelines !== undefined) {
        expect(logo.guidelines, `${id}'s guidelines link is not a URL`).toMatch(/^https:\/\//)
      }
      expect(logo.fetched, `${id} does not say when it was fetched`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

/**
 * The row, as the reference lays it out (§F, §G).
 *
 * Left to right: a 40px round badge, the name with one muted line under it,
 * the state in a word, a chevron — and the whole row is the button.
 */
describe('One row, one tap target (§F)', () => {
  const rows = () =>
    screen.queryAllByRole('button').filter((b) => /\. .+\. (Add|On|Off)$/.test(b.getAttribute('aria-label') ?? ''))

  it('makes the whole row the control', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    expect(rows().length).toBe(ALL_PROVIDERS.length)
    for (const row of rows()) {
      // The badge is inside the button, so the badge is not its own target.
      expect(row.querySelector('[data-provider-logo]'), 'the badge sits outside the row').not.toBeNull()
      // And nothing else in the row competes for the tap.
      expect(
        row.querySelectorAll('button').length,
        `${row.getAttribute('aria-label')} has a control inside the row`,
      ).toBe(0)
    }
  })

  /**
   * THE NAME READS AS THREE FACTS. Left to the DOM it runs together —
   * "PaystackPaste your Paystack page linkAdd" — because nothing between the
   * spans is a space.
   */
  it('names each row as service, detail, state', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    const paypal = screen.getByRole('button', { name: /^PayPal\./ })
    expect(paypal.getAttribute('aria-label')).toBe('PayPal. Paste your PayPal.me link. Add')
  })

  /** Every provider carries a one-line subtitle worth reading. */
  it('gives every provider a subtitle', () => {
    for (const provider of ALL_PROVIDERS) {
      expect(provider.blurb.length, `${provider.id} has no subtitle`).toBeGreaterThan(8)
      expect(provider.blurb, `${provider.id} repeats its own name`).not.toBe(provider.name)
    }
  })

  /**
   * AND IT SURVIVES 200% TEXT. §G's a11y floor: the name and the state stay
   * readable rather than being truncated away, so the row still says which
   * service it is and whether it prints.
   */
  it('keeps the name and the state un-truncated at any text size', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const row of rows()) {
      const [name, state] = [
        row.querySelector('.font-medium'),
        row.querySelector('[data-provider-state]'),
      ]
      expect(name?.className, 'the name is clipped').not.toContain('truncate')
      expect(state?.className, 'the state is clipped').not.toContain('truncate')
      // The subtitle may truncate — a pasted link can be any length.
      expect(state?.className).toContain('shrink-0')
    }
  })
})

/**
 * Dark mode keeps the tile, never the filter (§F).
 *
 * These marks are single-colour brand glyphs in their owner's own hex —
 * Monzo's navy and Revolut's near-black vanish on a dark surface. So the
 * circle stays light and the mark keeps its colour, which is what the
 * guidelines contemplate. Recolouring one to suit our background is
 * modifying it.
 */
describe('The tile stays light in dark mode (§F)', () => {
  it('holds a light tile behind every mark', async () => {
    const user = userEvent.setup()
    list()
    await user.click(screen.getByRole('button', { name: 'Use a different service' }))

    for (const slot of slots()) {
      expect(slot.className, 'the tile follows the theme instead of staying light').toContain(
        'bg-logo-tile',
      )
      // Nothing that would flip or tint it in the dark.
      for (const forbidden of ['dark:bg-', 'dark:invert', 'invert']) {
        expect(slot.className, `the tile is ${forbidden} in dark mode`).not.toContain(forbidden)
      }
    }
  })
})

/**
 * A mark from the provider's own brand page (§F, §J).
 *
 * Paystack's is the only entry not redrawn from a glyph set — it is their own
 * file, from their own site. Asserted because the distinction is the whole
 * basis on which any of these may be shown at all: a glyph somebody traced
 * and a mark its owner published are different things to have on screen.
 */
describe('Paystack carries its own mark (§F)', () => {
  it('is bundled, and says whose it is', () => {
    const logo = PROVIDER_LOGOS['paystack_page']
    expect(logo, 'Paystack fell back to a letter').toBeDefined()
    expect(logo?.source, 'the mark is not attributed to Paystack').toMatch(/Paystack/i)
    expect(logo?.guidelines, 'no guidelines page to re-check').toMatch(/^https:\/\//)
  })

  it('draws rather than lettering', () => {
    expect(logoFor('paystack_page', 'light')).not.toBeNull()
    expect(logoFor('paystack_page', 'dark')).not.toBeNull()
  })

  /**
   * AND THE ONES STILL MISSING FALL BACK, which is the state PLAN.md
   * records. Named individually so this test fails the day one is added
   * without its provenance — a silent half-wiring is the thing to catch.
   */
  it.each(['flutterwave_page', 'mtn_momo', 'mpesa', 'wave', 'opay', 'palmpay'] as const)(
    'leaves %s on its lettered badge until a file arrives',
    (id) => {
      expect(logoFor(id, 'light'), `${id} has a mark now — record its provenance`).toBeNull()
    },
  )
})
