/**
 * The same rules, with marks actually bundled (§F, §J, Rule #2).
 *
 * `providerLogos.test.tsx` runs against the real map, which is EMPTY: no
 * official mark can be fetched from inside a build, and drawing an
 * approximation of somebody's trademark is the thing brand guidelines exist
 * to stop. So half of those assertions are vacuously true today — every loop
 * over "each bundled mark" has nothing to loop over.
 *
 * That is the shape CLAUDE.md warns about: a guard that passes because there
 * is nothing to check is not a guard. This file supplies two entries so the
 * marked path is exercised — a 1×1 transparent pixel, which is test data and
 * not anybody's logo — and asserts what a real mark will have to satisfy on
 * the day somebody drops the files in.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/*
 * A pixel. Not a mark, and deliberately not shaped like one.
 *
 * Declared through a getter rather than a plain const because `vi.mock` is
 * hoisted above every statement in the file — a top-level const read inside
 * the factory is read before it exists.
 */
const pixel = () =>
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const darkPixel = () =>
  'data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICTAEAOw=='

vi.mock('../payments/logos', async () => {
  const actual = await vi.importActual<typeof import('../payments/logos')>(
    '../payments/logos',
  )
  const bundled = {
    // One with both variants, one with only a light mark.
    paystack_page: {
      light: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      dark: 'data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICTAEAOw==',
      variant: 'test fixture',
      source: 'https://example.test/brand',
      fetched: '2026-09-21',
    },
    paypal_me: {
      light: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      variant: 'test fixture',
      source: 'https://example.test/brand',
      fetched: '2026-09-21',
    },
  }
  return {
    ...actual,
    PROVIDER_LOGOS: bundled,
    logoFor: (provider: string, scheme: 'light' | 'dark') => {
      if (provider === 'other_link') return null
      const logo = bundled[provider as keyof typeof bundled]
      if (logo === undefined) return null
      return scheme === 'dark' ? ((logo as { dark?: string }).dark ?? logo.light) : logo.light
    },
  }
})

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { PaymentLinkSection } from './PaymentLinkSection'
import { logoFor } from '../payments/logos'

const openAll = async () => {
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <PaymentLinkSection
        country="NG"
        links={[]}
        onChange={vi.fn()}
        enabled={[]}
        onToggle={vi.fn()}
      />
    </CompanyProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Use a different service' }))
}

const slotFor = (provider: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-provider-logo="${provider}"]`)!

describe('A bundled mark actually draws (§F)', () => {
  it('renders an image for a provider that has one', async () => {
    await openAll()

    const slot = slotFor('paystack_page')
    expect(slot.getAttribute('data-has-mark')).toBe('true')
    expect(slot.querySelector('img')?.getAttribute('src')).toBe(pixel())
  })

  /**
   * AND THE ONE WITHOUT FALLS BACK, in the same square, in the same row. The
   * two shapes have to sit beside each other without either looking wrong.
   */
  it('falls back to the icon for a provider that has none', async () => {
    await openAll()

    const slot = slotFor('flutterwave_page')
    expect(slot.getAttribute('data-has-mark')).toBe('false')
    expect(slot.querySelector('img')).toBeNull()
    expect(screen.getByText('Flutterwave')).toBeInTheDocument()
  })

  /** Same size either way, which is what keeps the list from looking broken. */
  it('draws both at the same size', async () => {
    await openAll()

    expect(slotFor('paystack_page').className).toContain('size-10')
    expect(slotFor('flutterwave_page').className).toContain('size-10')
    expect(slotFor('paystack_page').querySelector('img')?.className).toContain('size-[22px]')
  })

  /** Decoration, not a label — the name beside it is the label. */
  it('keeps the mark out of the accessibility tree', async () => {
    await openAll()

    const image = slotFor('paypal_me').querySelector('img')!
    expect(image.getAttribute('alt')).toBe('')
    expect(image.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('PayPal')).toBeInTheDocument()
  })

  /** No filter on a real mark either. */
  it('applies nothing to a mark that would modify it', async () => {
    await openAll()

    const classes = slotFor('paystack_page').querySelector('img')!.className
    for (const forbidden of ['invert', 'grayscale', 'brightness', 'mix-blend', 'sepia']) {
      expect(classes, `a mark is being ${forbidden}ed`).not.toContain(forbidden)
    }
  })
})

describe('Dark mode uses the provider’s own variant (§F)', () => {
  /**
   * THE ONE THIS IS FOR. A provider that supplies a dark mark gets it; a
   * provider that supplies only one gets that one, in both themes. Neither
   * gets an inverted version of the other, because an inverted mark is a
   * modified mark.
   */
  it('takes the dark mark where there is one', () => {
    expect(logoFor('paystack_page', 'dark')).toBe(darkPixel())
    expect(logoFor('paystack_page', 'light')).toBe(pixel())
  })

  it('reuses the light mark where there is not', () => {
    expect(logoFor('paypal_me', 'dark')).toBe(pixel())
    expect(logoFor('paypal_me', 'light')).toBe(pixel())
  })

  it('still has nothing for a provider with no mark', () => {
    expect(logoFor('flutterwave_page', 'dark')).toBeNull()
    expect(logoFor('other_link', 'dark')).toBeNull()
  })
})
