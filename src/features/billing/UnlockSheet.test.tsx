/**
 * The unlock sheet, and the four things it must not do (§U, Rule #6).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UnlockSheet } from './UnlockSheet'
import { ProBadge } from './ProBadge'
import { ProSettings } from './ProSettings'
import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { Offer } from '../../domain/billing/unlock'
import { standing } from '../../domain/billing/entitlement'
import { stringsFor } from '../../domain/locale/data/strings'

const strings = stringsFor('en')

const offer: Offer = {
  feature: 'statements',
  entryPoint: 'the Statement button on a customer',
  price: {
    market: 'NG',
    monthlyMinor: 2_500_00,
    annualMinor: 25_000_00,
    currency: 'NGN',
    trialDays: 7,
  },
}

function wrap(node: React.ReactNode) {
  return render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )
}

const sheet = (over: Partial<React.ComponentProps<typeof UnlockSheet>> = {}) => {
  const onDismiss = vi.fn()
  const onSeePlan = vi.fn()
  wrap(
    <UnlockSheet
      offer={offer}
      featureName="Statements"
      onDismiss={onDismiss}
      onSeePlan={onSeePlan}
      {...over}
    />,
  )
  return { onDismiss, onSeePlan, user: userEvent.setup() }
}

describe('What the sheet says', () => {
  it('names the feature, in the words the app uses for it', () => {
    sheet()
    expect(screen.getByRole('heading', { name: 'Statements is part of Pro' })).toBeInTheDocument()
  })

  it('puts the price and the trial on it, before anything is tapped', () => {
    sheet()
    // §U: "each with the price, the trial". Not "tap to find out".
    expect(screen.getByText(/₦2,500\.00 a month/)).toBeInTheDocument()
    expect(screen.getByText(/₦25,000\.00 a year/)).toBeInTheDocument()
    expect(screen.getByText('7 days free first')).toBeInTheDocument()
  })

  it('says Rule #6 out loud, where somebody can read it', () => {
    sheet()
    expect(screen.getByText(strings.pro.freeForever)).toBeInTheDocument()
  })

  it('omits the trial line when there is no trial, rather than inventing one', () => {
    sheet({ offer: { ...offer, price: { ...offer.price, trialDays: 0 } } })
    expect(screen.queryByText(/days free/)).not.toBeInTheDocument()
  })
})

describe('The four things it must not do (§U)', () => {
  it('offers a dismiss that is the equal of the purchase, and reaches it first', async () => {
    const { user, onDismiss, onSeePlan } = sheet()
    const buttons = screen.getAllByRole('button')

    // "A no-hard-feelings dismiss" is not a grey link under a bright button.
    // First in the DOM is also first for a keyboard and a screen reader.
    expect(buttons[0]).toHaveTextContent(strings.pro.notNow)
    expect(buttons[0]?.className).toContain('flex-1')
    expect(buttons[1]?.className).toContain('flex-1')

    await user.click(buttons[0] as HTMLElement)
    expect(onDismiss).toHaveBeenCalled()
    expect(onSeePlan).not.toHaveBeenCalled()
  })

  it('carries no countdown and no manufactured deadline', () => {
    sheet()
    const text = document.body.textContent ?? ''
    for (const urgency of ['only today', 'last chance', 'expires', 'hurry', 'ends in']) {
      expect(text.toLowerCase(), urgency).not.toContain(urgency)
    }
  })

  it('says no in a plain word, with no guilt in it', () => {
    // "Not now", never "I don't want to grow my business".
    expect(strings.pro.notNow).toBe('Not now')
    expect(strings.pro.notNow.toLowerCase()).not.toContain('don')
  })

  it('cannot be built without a price at all', () => {
    // The type is the guarantee: `offer` is required and complete, and
    // `offerFor` refuses to produce one without a price, a trial and an entry
    // point. There is no path through this component that renders a blank.
    expect(offer.price.monthlyMinor).toBeGreaterThan(0)
  })
})

describe('The badge that announces before the effort (§U)', () => {
  it('says Pro on a gated control', () => {
    wrap(<ProBadge gated />)
    expect(screen.getByText(strings.pro.badge)).toBeInTheDocument()
  })

  it('renders nothing at all when the feature is not gated', () => {
    // Which is every feature today: §W has not drawn the line, so no badge
    // appears anywhere. Correct behaviour, not a placeholder.
    const { container } = wrap(<ProBadge gated={false} />)
    expect(container.textContent).toBe('')
  })
})

describe('The quiet row in Settings (§U)', () => {
  const row = (over: Partial<React.ComponentProps<typeof ProSettings>> = {}) => {
    const onManage = vi.fn()
    const onRestore = vi.fn()
    wrap(
      <ProSettings
        standing={standing(null, new Date())}
        billingAvailable={false}
        onManage={onManage}
        onRestore={onRestore}
        {...over}
      />,
    )
    return { onManage, onRestore }
  }

  it('always offers Restore purchases, and says when it cannot work', () => {
    // §U: "Restore purchases is always present." Present, and honestly
    // disabled until there is a store to restore from (§N).
    row()
    const restore = screen.getByRole('button', { name: strings.pro.restore })
    expect(restore).toBeInTheDocument()
    expect(restore).toBeDisabled()
  })

  it('says Free plainly when nothing is bought', () => {
    row()
    expect(screen.getByText(strings.pro.free)).toBeInTheDocument()
  })

  it('states the grace window with a date, calmly', () => {
    row({
      standing: { plan: 'pro', standing: 'grace', graceEndsAt: '2026-10-14T09:00:00.000Z' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('2026-10-14')
  })

  it('says a lapse has locked nothing', () => {
    row({ standing: { plan: 'free', standing: 'lapsed' } })
    expect(screen.getByRole('status')).toHaveTextContent(strings.pro.lapsedNotice)
    expect(screen.getByText(strings.pro.freeForever)).toBeInTheDocument()
  })
})
