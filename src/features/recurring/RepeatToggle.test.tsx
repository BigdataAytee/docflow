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
