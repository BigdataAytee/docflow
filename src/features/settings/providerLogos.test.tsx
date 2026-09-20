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
import { PROVIDER_LOGOS, logoFor, variantFor } from '../../domain/payments/logos'
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
      expect(slot.className, 'a slot is a different size from its neighbours').toContain('size-9')
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
      expect(logo.source, `${id} does not say where it came from`).toMatch(/^https:\/\//)
      expect(logo.fetched, `${id} does not say when it was fetched`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
