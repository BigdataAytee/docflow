/**
 * The Repeat toggle (§L4, §G).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { RepeatToggle } from './RepeatToggle'
import type { Recurrence } from './schedule'
import { stringsFor } from '../../domain/locale/data/strings'

const recurrence: Recurrence = {
  sourceDocumentId: 'doc_88',
  dayOfMonth: 5,
  startedOn: '2026-06-05',
}

function renderToggle(over: Partial<React.ComponentProps<typeof RepeatToggle>> = {}) {
  const props: React.ComponentProps<typeof RepeatToggle> = {
    recurrence: null,
    today: '2026-09-11',
    onStart: vi.fn(),
    onStop: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <RepeatToggle {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('A visible state, like the logo switch (§G)', () => {
  it('reads as off, with a hint that matches', () => {
    renderToggle()
    expect(screen.getByRole('button', { name: 'Not repeating' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByText('This one is a one-off.')).toBeInTheDocument()
  })

  it('reads as on, and says when the next draft is due', () => {
    renderToggle({ recurrence })
    expect(screen.getByRole('button', { name: 'Repeating' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Every month on day 5')).toBeInTheDocument()
    expect(screen.getByText('Next draft on 2026-10')).toBeInTheDocument()
  })

  it('promises review, never sending', () => {
    renderToggle({ recurrence, waitingCount: 2 })
    expect(screen.getByText('2 waiting for you to check')).toBeInTheDocument()
    expect(screen.getByText('Nothing is sent until you look at it.')).toBeInTheDocument()
  })

  it('switches on and off through the caller', async () => {
    const user = userEvent.setup()
    const off = renderToggle()
    await user.click(screen.getByRole('button', { name: 'Not repeating' }))
    expect(off.onStart).toHaveBeenCalledOnce()
  })

  it('offers a plain way to stop, not only the switch', async () => {
    const user = userEvent.setup()
    const on = renderToggle({ recurrence })
    await user.click(screen.getByRole('button', { name: 'Stop repeating' }))
    expect(on.onStop).toHaveBeenCalledOnce()
  })

  it('shows nothing about schedules once Repeat has been switched off', () => {
    renderToggle({ recurrence: { ...recurrence, endedOn: '2026-08-01' } })
    expect(screen.getByRole('button', { name: 'Not repeating' })).toBeInTheDocument()
    expect(screen.queryByText(/Next draft/)).not.toBeInTheDocument()
  })
})

/**
 * Repeat missing is not Repeat off (§N, §L4).
 *
 * Repeat is an optional Phase 2.5 feature, and an install can be without it —
 * a backend that has not run `0021`, for one. When the read fails the store
 * reports `null`, which means "this install has no repeats", NOT "this
 * document does not repeat". Collapsing the two draws a live-looking toggle
 * over a feature that cannot act, which is the toggle-wired-to-nothing shape
 * §N forbids.
 */
describe('When this install has no repeats at all', () => {
  const EN = stringsFor('en').recurring

  it('says so, rather than showing a toggle that is simply off', async () => {
    renderToggle({ unavailable: true })
    expect(screen.getByText(EN.repeatUnavailable)).toBeInTheDocument()
    expect(screen.queryByText(EN.repeatOffHint)).toBeNull()
  })

  it('does not respond to a press', async () => {
    const props = renderToggle({ unavailable: true })
    const toggle = screen.getByRole('button', { name: EN.repeatOff })

    expect(toggle).toBeDisabled()
    await userEvent.click(toggle)

    expect(props.onStart).not.toHaveBeenCalled()
    expect(props.onStop).not.toHaveBeenCalled()
  })

  /**
   * Even with a schedule in hand. If the feature is gone the switch cannot
   * read "on" — an owner told their invoice repeats, by a control that cannot
   * make it happen, is worse off than one told it is unavailable.
   */
  it('never reads as on, even when a schedule is passed', () => {
    renderToggle({ unavailable: true, recurrence })
    expect(screen.getByRole('button', { name: EN.repeatOff })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('is an ordinary working toggle when the feature IS available', async () => {
    const props = renderToggle({ unavailable: false })
    const toggle = screen.getByRole('button', { name: EN.repeatOff })

    expect(toggle).not.toBeDisabled()
    await userEvent.click(toggle)
    expect(props.onStart).toHaveBeenCalled()
  })
})
